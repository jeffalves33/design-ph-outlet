import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../database/migrations/202610240001_cadastro_inicial.sql", import.meta.url),
  "utf8",
);

test("cadastro inicial exige identidade externa e aplica dados em uma transação", () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /:'emissor_cognito'/);
  assert.match(sql, /:'sub_cognito'/);
  assert.match(sql, /:'hash_migracao'/);
  assert.match(sql, /current_setting\('ph_cadastro\.emissor'\)/);
  assert.match(sql, /current_setting\('ph_cadastro\.sub'\)/);
  assert.match(sql, /Cadastro inicial requer lojas, usuarios, vinculos e contadores vazios/);
  assert.doesNotMatch(sql, /CREATE (DATABASE|ROLE|USER)|ALTER ROLE|PASSWORD|DELETE FROM|TRUNCATE/i);
});

test("cadastro inicial inclui exatamente duas lojas, dois contadores e um admin com dois vínculos", () => {
  assert.match(sql, /'PH Outlet'/);
  assert.match(sql, /'PH Kids'/);
  assert.equal((sql.match(/INSERT INTO public\.lojas\b/g) ?? []).length, 1);
  assert.equal((sql.match(/INSERT INTO public\.sequencias_categoria\b/g) ?? []).length, 1);
  assert.equal((sql.match(/INSERT INTO public\.usuarios\s/g) ?? []).length, 1);
  assert.equal((sql.match(/INSERT INTO public\.usuarios_lojas\b/g) ?? []).length, 1);
  assert.match(sql, /'prodexy\.labs@gmail\.com', 'administrador', true/);
  assert.match(sql, /'202610240001_cadastro_inicial'/);
  assert.match(sql, /count\(\*\) FROM public\.usuarios WHERE perfil = 'administrador' AND ativo\) <> 1/);
  assert.match(sql, /count\(\*\) FROM public\.usuarios_lojas WHERE ativo\) <> 2/);
});
