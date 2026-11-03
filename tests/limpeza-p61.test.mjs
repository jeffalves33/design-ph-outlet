import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const raiz = path.resolve(import.meta.dirname, "..");
const ler = (arquivo) => readFileSync(path.join(raiz, arquivo), "utf8");
const arquivos = (diretorio) => readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
  const completo = path.join(diretorio, entrada.name);
  return entrada.isDirectory() ? arquivos(completo) : /\.[jt]sx?$/.test(completo) ? [completo] : [];
});

test("pacote não contém dependências TanStack, Vite, Nitro ou Bun", () => {
  const pacote = JSON.parse(ler("package.json"));
  assert.equal(pacote.name, "prodexy-ph-outlet");
  const nomes = new Set([...Object.keys(pacote.dependencies ?? {}), ...Object.keys(pacote.devDependencies ?? {})]);
  for (const nome of ["@tanstack/react-query", "@tanstack/react-router", "@tanstack/react-start",
    "@tanstack/router-plugin", "@tailwindcss/vite", "@vitejs/plugin-react", "vite",
    "vite-tsconfig-paths", "nitro"])
    assert.equal(nomes.has(nome), false, nome);
});

test("runtime Next não importa protótipo, fixtures ou autenticação simulada", () => {
  const fontes = arquivos(path.join(raiz, "src")).map((arquivo) => ({ arquivo, fonte: readFileSync(arquivo, "utf8") }));
  for (const { arquivo, fonte } of fontes) {
    if (arquivo.includes(`${path.sep}routes${path.sep}`) || arquivo.endsWith(`${path.sep}mock-data.ts`)) continue;
    assert.doesNotMatch(fonte, /@tanstack|@vitejs|vite-tsconfig|@\/lib\/store|mock-data|presentation-state|presentation-model/, arquivo);
  }
  assert.doesNotMatch(fontes.map((item) => item.fonte).join("\n"), /ph-admin-2026|camila2026|rafael2026|bia2026|tiago2026/);
});

test("tombstones bloqueados não conservam código, usuários ou dados fixos", () => {
  for (const arquivo of ["src/lib/mock-data.ts", "src/routes/colaboradores.tsx", "src/routes/estoque.tsx",
    "src/routes/login.tsx", "src/routes/meu-desempenho.tsx", "src/routes/vendas.tsx"]) {
    const fonte = ler(arquivo);
    assert.match(fonte, /Arquivo legado esvaziado em P6\.1/);
    assert.doesNotMatch(fonte, /@tanstack|createFileRoute|senha|PH Outlet|mock-data|useStore/);
  }
});

test("painel, estoque, seletor e alertas usam APIs reais e lojas do backend", () => {
  const painel = ler("src/features/painel/components/page-view.tsx");
  const shell = ler("src/components/app-shell.tsx");
  const estoque = ler("src/app/estoque/page.tsx");
  assert.match(painel, /\/api\/financeiro/);
  assert.match(painel, /\/api\/catalogo/);
  assert.match(painel, /\/api\/clientes/);
  assert.match(shell, /dadosCatalogo\.lojas/);
  assert.match(shell, /Dados atuais do catálogo e CRM/);
  assert.match(estoque, /catalogo-view/);
});

test("bundle cliente não referencia variáveis públicas de segredo", () => {
  const clientes = arquivos(path.join(raiz, "src")).filter((arquivo) => {
    const fonte = readFileSync(arquivo, "utf8");
    return fonte.startsWith('"use client"') || fonte.startsWith("'use client'");
  });
  for (const arquivo of clientes) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.doesNotMatch(fonte, /process\.env|NEXT_PUBLIC_|DATABASE_URL|PH_SESSION_ENCRYPTION_KEY|COGNITO_/,
      arquivo);
  }
});
