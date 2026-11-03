import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../database/migrations/202610140001_inicial.sql", import.meta.url), "utf8");
const migrationTamanho = readFileSync(new URL("../database/migrations/202610240002_tamanho_categoria.sql", import.meta.url), "utf8");
const migrationWithoutLedgerRow = migration.replace(
  /-- Variável do psql[^\n]*\nINSERT INTO public\.migracoes_schema \(versao, hash_sha256\)\nVALUES \('202610140001_inicial', :'hash_migracao'\);\n\n/,
  "",
);

test("migration inicial permanece imutável e schema reflete a evolução de tamanho", () => {
  assert.match(migrationWithoutLedgerRow, /CREATE TABLE public\.categorias/);
  assert.doesNotMatch(migration, /ADD COLUMN tamanho/);
  assert.match(schema, /tamanho text NOT NULL CHECK \(length\(btrim\(tamanho\)\) BETWEEN 1 AND 40\)/);
  assert.match(migrationTamanho, /ALTER TABLE public\.categorias[\s\S]*ADD COLUMN tamanho/);
  assert.match(schema, /tamanho_registrado text NOT NULL/);
  assert.match(migrationTamanho, /ALTER TABLE public\.itens_venda[\s\S]*ADD COLUMN tamanho_registrado/);
  assert.match(schema, /CREATE UNIQUE INDEX categorias_loja_nome_tamanho_ativas_uidx/);
  assert.match(migrationTamanho, /CREATE UNIQUE INDEX categorias_loja_nome_tamanho_ativas_uidx/);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(migration, /INSERT INTO public\.migracoes_schema/);
  assert.match(migrationTamanho, /BEGIN;[\s\S]*COMMIT;/);
  assert.match(migrationTamanho, /IF EXISTS \(SELECT 1 FROM public\.categorias\)/);
  assert.match(migrationTamanho, /INSERT INTO public\.migracoes_schema/);
});

test("isolamento por loja e histórico da venda estão no contrato SQL", () => {
  assert.match(schema, /UNIQUE \(loja_id, codigo\)/);
  assert.match(schema, /FOREIGN KEY \(categoria_id, loja_id\) REFERENCES public\.categorias\(id, loja_id\)/);
  assert.match(schema, /UNIQUE \(loja_id, chave_idempotencia\)/);
  assert.match(schema, /codigo_registrado integer NOT NULL/);
  assert.match(schema, /quantidade bigint NOT NULL DEFAULT 0 CHECK \(quantidade >= 0\)/);
  assert.match(schema, /CHECK \(num_nonnulls\(operacao_estoque_id, venda_id\) = 1\)/);
});

test("runtime recebe apenas DML explícito e não altera registros imutáveis", () => {
  assert.doesNotMatch(schema, /CREATE (DATABASE|ROLE|USER)|ALTER ROLE|PASSWORD|HOSTSSL/i);
  assert.doesNotMatch(schema, /GRANT (ALL|CREATE|DELETE|TRUNCATE)/i);
  const updateGrant = schema.match(/GRANT UPDATE ON ([\s\S]*?) TO prodexy_ph_outlet_app;/)?.[1];
  assert.ok(updateGrant);
  for (const table of ["vendas", "itens_venda", "movimentos_estoque", "operacoes_estoque", "migracoes_schema"])
    assert.doesNotMatch(updateGrant, new RegExp(`\\b${table}\\b`));
});

test("identificadores de negócio seguem nomenclatura em português", () => {
  for (const englishName of ["stores", "profiles", "categories", "sales", "stock_balances", "sale_items"])
    assert.doesNotMatch(schema, new RegExp(`public\\.${englishName}\\b`));
});
