import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/integrations/server/env-contract.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, {
  module,
  exports: module.exports,
  require(name) {
    assert.equal(name, "server-only");
  },
});
const { missingServerEnvNames } = module.exports;

test("validação aponta somente nomes faltantes, sem revelar valores", () => {
  const result = missingServerEnvNames(
    { DATABASE_URL: "credencial-sintetica", AWS_REGION: "  " },
    ["DATABASE_URL", "AWS_REGION"],
  );
  assert.deepEqual([...result], ["AWS_REGION"]);
  assert.equal(JSON.stringify(result).includes("credencial-sintetica"), false);
});

test("contrato do servidor rejeita nomes públicos ou inválidos", () => {
  assert.throws(() => missingServerEnvNames({}, ["NEXT_PUBLIC_DATABASE_URL"]));
  assert.throws(() => missingServerEnvNames({}, ["database-url"]));
});
