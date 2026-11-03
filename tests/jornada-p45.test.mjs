import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregar(caminho, dependencias = {}) {
  const fonte = readFileSync(new URL(caminho, import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports,
    require(nome) {
      if (nome === "server-only") return {};
      if (Object.hasOwn(dependencias, nome)) return dependencias[nome];
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
  return modulo.exports;
}

const LOJA = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const CATEGORIA = "33333333-3333-4333-8333-333333333333";
const CHAVE_ENTRADA = "44444444-4444-4444-8444-444444444444";
const CHAVE_VENDA = "55555555-5555-4555-8555-555555555555";

const dominioMovimentacao = carregar("../src/features/estoque/dominio/movimentacao.ts");
const dominioSacola = carregar("../src/features/vendas/dominio/sacola.ts");
const dominioVenda = carregar("../src/features/vendas/dominio/venda.ts", { "./sacola": dominioSacola });

function estadoInicial() {
  return {
    loja: { id: LOJA, nome: "PH Outlet", ativa: true },
    usuario: { id: ADMIN, nome_exibicao: "Administrador", perfil: "administrador", ativo: true },
    categoria: { id: CATEGORIA, loja_id: LOJA, codigo: 1, nome: "Camiseta",
      tamanho: "M", preco_centavos: "7990", arquivada_em: null },
    saldo: "0", operacoes: [], movimentos: [], vendas: [], itensVenda: [], consultas: [],
  };
}

function bancoIntegrado(estado) {
  return async (executar) => {
    let dados = estado;
    let emTransacao = false;
    const cliente = { async consultar(consulta) {
      const { texto, parametros = [] } = consulta;
      dados.consultas.push(consulta);
      if (texto === "BEGIN") {
        dados = structuredClone(estado);
        emTransacao = true;
        return { rows: [] };
      }
      if (texto === "COMMIT") {
        Object.assign(estado, dados);
        emTransacao = false;
        return { rows: [] };
      }
      if (texto === "ROLLBACK") {
        dados = estado;
        emTransacao = false;
        return { rows: [] };
      }

      if (texto.includes("INSERT INTO public.operacoes_estoque")) {
        const anterior = dados.operacoes.find((operacao) =>
          operacao.loja_id === parametros[1] && operacao.chave_idempotencia === parametros[3]);
        if (anterior) return { rows: [] };
        dados.operacoes.push({ id: parametros[0], loja_id: parametros[1], autor_usuario_id: parametros[2],
          chave_idempotencia: parametros[3], impressao_requisicao: parametros[4],
          tipo: parametros[5], motivo: parametros[6] });
        return { rows: [{ id: parametros[0] }] };
      }
      if (texto.includes("FROM public.operacoes_estoque") && texto.includes("impressao_requisicao")) {
        return { rows: dados.operacoes.filter((operacao) =>
          operacao.loja_id === parametros[0] && operacao.chave_idempotencia === parametros[1]) };
      }
      if (texto.includes("FROM public.movimentos_estoque") && texto.includes("operacao_estoque_id")) {
        return { rows: dados.movimentos.filter((movimento) =>
          movimento.operacao_estoque_id === parametros[0] && movimento.loja_id === parametros[1]
          && movimento.categoria_id === parametros[2]).map((movimento) =>
          ({ id: movimento.id, saldo_apos: movimento.saldo_apos })) };
      }
      if (texto.includes("FROM public.saldos_estoque s") && texto.includes("FOR UPDATE OF s")) {
        return { rows: dados.categoria.id === parametros[0] && dados.categoria.loja_id === parametros[1]
          ? [{ quantidade: dados.saldo }] : [] };
      }
      if (texto.includes("UPDATE public.saldos_estoque") && texto.includes("SET quantidade = $3::bigint")) {
        dados.saldo = String(parametros[2]);
        return { rows: [] };
      }
      if (texto.includes("INSERT INTO public.movimentos_estoque")) {
        const venda = texto.includes("venda_id");
        dados.movimentos.push(venda
          ? { id: parametros[0], loja_id: parametros[1], categoria_id: parametros[2],
            autor_usuario_id: parametros[3], venda_id: parametros[4], operacao_estoque_id: null,
            variacao_quantidade: String(parametros[5]), saldo_apos: String(parametros[6]), motivo: parametros[7] }
          : { id: parametros[0], loja_id: parametros[1], categoria_id: parametros[2],
            autor_usuario_id: parametros[3], venda_id: null, operacao_estoque_id: parametros[4],
            variacao_quantidade: String(parametros[5]), saldo_apos: String(parametros[6]), motivo: parametros[7] });
        return { rows: [] };
      }

      if (texto.includes("l.nome AS loja_nome") && texto.includes("c.preco_centavos::text")
          && !texto.includes("AS estoque")) {
        return { rows: dados.categoria.id === parametros[0] && dados.categoria.loja_id === parametros[1]
          ? [{ ...dados.categoria, loja_nome: dados.loja.nome }] : [] };
      }
      if (texto.includes("AS estoque") && texto.includes("c.codigo = $2")) {
        return { rows: dados.categoria.loja_id === parametros[0] && dados.categoria.codigo === parametros[1]
          ? [{ ...dados.categoria, loja_nome: dados.loja.nome, estoque: dados.saldo }] : [] };
      }

      if (texto.includes("FROM public.vendas") && texto.includes("chave_idempotencia")) {
        return { rows: dados.vendas.filter((venda) =>
          venda.loja_id === parametros[0] && venda.chave_idempotencia === parametros[1]) };
      }
      if (texto.includes("FROM public.itens_venda")) {
        return { rows: dados.itensVenda.filter((item) =>
          item.venda_id === parametros[0] && item.loja_id === parametros[1]) };
      }
      if (texto.includes("FROM public.movimentos_estoque") && texto.includes("venda_id")) {
        return { rows: dados.movimentos.filter((movimento) =>
          movimento.venda_id === parametros[0] && movimento.loja_id === parametros[1])
          .map((movimento) => ({ categoria_id: movimento.categoria_id })) };
      }
      if (texto.includes("FROM public.usuarios u") && texto.includes("FOR SHARE")) {
        return { rows: [{ id: dados.usuario.id, perfil: dados.usuario.perfil }] };
      }
      if (texto.includes("FROM public.categorias c") && texto.includes("FOR UPDATE OF c, s")) {
        return { rows: parametros[1].includes(dados.categoria.id)
          ? [{ ...dados.categoria, quantidade: dados.saldo }] : [] };
      }
      if (texto.includes("INSERT INTO public.vendas")) {
        dados.vendas.push({ id: parametros[0], loja_id: parametros[1], autor_usuario_id: parametros[2],
          vendedor_usuario_id: parametros[3], chave_idempotencia: parametros[4],
          impressao_requisicao: parametros[5], total_centavos: String(parametros[6]),
          realizada_em: "2026-10-25T12:00:00.000Z" });
        return { rows: [{ id: parametros[0] }] };
      }
      if (texto.includes("UPDATE public.saldos_estoque") && texto.includes("quantidade = quantidade -")) {
        const quantidade = BigInt(parametros[2]);
        if (BigInt(dados.saldo) < quantidade) return { rows: [] };
        dados.saldo = (BigInt(dados.saldo) - quantidade).toString();
        return { rows: [{ quantidade: dados.saldo }] };
      }
      if (texto.includes("INSERT INTO public.itens_venda")) {
        dados.itensVenda.push({ id: parametros[0], venda_id: parametros[1], loja_id: parametros[2],
          categoria_id: parametros[3], codigo_registrado: parametros[4], nome_registrado: parametros[5],
          tamanho_registrado: parametros[6], preco_unitario_centavos: String(parametros[7]),
          quantidade: parametros[8], total_linha_centavos: String(parametros[9]) });
        return { rows: [] };
      }
      if (texto.includes("l.nome AS loja_nome") && texto.includes("responsavel_nome")) {
        const venda = dados.vendas.find((item) => item.id === parametros[0] && item.loja_id === parametros[1]);
        return { rows: venda ? [{ id: venda.id, loja_nome: dados.loja.nome,
          responsavel_nome: dados.usuario.nome_exibicao, total_centavos: venda.total_centavos,
          realizada_em: venda.realizada_em }] : [] };
      }
      throw new Error(`SQL não simulado: ${texto}`);
    } };
    try {
      return await executar(cliente);
    } finally {
      if (emTransacao) dados = estado;
    }
  };
}

function servicos(estado) {
  const comClienteBanco = bancoIntegrado(estado);
  const postgres = { comClienteBanco };
  return {
    estoque: carregar("../src/features/estoque/server/movimentacoes.ts", {
      "node:crypto": { createHash, randomUUID },
      "@/integrations/server/postgres-client": postgres,
      "../dominio/movimentacao": dominioMovimentacao,
    }),
    etiquetas: carregar("../src/features/etiquetas/server/etiquetas.ts", {
      "@/integrations/server/postgres-client": postgres,
    }),
    catalogoVenda: carregar("../src/features/vendas/server/catalogo-venda.ts", {
      "@/integrations/server/postgres-client": postgres,
      "../dominio/sacola": dominioSacola,
    }),
    vendas: carregar("../src/features/vendas/server/vendas.ts", {
      "node:crypto": { createHash, randomUUID },
      "@/integrations/server/postgres-client": postgres,
      "../dominio/venda": dominioVenda,
    }),
    comprovantes: carregar("../src/features/vendas/server/comprovantes.ts", {
      "@/integrations/server/postgres-client": postgres,
      "../dominio/venda": dominioVenda,
    }),
  };
}

test("jornada integrada preserva produto, baixa e comprovante persistido", async () => {
  const estado = estadoInicial();
  const servico = servicos(estado);

  const entrada = await servico.estoque.registrarMovimentacao(
    LOJA, CATEGORIA, ADMIN, "entrada", 2, "Entrada controlada", CHAVE_ENTRADA,
  );
  assert.equal(entrada.saldoApos, "2");
  assert.equal(estado.saldo, "2");

  const etiqueta = await servico.etiquetas.obterCategoriaParaEtiqueta(LOJA, CATEGORIA);
  assert.deepEqual([etiqueta.nome, etiqueta.tamanho, etiqueta.preco_centavos, etiqueta.codigo],
    ["Camiseta", "M", "7990", 1]);
  assert.equal(estado.saldo, "2", "preparar etiqueta não movimenta estoque");

  const produto = await servico.catalogoVenda.buscarProdutoVenda(LOJA, "00001");
  assert.deepEqual([produto.codigo, produto.nome, produto.tamanho, produto.precoCentavos, produto.estoque],
    ["00001", "Camiseta", "M", "7990", "2"]);

  const venda = await servico.vendas.confirmarVenda(
    LOJA, ADMIN, ADMIN, [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE_VENDA,
  );
  assert.equal(venda.totalCentavos, "7990");
  assert.equal(estado.saldo, "1");
  assert.equal(estado.vendas.length, 1);
  assert.equal(estado.itensVenda.length, 1);
  assert.equal(estado.movimentos.filter((movimento) => movimento.venda_id === venda.id).length, 1);

  const comprovante = await servico.comprovantes.obterComprovante(LOJA, venda.id);
  assert.deepEqual([comprovante.itens[0].codigo, comprovante.itens[0].nome,
    comprovante.itens[0].tamanho, comprovante.totalCentavos], ["00001", "Camiseta", "M", "7990"]);
  assert.equal(estado.saldo, "1", "consultar comprovante não repete a baixa");
});

test("reenvio da venda e reimpressão não duplicam venda, baixa ou movimento", async () => {
  const estado = estadoInicial();
  const servico = servicos(estado);
  await servico.estoque.registrarMovimentacao(
    LOJA, CATEGORIA, ADMIN, "entrada", 2, "Entrada controlada", CHAVE_ENTRADA,
  );
  const primeira = await servico.vendas.confirmarVenda(
    LOJA, ADMIN, ADMIN, [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE_VENDA,
  );
  const repetida = await servico.vendas.confirmarVenda(
    LOJA, ADMIN, ADMIN, [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE_VENDA,
  );
  assert.equal(repetida.repetida, true);
  assert.equal(estado.saldo, "1");
  assert.equal(estado.vendas.length, 1);
  assert.equal(estado.movimentos.filter((movimento) => movimento.venda_id === primeira.id).length, 1);

  const antes = structuredClone({ saldo: estado.saldo, vendas: estado.vendas,
    itensVenda: estado.itensVenda, movimentos: estado.movimentos });
  await servico.comprovantes.obterComprovante(LOJA, primeira.id);
  await servico.comprovantes.obterComprovante(LOJA, primeira.id);
  assert.deepEqual({ saldo: estado.saldo, vendas: estado.vendas,
    itensVenda: estado.itensVenda, movimentos: estado.movimentos }, antes);
});
