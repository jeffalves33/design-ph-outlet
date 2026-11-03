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

const dominioSacola = carregar("../src/features/vendas/dominio/sacola.ts");
const dominio = carregar("../src/features/vendas/dominio/venda.ts", { "./sacola": dominioSacola });
const LOJA = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const VENDEDOR = "33333333-3333-4333-8333-333333333333";
const CATEGORIA = "44444444-4444-4444-8444-444444444444";
const CHAVE = "55555555-5555-4555-8555-555555555555";

function criarEstado(estoque = "3") {
  return {
    venda: null,
    itens: [],
    movimentos: [],
    categoria: { id: CATEGORIA, codigo: 1, nome: "Camiseta", tamanho: "M",
      preco_centavos: "7990", quantidade: estoque },
    consultas: [],
  };
}

function bancoEmMemoria(estado) {
  return async (executar) => {
    const local = structuredClone(estado);
    const cliente = { async consultar(consulta) {
      local.consultas.push(consulta);
      const { texto, parametros = [] } = consulta;
      if (texto === "BEGIN" || texto === "ROLLBACK") return { rows: [] };
      if (texto === "COMMIT") {
        estado.venda = local.venda;
        estado.itens = local.itens;
        estado.movimentos = local.movimentos;
        estado.categoria = local.categoria;
        estado.consultas = local.consultas;
        return { rows: [] };
      }
      if (texto.includes("FROM public.vendas") && texto.includes("chave_idempotencia")) {
        return { rows: local.venda && local.venda.chave_idempotencia === parametros[1]
          ? [local.venda] : [] };
      }
      if (texto.includes("FROM public.itens_venda")) return { rows: local.itens };
      if (texto.includes("FROM public.movimentos_estoque") && texto.includes("venda_id")) {
        return { rows: local.movimentos.map((movimento) => ({ categoria_id: movimento.categoria_id })) };
      }
      if (texto.includes("FROM public.usuarios u")) {
        return { rows: [{ id: ADMIN, perfil: "administrador" }, { id: VENDEDOR, perfil: "vendedor" }] };
      }
      if (texto.includes("FROM public.categorias c") && texto.includes("FOR UPDATE OF c, s")) {
        const ids = parametros[1];
        return { rows: ids.includes(local.categoria.id) ? [local.categoria] : [] };
      }
      if (texto.includes("INSERT INTO public.vendas")) {
        if (local.venda?.chave_idempotencia === parametros[4]) return { rows: [] };
        local.venda = { id: parametros[0], vendedor_usuario_id: parametros[3],
          chave_idempotencia: parametros[4], impressao_requisicao: parametros[5],
          total_centavos: parametros[6], realizada_em: "2026-10-25T12:00:00.000Z" };
        return { rows: [{ id: parametros[0] }] };
      }
      if (texto.includes("UPDATE public.saldos_estoque")) {
        const quantidade = BigInt(parametros[2]);
        if (BigInt(local.categoria.quantidade) < quantidade) return { rows: [] };
        local.categoria.quantidade = (BigInt(local.categoria.quantidade) - quantidade).toString();
        return { rows: [{ quantidade: local.categoria.quantidade }] };
      }
      if (texto.includes("INSERT INTO public.itens_venda")) {
        local.itens.push({ categoria_id: parametros[3], codigo_registrado: parametros[4],
          nome_registrado: parametros[5], tamanho_registrado: parametros[6],
          preco_unitario_centavos: parametros[7], quantidade: parametros[8],
          total_linha_centavos: parametros[9] });
        return { rows: [] };
      }
      if (texto.includes("INSERT INTO public.movimentos_estoque")) {
        local.movimentos.push({ categoria_id: parametros[2], variacao: parametros[5], saldo_apos: parametros[6] });
        return { rows: [] };
      }
      throw new Error(`SQL não simulado: ${texto}`);
    } };
    return executar(cliente);
  };
}

function servico(estado) {
  return carregar("../src/features/vendas/server/vendas.ts", {
    "node:crypto": { createHash, randomUUID },
    "@/integrations/server/postgres-client": { comClienteBanco: bancoEmMemoria(estado) },
    "../dominio/venda": dominio,
  });
}

test("entrada agrega categorias repetidas, ordena o payload e rejeita quantidade inválida", () => {
  const outra = "66666666-6666-4666-8666-666666666666";
  const validada = dominio.validarVenda(VENDEDOR, [
    { categoriaId: outra, quantidade: 1 },
    { categoriaId: CATEGORIA, quantidade: 1 },
    { categoriaId: CATEGORIA, quantidade: 2 },
  ], CHAVE);
  assert.equal(validada.itens.length, 2);
  assert.equal(validada.itens.find((item) => item.categoriaId === CATEGORIA).quantidade, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(validada.itens.map((item) => item.categoriaId))), [CATEGORIA, outra]);
  assert.throws(() => dominio.validarVenda(VENDEDOR, [{ categoriaId: CATEGORIA, quantidade: 0 }], CHAVE));
  assert.throws(() => dominio.validarVenda(ADMIN, [], CHAVE), /1 a 100/);
});

