import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../database/migrations/202610250001_metas.sql", import.meta.url), "utf8",
);

test("schema e migration mantêm o mesmo contrato de metas e histórico", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE public\.metas/);
    assert.match(sql, /CREATE TABLE public\.historico_metas/);
    assert.match(sql, /vendedor_usuario_id uuid NOT NULL/);
    assert.match(sql, /alvo_centavos bigint NOT NULL CHECK \(alvo_centavos > 0\)/);
    assert.match(sql, /inicio_data date NOT NULL/);
    assert.match(sql, /fim_data date NOT NULL/);
    assert.match(sql, /CHECK \(inicio_data <= fim_data\)/);
    assert.match(sql, /UNIQUE \(meta_id, versao\)/);
    assert.match(sql, /tipo_alteracao IN \('criacao', 'edicao'\)/);
  }
});

test("metas são isoladas por vendedor e loja, sem proibir sobreposição", () => {
  assert.match(migration, /FOREIGN KEY \(vendedor_usuario_id, loja_id\)[\s\S]*usuarios_lojas/);
  assert.match(migration, /metas_vendedor_loja_periodo_idx/);
  assert.doesNotMatch(migration, /EXCLUDE|WITHOUT OVERLAPS/);
  assert.doesNotMatch(migration, /frequencia|mensal/i);
});

test("runtime pode manter metas e apenas acrescentar seu histórico", () => {
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON public\.metas/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.historico_metas/);
  assert.doesNotMatch(migration, /GRANT[^;]*DELETE/i);
  assert.doesNotMatch(migration, /GRANT[^;]*UPDATE ON public\.historico_metas/i);
  assert.doesNotMatch(migration, /CREATE (DATABASE|ROLE|USER)|ALTER ROLE|PASSWORD/i);
});

test("migration é transacional, versionada e recusa replay", () => {
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
  assert.match(migration, /202610240002_tamanho_categoria/);
  assert.match(migration, /202610250001_metas/);
  assert.match(migration, /:'hash_migracao'/);
  assert.match(migration, /Migration de metas ja aplicada; nao repetir/);
});
