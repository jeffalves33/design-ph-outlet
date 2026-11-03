import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");

test("build Next usa o diretório padrão esperado pela Vercel", () => {
  const nextConfig = ler("next.config.ts");
  const tsconfig = ler("tsconfig.json");
  const nextEnv = ler("next-env.d.ts");

  assert.doesNotMatch(nextConfig, /distDir/);
  assert.doesNotMatch(`${nextConfig}\n${tsconfig}\n${nextEnv}`, /\.next-p1/);
  assert.match(tsconfig, /\.next\/types\/\*\*\/\*\.ts/);
});
