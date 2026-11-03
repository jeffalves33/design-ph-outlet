import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createHash } from "node:crypto";

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

test("entrada e ajuste exigem motivo, inteiros e saldo não negativo", () => {
  const chave = "chave-idempotente-01";
  assert.equal(dominio.validarMovimentacao("entrada", 4, " Compra ", chave).motivo, "Compra");
  assert.equal(dominio.validarMovimentacao("ajuste", -2, "Avaria", chave).variacao, -2);
  assert.equal(dominio.saldoAposMovimento("3", -2), "1");
  assert.throws(() => dominio.validarMovimentacao("entrada", -1, "Compra", chave));
  assert.throws(() => dominio.validarMovimentacao("ajuste", 0, "Avaria", chave));
  assert.throws(() => dominio.validarMovimentacao("ajuste", 1.5, "Avaria", chave));
  assert.throws(() => dominio.validarMovimentacao("ajuste", 1, "  ", chave));
  assert.throws(() => dominio.saldoAposMovimento("1", -2));
});

function servicoComCliente(cliente) {
  return carregar("../src/features/estoque/server/movimentacoes.ts", {
    "node:crypto": { createHash, randomUUID: () => "id-sintetico" },
    "@/integrations/server/postgres-client": { comClienteBanco: (executar) => executar(cliente) },
    "../dominio/movimentacao": dominio,
  });
}

test("entrada grava operação, saldo e movimento na mesma transação", async () => {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [{ id: "operacao-a" }] };
    if (consulta.texto.includes("FOR UPDATE OF s")) return { rows: [{ quantidade: "2" }] };
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  const resultado = await servico.registrarMovimentacao(
    "loja-a", "categoria-a", "admin-a", "entrada", 3, "Compra", "chave-idempotente-01",
  );
  assert.equal(resultado.saldoApos, "5");
  assert.equal(resultado.repetida, false);
  assert.equal(consultas[0].texto, "BEGIN");
  assert.equal(consultas.at(-1).texto, "COMMIT");
  assert.ok(consultas.some((c) => c.texto.includes("ON CONFLICT (loja_id, chave_idempotencia) DO NOTHING")));
  assert.ok(consultas.some((c) => c.texto.includes("FOR UPDATE OF s") &&
    c.parametros[0] === "categoria-a" && c.parametros[1] === "loja-a"));
  assert.ok(consultas.some((c) => c.texto.includes("UPDATE public.saldos_estoque") &&
    c.parametros[0] === "categoria-a" && c.parametros[1] === "loja-a" && c.parametros[2] === "5"));
  assert.ok(consultas.some((c) => c.texto.includes("INSERT INTO public.movimentos_estoque") && c.parametros[6] === "5"));
});

test("ajuste insuficiente reverte tudo e não cria movimento", async () => {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [{ id: "operacao-a" }] };
    if (consulta.texto.includes("FOR UPDATE OF s")) return { rows: [{ quantidade: "1" }] };
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  await assert.rejects(servico.registrarMovimentacao(
    "loja-a", "categoria-a", "admin-a", "ajuste", -2, "Avaria", "chave-idempotente-01",
  ));
  assert.equal(consultas.at(-1).texto, "ROLLBACK");
  assert.ok(!consultas.some((c) => c.texto.includes("INSERT INTO public.movimentos_estoque")));
  assert.ok(!consultas.some((c) => c.texto === "COMMIT"));
});

test("categoria de outra loja ou arquivada não altera saldo", async () => {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [{ id: "operacao-a" }] };
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  await assert.rejects(servico.registrarMovimentacao(
    "loja-a", "categoria-de-outra-loja", "admin-a", "entrada", 2, "Compra", "chave-idempotente-01",
  ), (erro) => erro.status === 404);
  assert.equal(consultas.at(-1).texto, "ROLLBACK");
  assert.ok(!consultas.some((c) => c.texto.includes("UPDATE public.saldos_estoque")));
});

test("falha após atualização do saldo desfaz operação e saldo", async () => {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [{ id: "operacao-a" }] };
    if (consulta.texto.includes("FOR UPDATE OF s")) return { rows: [{ quantidade: "2" }] };
    if (consulta.texto.includes("INSERT INTO public.movimentos_estoque")) throw new Error("falha-sintetica");
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  await assert.rejects(servico.registrarMovimentacao(
    "loja-a", "categoria-a", "admin-a", "entrada", 3, "Compra", "chave-idempotente-01",
  ));
  assert.ok(consultas.some((c) => c.texto.includes("UPDATE public.saldos_estoque")));
  assert.equal(consultas.at(-1).texto, "ROLLBACK");
  assert.ok(!consultas.some((c) => c.texto === "COMMIT"));
});

test("mesma chave e payload devolvem resultado anterior sem segunda baixa", async () => {
  const consultas = [];
  const entrada = { lojaId: "loja-a", categoriaId: "categoria-a", autorUsuarioId: "admin-a",
    tipo: "ajuste", variacao: -1, motivo: "Avaria", chaveIdempotencia: "chave-idempotente-01" };
  const impressao = createHash("sha256").update(JSON.stringify(entrada)).digest("hex");
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [] };
    if (consulta.texto.includes("SELECT id, impressao_requisicao"))
      return { rows: [{ id: "operacao-anterior", impressao_requisicao: impressao }] };
    if (consulta.texto.includes("SELECT id, saldo_apos::text"))
      return { rows: [{ id: "movimento-anterior", saldo_apos: "7" }] };
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  const resultado = await servico.registrarMovimentacao(
    entrada.lojaId, entrada.categoriaId, entrada.autorUsuarioId,
    entrada.tipo, entrada.variacao, entrada.motivo, entrada.chaveIdempotencia,
  );
  assert.equal(resultado.repetida, true);
  assert.equal(resultado.saldoApos, "7");
  assert.ok(!consultas.some((c) => c.texto.includes("UPDATE public.saldos_estoque")));
  assert.ok(!consultas.some((c) => c.texto.includes("INSERT INTO public.movimentos_estoque")));
  assert.equal(consultas.at(-1).texto, "COMMIT");
});

test("mesma chave com payload diferente gera conflito e rollback", async () => {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("ON CONFLICT")) return { rows: [] };
    if (consulta.texto.includes("SELECT id, impressao_requisicao"))
      return { rows: [{ id: "operacao-anterior", impressao_requisicao: "0".repeat(64) }] };
    return { rows: [] };
  } };
  const servico = servicoComCliente(cliente);
  await assert.rejects(servico.registrarMovimentacao(
    "loja-a", "categoria-a", "admin-a", "entrada", 2, "Compra", "chave-idempotente-01",
  ), (erro) => erro.status === 409);
  assert.equal(consultas.at(-1).texto, "ROLLBACK");
});

test("API autoriza loja no servidor, exige origem e UI mantém chave até êxito", () => {
  const api = readFileSync(new URL("../src/app/api/estoque/movimentos/route.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/estoque/components/catalogo-view.tsx", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("estoque\.gerir", \{ lojaId \}\)/);
  assert.match(api, /autorizarAcao\("estoque\.consultar", \{ lojaId \}\)/);
  assert.match(api, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.match(tela, /chavePendente\.current\?\.assinatura !== assinatura/);
  assert.match(tela, /fetch\("\/api\/estoque\/movimentos"/);
  assert.match(tela, /categoria\.nome} · \$\{categoria\.tamanho/);
  assert.doesNotMatch(tela, /presentation-state|mock-data/);
});
