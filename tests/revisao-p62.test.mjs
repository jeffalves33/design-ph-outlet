import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (arquivo) => readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");

test("login remove textos temporários e orienta cada estado da jornada", () => {
  const login = ler("src/features/acesso/components/page-view.tsx");
  assert.doesNotMatch(login, /Design Teste|Interface em integração|Voltar à interface/);
  assert.match(login, />\s*PH Outlet\s*</);
  assert.match(login, /by Prodexy Labs\./);
  assert.match(login, /Informe seu e-mail para receber o código de recuperação\./);
  assert.match(login, /Informe o código recebido e escolha sua nova senha\./);
  assert.match(login, /Conclua a verificação solicitada/);
});

test("login oferece semântica, foco e preenchimento automático adequados", () => {
  const login = ler("src/features/acesso/components/page-view.tsx");
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /autoComplete=\{modo === "entrar" \? "current-password" : "new-password"\}/);
  assert.match(login, /autoComplete="one-time-code"/);
  assert.match(login, /role="alert"/);
  assert.match(login, /role="status"/);
  assert.match(login, /aria-label=\{mostrarSenha \? "Ocultar senha" : "Mostrar senha"\}/);
  assert.match(login, /type="submit"/);
  assert.match(login, /type="button"/);
});

test("shell preserva navegação responsiva e controles nomeados", () => {
  const shell = ler("src/components/app-shell.tsx");
  assert.match(shell, /lg:grid-cols-\[264px_minmax\(0,1fr\)\]/);
  assert.match(shell, /aria-label="Abrir menu"/);
  assert.match(shell, /aria-label="Selecionar loja"/);
  assert.match(shell, /aria-label="Sair"/);
  assert.match(shell, /aria-label=\{`Notificações \(\$\{total\}\)`\}/);
  assert.match(shell, /pb-\[calc\(2\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test("telas afetadas possuem estados explícitos de carregamento, vazio e erro", () => {
  const fontes = [
    ler("src/features/painel/components/page-view.tsx"),
    ler("src/features/estoque/components/catalogo-view.tsx"),
    ler("src/features/clientes/components/page-view.tsx"),
    ler("src/features/financeiro/components/page-view.tsx"),
  ].join("\n");
  assert.match(fontes, /role="alert"/);
  assert.match(fontes, /Carregando/);
  assert.match(fontes, /Nenhum|Sem despesas/);
  assert.doesNotMatch(fontes, /Design Teste|Interface em integração/);
});

test("erro global não depende do shell nem do contexto de lojas", () => {
  const globalError = ler("src/app/global-error.tsx");
  assert.match(globalError, /<html lang="pt-BR">/);
  assert.match(globalError, /<body/);
  assert.match(globalError, /role="alert"/);
  assert.match(globalError, /Tentar novamente/);
  assert.doesNotMatch(globalError, /AppShell|useWorkspace|WorkspaceProvider/);
  const erroDeRota = ler("src/app/error.tsx");
  assert.match(erroDeRota, /<WorkspaceProvider>/);
  assert.match(erroDeRota, /<AppShell/);
  const shell = ler("src/components/app-shell.tsx");
  assert.match(shell, /useWorkspaceOpcional/);
});
