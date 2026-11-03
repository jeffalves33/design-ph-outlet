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

const dominio = carregar("../src/features/estoque/dominio/movimentacao.ts");
const pendencias = carregar("../src/features/estoque/dominio/operacao-pendente.ts");

test("operação pendente conserva chave e payload, limitada ao usuário da sessão", () => {
  const usuarioId = "11111111-1111-4111-8111-111111111111";
  const operacao = { usuarioId, lojaId: "22222222-2222-4222-8222-222222222222",
    categoriaId: "33333333-3333-4333-8333-333333333333", tipo: "ajuste",
    variacao: -1, motivo: "Contagem de teste", chave: "44444444-4444-4444-8444-444444444444" };
  assert.equal(pendencias.lerOperacaoPendente(JSON.stringify(operacao), usuarioId).chave, operacao.chave);
  assert.equal(pendencias.lerOperacaoPendente(JSON.stringify(operacao),
    "55555555-5555-4555-8555-555555555555"), null);
  assert.equal(pendencias.lerOperacaoPendente(JSON.stringify({ ...operacao, variacao: 0 }), usuarioId), null);
  assert.equal(pendencias.lerOperacaoPendente("{", usuarioId), null);
});

function servico(comClienteBanco) {
  return carregar("../src/features/estoque/server/movimentacoes.ts", {
    "node:crypto": { createHash, randomUUID },
    "@/integrations/server/postgres-client": { comClienteBanco },
    "../dominio/movimentacao": dominio,
  });
}

test("consulta de reconciliação usa loja e chave, sem nova escrita", async () => {
  const consultas = [];
  const modulo = servico(async (executar) => executar({ async consultar(consulta) {
    consultas.push(consulta);
    return { rows: [{ id: "operacao-a", categoria_id: "categoria-m", saldo_apos: "8",
      nome: "Camiseta", tamanho: "M" }] };
  } }));
  const resultado = await modulo.consultarOperacaoEstoque("loja-a", "chave-idempotente-01");
  assert.equal(resultado.categoriaId, "categoria-m");
  assert.equal(resultado.saldoApos, "8");
  assert.equal(resultado.tamanho, "M");
  assert.deepEqual([...consultas[0].parametros], ["loja-a", "chave-idempotente-01"]);
  assert.match(consultas[0].texto, /o\.loja_id = \$1 AND o\.chave_idempotencia = \$2/);
  assert.doesNotMatch(consultas[0].texto, /INSERT|UPDATE|DELETE/);
});

test("operação ausente não é afirmada; registro sem movimento não vira sucesso", async () => {
  let linhas = [];
  const modulo = servico(async (executar) => executar({ async consultar() { return { rows: linhas }; } }));
  assert.equal(await modulo.consultarOperacaoEstoque("loja-a", "chave-idempotente-01"), null);
  linhas = [{ id: "operacao-a", categoria_id: null, saldo_apos: null, nome: null, tamanho: null }];
  await assert.rejects(modulo.consultarOperacaoEstoque("loja-a", "chave-idempotente-01"),
    (erro) => erro.status === 503);
});

test("duas sessões disputando a última peça: só uma confirma (simulação local do lock)", async () => {
  let saldo = 1;
  let fila = Promise.resolve();
  let movimentosConfirmados = 0;
  const comClienteBanco = async (executar) => {
    let liberarLock = null;
    let saldoPendente = null;
    let movimentoPendente = false;
    const cliente = { async consultar({ texto, parametros }) {
      if (texto === "BEGIN") return { rows: [] };
      if (texto.includes("ON CONFLICT")) return { rows: [{ id: randomUUID() }] };
      if (texto.includes("FOR UPDATE OF s")) {
        const anterior = fila;
        fila = new Promise((resolver) => { liberarLock = resolver; });
        await anterior;
        return { rows: [{ quantidade: String(saldo) }] };
      }
      if (texto.includes("UPDATE public.saldos_estoque")) {
        saldoPendente = Number(parametros[2]);
        return { rows: [] };
      }
      if (texto.includes("INSERT INTO public.movimentos_estoque")) {
        movimentoPendente = true;
        return { rows: [] };
      }
      if (texto === "COMMIT") {
        saldo = saldoPendente;
        if (movimentoPendente) movimentosConfirmados++;
        liberarLock?.();
        return { rows: [] };
      }
      if (texto === "ROLLBACK") {
        liberarLock?.();
        return { rows: [] };
      }
      throw new Error(`SQL não simulado: ${texto}`);
    } };
    return executar(cliente);
  };
  const modulo = servico(comClienteBanco);
  const resultados = await Promise.allSettled([
    modulo.registrarMovimentacao("loja-a", "categoria-m", "admin-a", "ajuste", -1,
      "Contagem", "chave-idempotente-01"),
    modulo.registrarMovimentacao("loja-a", "categoria-m", "admin-a", "ajuste", -1,
      "Contagem", "chave-idempotente-02"),
  ]);
  assert.equal(resultados.filter((resultado) => resultado.status === "fulfilled").length, 1);
  assert.equal(resultados.filter((resultado) => resultado.status === "rejected" &&
    resultado.reason.status === 409).length, 1);
  assert.equal(saldo, 0);
  assert.equal(movimentosConfirmados, 1);
});

test("API de reconciliação autoriza a loja e UI mantém chave após resposta incerta", () => {
  const api = readFileSync(new URL("../src/app/api/estoque/movimentos/route.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/estoque/components/catalogo-view.tsx", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("estoque\.consultar", \{ lojaId \}\)/);
  assert.match(api, /consultarOperacaoEstoque\(lojaId, chave\)/);
  assert.match(tela, /Verificar se foi registrada/);
  assert.match(tela, /chaveIdempotencia: pendente\.chave/);
  assert.match(tela, /dados\.operacao\.categoriaId !== movimentando/);
  assert.match(tela, /reconciliacaoPendente && !verificacaoFeita/);
  assert.match(tela, /localStorage\.setItem\(CHAVE_OPERACAO_PENDENTE/);
  assert.match(tela, /lerOperacaoPendente\(/);
  assert.match(schema, /UNIQUE \(loja_id, chave_idempotencia\)/);
  assert.match(schema, /CHECK \(quantidade >= 0\)/);
});
