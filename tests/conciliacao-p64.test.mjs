import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const diretorio = new URL("../database/migrations/", import.meta.url);
const arquivos = readdirSync(diretorio).filter((nome) => nome.endsWith(".sql")).sort();
const esperados = new Map([
  ["202610140001_inicial.sql", "7592e40001a4795b5e96f4045fca976547868bbda224713bb556c5b3670a8e09"],
  ["202610240001_cadastro_inicial.sql", "74eeed07c10468df04213011e6fecb5af97f1985202d5dabba21ca9a37e5aacf"],
  ["202610240002_tamanho_categoria.sql", "7d073565370bd455dd7b942b36643ea117e1ec8cad515f6bf12947b807de80a8"],
  ["202610250001_metas.sql", "03739587ddd887033831142efdc1a8604acc76e2f922fc0892530ee7b49015f2"],
  ["202610260001_clientes_financeiro.sql", "bec909299d360642a2c3be8297661de0b62382aafecc5475216f27ae87e7a07e"],
]);
const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const migrations = arquivos.map((arquivo) => ({
  arquivo,
  sql: readFileSync(new URL(arquivo, diretorio), "utf8"),
}));

function nomes(sql, expressao) {
  return [...sql.matchAll(expressao)].map((resultado) => resultado[1]).sort();
}

test("histórico contém somente as cinco migrations imutáveis e seus hashes canônicos", () => {
  assert.deepEqual(arquivos, [...esperados.keys()]);
  for (const { arquivo, sql } of migrations) {
    const hash = createHash("sha256").update(sql).digest("hex");
    assert.equal(hash, esperados.get(arquivo), arquivo);
    assert.match(sql, /^BEGIN;/m, arquivo);
    assert.match(sql, /^COMMIT;/m, arquivo);
    assert.match(sql, /INSERT INTO public\.migracoes_schema/, arquivo);
  }
});

test("schema canônico contém exatamente as tabelas e índices criados pelo histórico", () => {
  const historico = migrations.map(({ sql }) => sql).join("\n");
  const tabelasHistorico = [...new Set(nomes(historico, /CREATE TABLE public\.([a-z0-9_]+)/g))].sort();
  const tabelasSchema = nomes(schema, /CREATE TABLE public\.([a-z0-9_]+)/g);
  const indicesHistorico = [...new Set(nomes(historico, /CREATE(?: UNIQUE)? INDEX ([a-z0-9_]+)/g))].sort();
  const indicesSchema = nomes(schema, /CREATE(?: UNIQUE)? INDEX ([a-z0-9_]+)/g);
  assert.deepEqual(tabelasSchema, tabelasHistorico);
  assert.deepEqual(indicesSchema, indicesHistorico);
  assert.equal(tabelasSchema.length, 15);
  assert.equal(indicesSchema.length, 16);
});

test("evoluções acumuladas estão materializadas no schema sem ampliar privilégios", () => {
  assert.match(schema, /tamanho text NOT NULL/);
  assert.match(schema, /tamanho_registrado text NOT NULL/);
  assert.match(schema, /cliente_id uuid REFERENCES public\.clientes\(id\)/);
  for (const tabela of ["metas", "historico_metas", "clientes", "despesas"])
    assert.match(schema, new RegExp(`CREATE TABLE public\\.${tabela}\\b`));
  assert.doesNotMatch(schema, /GRANT (?:ALL|CREATE|DELETE|TRUNCATE)/i);
  assert.doesNotMatch(schema, /CREATE (?:DATABASE|ROLE|USER)|ALTER ROLE|PASSWORD|HOSTSSL/i);
  assert.match(schema, /202610260001_clientes_financeiro\.sql aplicada manualmente/);
  assert.doesNotMatch(schema, /aguardando aplicacao manual/);
});

test("evidências recebidas do banco cobrem cada versão sem alegar nova consulta remota", () => {
  const plano = readFileSync(new URL("../docs/prodexy/plans/2026-10-12-construcao.md", import.meta.url), "utf8");
  const runbook = readFileSync(new URL("../docs/governanca/RUNBOOK-OPERACIONAL.md", import.meta.url), "utf8");
  for (const versao of [...esperados.keys()].map((nome) => nome.replace(/\.sql$/, ""))) {
    assert.match(plano, new RegExp(versao));
    assert.match(runbook, new RegExp(versao));
  }
  assert.match(plano, /11 tabelas e grants/);
  assert.match(plano, /PH Outlet e PH Kids com próximo código 1/);
  assert.match(plano, /duas colunas `NOT NULL`, dois índices e três privilégios/);
  assert.match(plano, /12 colunas em cada tabela, três índices/);
  assert.match(plano, /`clientes=9`, `despesas=8`, seis índices/);
  assert.match(runbook, /executor não consultou o banco/);
});