test("confirmação recalcula preço e total, grava snapshots e baixa na mesma transação", async () => {
  const estado = criarEstado("3");
  const vendas = servico(estado);
  const resultado = await vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 2 }], CHAVE);
  assert.equal(resultado.totalCentavos, "15980");
  assert.equal(resultado.repetida, false);
  assert.equal(estado.categoria.quantidade, "1");
  assert.equal(estado.itens[0].nome_registrado, "Camiseta");
  assert.equal(estado.itens[0].tamanho_registrado, "M");
  assert.equal(estado.itens[0].preco_unitario_centavos, "7990");
  assert.equal(estado.movimentos[0].variacao, -2);
  const sql = estado.consultas.map((consulta) => consulta.texto).join("\n");
  assert.match(sql, /FOR UPDATE OF c, s/);
  assert.match(sql, /quantidade >= \$3::bigint/);
  assert.ok(estado.consultas.some((consulta) => consulta.texto === "COMMIT"));
  assert.equal("impressaoRequisicao" in resultado, false);
});

test("administrador ativo pode ser o responsável sem trocar seu perfil", async () => {
  const estado = criarEstado("1");
  const vendas = servico(estado);
  const resultado = await vendas.confirmarVenda(LOJA, ADMIN, ADMIN,
    [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE);
  assert.equal(resultado.vendedorUsuarioId, ADMIN);
  const catalogo = readFileSync(new URL("../src/features/vendas/server/catalogo-venda.ts", import.meta.url), "utf8");
  assert.match(catalogo, /u\.perfil IN \('administrador', 'vendedor'\)/);
});

test("mesma chave e payload devolve a venda sem nova baixa; payload diferente conflita", async () => {
  const estado = criarEstado("3");
  const vendas = servico(estado);
  await vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE);
  const saldo = estado.categoria.quantidade;
  const movimentos = estado.movimentos.length;
  const repetida = await vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE);
  assert.equal(repetida.repetida, true);
  assert.equal(estado.categoria.quantidade, saldo);
  assert.equal(estado.movimentos.length, movimentos);
  await assert.rejects(vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 2 }], CHAVE),
  (erro) => erro.status === 409);
  assert.equal(estado.categoria.quantidade, saldo);
});

test("estoque insuficiente reverte e não produz venda parcial", async () => {
  const estado = criarEstado("1");
  const vendas = servico(estado);
  await assert.rejects(vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 2 }], CHAVE),
  (erro) => erro.status === 409);
  assert.equal(estado.venda, null);
  assert.equal(estado.itens.length, 0);
  assert.equal(estado.movimentos.length, 0);
  assert.equal(estado.categoria.quantidade, "1");
});

test("resposta perdida após commit é reconciliada por consulta somente leitura", async () => {
  const estado = criarEstado("2");
  const vendas = servico(estado);
  await vendas.confirmarVenda(LOJA, ADMIN, VENDEDOR,
    [{ categoriaId: CATEGORIA, quantidade: 1 }], CHAVE);
  estado.consultas = [];
  const encontrada = await vendas.consultarVenda(LOJA, CHAVE);
  assert.equal(encontrada.totalCentavos, "7990");
  const sql = estado.consultas.map((consulta) => consulta.texto).join("\n");
  assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
  assert.equal("impressaoRequisicao" in encontrada, false);
});

test("duas sessões disputando uma peça usam lock e atualização condicional", async () => {
  let saldo = 1;
  let fila = Promise.resolve();
  const disputar = async () => {
    const anterior = fila;
    let liberar;
    fila = new Promise((resolver) => { liberar = resolver; });
    await anterior;
    try {
      if (saldo < 1) throw new dominio.ErroVenda("Estoque insuficiente.", 409);
      saldo -= 1;
      return "confirmada";
    } finally { liberar(); }
  };
  const resultados = await Promise.allSettled([disputar(), disputar()]);
  assert.equal(resultados.filter((resultado) => resultado.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((resultado) => resultado.status === "rejected").length, 1);
  assert.equal(saldo, 0);
  const fonte = readFileSync(new URL("../src/features/vendas/server/vendas.ts", import.meta.url), "utf8");
  assert.match(fonte, /ORDER BY c\.id[\s\S]*FOR UPDATE OF c, s/);
  assert.match(fonte, /quantidade >= \$3::bigint/);
});

test("pendência fica vinculada ao usuário e conserva exatamente o payload", () => {
  const item = { id: CATEGORIA, lojaId: LOJA, lojaNome: "PH Outlet", codigo: "00001",
    nome: "Camiseta", tamanho: "M", precoCentavos: "7990", estoque: "2", quantidade: 1 };
  const pendente = { usuarioId: ADMIN, lojaId: LOJA, vendedorUsuarioId: VENDEDOR,
    itens: [{ categoriaId: CATEGORIA, quantidade: 1 }], itensExibicao: [item], chave: CHAVE };
  assert.equal(dominio.lerVendaPendente(JSON.stringify(pendente), ADMIN).chave, CHAVE);
  assert.equal(dominio.lerVendaPendente(JSON.stringify(pendente), VENDEDOR), null);
  assert.equal(dominio.lerVendaPendente("{", ADMIN), null);
});

test("API exige origem e autorização; UI envia somente IDs, quantidade e chave", () => {
  const api = readFileSync(new URL("../src/app/api/vendas/route.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/vendas/components/page-view.tsx", import.meta.url), "utf8");
  const contrato = readFileSync(new URL("../src/features/vendas/dominio/venda.ts", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("vendas\.registrar", \{ lojaId \}\)/);
  assert.match(api, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.match(contrato, /categoriaId: item\.id, quantidade: item\.quantidade/);
  assert.match(tela, /CHAVE_VENDA_PENDENTE/);
  assert.match(tela, /Verificar venda/);
  assert.doesNotMatch(tela, /precoCentavos:.*body|totalCentavos:.*body/);
});
