import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");

test("seletor do cabeçalho persiste o escopo e telas operacionais não duplicam loja", () => {
  const contexto = ler("src/features/workspace/contexto.tsx");
  const vendas = ler("src/features/vendas/components/page-view.tsx");
  const catalogo = ler("src/features/estoque/components/catalogo-view.tsx");
  const financeiro = ler("src/features/financeiro/components/page-view.tsx");

  assert.match(contexto, /localStorage\.getItem\(CHAVE_ESCOPO\)/);
  assert.match(contexto, /localStorage\.setItem\(CHAVE_ESCOPO/);
  assert.match(vendas, /useWorkspace\(\)/);
  assert.doesNotMatch(vendas, /<span className="text-muted-foreground">Loja:<\/span>/);
  assert.doesNotMatch(catalogo, /Loja autorizada/);
  assert.doesNotMatch(financeiro, /<Field label="Loja"><select/);
});

test("migration aplicada suporta leitura de notificações e e-mail de funcionários", () => {
  const migration = ler("database/migrations/202611030001_notificacoes_funcionarios.sql");
  const schema = ler("database/schema.sql");

  for (const sql of [migration, schema]) {
    assert.match(sql, /email text CHECK/);
    assert.match(sql, /CREATE TABLE public\.notificacoes_lidas/);
    assert.match(sql, /PRIMARY KEY \(usuario_id, chave\)/);
  }
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE ON public\.notificacoes_lidas/);
  assert.match(migration, /6454b71652a75c7c44f165a6c0fc2ef8fbd38aff4a8a4b2830d326acda08d482/);
  assert.doesNotMatch(migration, /:'hash_migracao'|:hash_migracao|\\set|\s-v\s/);
  assert.doesNotMatch(migration, /CREATE (?:DATABASE|ROLE|USER)|PASSWORD|DELETE FROM|DROP /i);
});
