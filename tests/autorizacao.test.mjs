import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregar(caminho, dependencias = {}) {
  const fonte = readFileSync(new URL(caminho, import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports, require(nome) {
    if (nome === "server-only") return {};
    if (Object.hasOwn(dependencias, nome)) return dependencias[nome];
    throw new Error(`Dependência inesperada: ${nome}`);
  } });
  return modulo.exports;
}

const politica = carregar("../src/features/acesso/politica.ts");
const admin = { id: "admin", perfil: "administrador", lojas: ["loja-1"] };
const vendedor = { id: "vendedor", perfil: "vendedor", lojas: ["loja-1"] };

test("anônimo e vendedor não entram em operações administrativas, mesmo trocando IDs", () => {
  for (const perfil of [null, vendedor]) {
    for (const acao of ["painel.consultar", "estoque.consultar", "estoque.gerir",
      "vendas.registrar", "impressao.executar", "equipe.gerir", "metas.gerir"])
      assert.equal(politica.podeAcessar(perfil, acao, { lojaId: "loja-1" }), false);
  }
  assert.equal(politica.podeAcessar(vendedor, "metas.proprias.consultar", {}), true);
  assert.equal(politica.podeAcessar(vendedor, "metas.proprias.consultar", { usuarioId: "colega" }), false);
  assert.equal(politica.podeAcessar(vendedor, "metas.proprias.consultar", { lojaId: "loja-1" }), false);
  assert.throws(() => politica.autorizar(vendedor, "metas.proprias.consultar", { usuarioId: "colega" }),
    (erro) => erro.name === "AcessoNegado");
});

test("admin respeita loja vinculada e acessa clientes/financeiro; vendedor permanece negado", () => {
  assert.equal(politica.podeAcessar(admin, "estoque.consultar", { lojaId: "loja-1" }), true);
  assert.equal(politica.podeAcessar(admin, "estoque.consultar", { lojaId: "loja-2" }), false);
  assert.equal(politica.podeAcessar(admin, "estoque.consultar", { todas: true }), true);
  assert.equal(politica.podeAcessar(admin, "estoque.gerir", { todas: true }), false);
  assert.equal(politica.podeAcessar(admin, "estoque.gerir", { lojaId: "loja-1" }), true);
  assert.equal(politica.podeAcessar(admin, "estoque.gerir", { lojaId: "loja-2" }), false);
  assert.equal(politica.podeAcessar(admin, "estoque.consultar", { todas: true, lojaId: "loja-1" }), false);
  assert.equal(politica.podeAcessar(admin, "clientes.consultar", { todas: true }), true);
  assert.equal(politica.podeAcessar(admin, "clientes.gerir", {}), true);
  assert.equal(politica.podeAcessar(admin, "financeiro.consultar", { todas: true }), true);
  assert.equal(politica.podeAcessar(admin, "financeiro.gerir", { lojaId: "loja-1" }), true);
  assert.equal(politica.podeAcessar(admin, "financeiro.gerir", { todas: true }), false);
  assert.equal(politica.podeAcessar(vendedor, "clientes.consultar", { todas: true }), false);
  assert.equal(politica.podeAcessar(vendedor, "financeiro.consultar", { todas: true }), false);
  assert.equal(politica.podeAcessar({ ...admin, lojas: [] }, "painel.consultar", { todas: true }), false);
  assert.equal(politica.podeAcessar(admin, "equipe.consultar", {}), true);
  assert.equal(politica.podeAcessar(admin, "equipe.gerir", { usuarioId: "outro-projeto" }), false);
});

test("entrada de API/action chama sessão do servidor; páginas e menu usam a mesma política", async () => {
  let atual = vendedor;
  const entrada = carregar("../src/features/acesso/server/autorizar.ts", {
    "./sessao": { obterSessao: async () => atual },
    "../politica": politica,
    "next/navigation": { redirect: (alvo) => { throw new Error(`redirect:${alvo}`); } },
  });
  await assert.rejects(entrada.autorizarAcao("vendas.consultar", { todas: true }),
    (erro) => erro.name === "AcessoNegado");
  await assert.rejects(entrada.exigirPaginaAutorizada("vendas.consultar", { todas: true }), /redirect:\/acesso-negado/);
  atual = admin;
  assert.equal((await entrada.autorizarAcao("estoque.consultar", { lojaId: "loja-1" })).id, "admin");
  await assert.rejects(entrada.autorizarAcao("estoque.consultar", { lojaId: "loja-2" }),
    (erro) => erro.name === "AcessoNegado");
  atual = null;
  await assert.rejects(entrada.autorizarAcao("equipe.consultar"), (erro) => erro.name === "AcessoNegado");

  const menu = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
  assert.match(menu, /filter\(\(item\) => podeAcessar\(/);
  for (const [pagina, acao] of [["page.tsx", "painel.consultar"], ["vendas/page.tsx", "vendas.consultar"],
    ["estoque/page.tsx", "estoque.consultar"], ["colaboradores/page.tsx", "equipe.consultar"],
    ["meu-desempenho/page.tsx", "metas.proprias.consultar"],
    ["clientes/page.tsx", "clientes.consultar"], ["financeiro/page.tsx", "financeiro.consultar"]]) {
    const fonte = readFileSync(new URL(`../src/app/${pagina}`, import.meta.url), "utf8");
    assert.ok(fonte.includes(`exigirPaginaAutorizada("${acao}"`), pagina);
  }
});
