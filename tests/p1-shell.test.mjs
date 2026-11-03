import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const compiled = ts.transpileModule(read("src/features/workspace/contexto.tsx"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, { module, exports: module.exports, require });
const { WorkspaceProvider, useWorkspace } = module.exports;

test("contexto inicia sem dados comerciais, lojas fixas ou simulação de sessão", () => {
  let state;
  function Probe() {
    state = useWorkspace();
    return null;
  }
  renderToStaticMarkup(React.createElement(WorkspaceProvider, null, React.createElement(Probe)));
  assert.equal(state.escopo, "todas");
  assert.equal(state.lojas.length, 0);
  assert.equal("autenticar" in state, false);
  for (const key of ["produtos", "clientes", "vendas", "despesas", "colaboradores", "usuario"])
    assert.equal(key in state, false);
});

test("workspace usa IDs carregados do backend, sem nomes ou aliases comerciais fixos", () => {
  const contexto = read("src/features/workspace/contexto.tsx");
  assert.doesNotMatch(contexto, /PH Outlet|PH Kids|outlet|kids/);
  assert.match(contexto, /proximas\.some\(\(loja\) => loja\.id === atual\)/);
});

const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : /\.[jt]sx?$/.test(full) ? [full] : [];
  });
test("grafo das rotas Next não alcança mocks, store legado ou router TanStack", () => {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    assert.doesNotMatch(file, /mock-data|src[\\/]routes[\\/]|src[\\/]lib[\\/]store/);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const spec = statement.moduleSpecifier?.text;
      if (!spec) continue;
      assert.doesNotMatch(spec, /@tanstack\/react-(router|start)|mock-data|@\/lib\/store/);
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      const base = spec.startsWith("@/")
        ? path.join(root, "src", spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const resolved = [
        base,
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ].find((candidate) => existsSync(candidate));
      if (resolved && /\.[jt]sx?$/.test(resolved)) visit(resolved);
    }
  }
  for (const file of files(path.join(root, "src/app"))) visit(file);
  assert.ok(seen.size > 20);
});

test("rotas, fonte original, seletor e boundaries preservados", () => {
  for (const route of [
    "",
    "vendas/",
    "estoque/",
    "financeiro/",
    "clientes/",
    "colaboradores/",
    "meu-desempenho/",
    "login/",
    "acesso-negado/",
  ]) {
    assert.ok(existsSync(path.join(root, "src/app", route, "page.tsx")));
  }
  for (const file of ["loading.tsx", "error.tsx", "not-found.tsx"])
    assert.ok(existsSync(path.join(root, "src/app", file)));
  const shell = read("src/components/app-shell.tsx");
  assert.match(shell, /Selecionar loja/);
  assert.match(shell, /Todas as lojas/);
  assert.match(shell, /264px_minmax/);
  assert.match(read("src/app/layout.tsx"), /lang="pt-BR"/);
  assert.match(read("src/app/layout.tsx"), /family=Sora/);
});
