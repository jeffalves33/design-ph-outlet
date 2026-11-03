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

test("sessão exige access token, refresh íntegro, token ativo e vínculo local vigente", async () => {
  let tokenAtivo = true;
  let perfil = { id: "usuario-a", nome: "Pessoa", perfil: "administrador", lojas: ["loja-a"] };
  const valores = new Map([["ph_acesso", "access"], ["ph_renovacao", "refresh-protegido"]]);
  const sessao = carregar("../src/features/acesso/server/sessao.ts", {
    "next/headers": { cookies: async () => ({ get: (nome) => valores.has(nome) ? { value: valores.get(nome) } : undefined }) },
    "./perfil-local": { obterPerfilLocal: async () => perfil },
    "@/integrations/server/cognito": {
      verificarToken: async (token) => {
        if (token !== "access") throw new Error("token inválido");
        return { emissor: "emissor", sub: "sub" };
      },
      conferirTokenAtivo: async () => { if (!tokenAtivo) throw new Error("revogado"); },
      renovarTokens: async () => ({ AccessToken: "access", ExpiresIn: 3600 }),
    },
    "./refresh-cookie": {
      COOKIE_RENOVACAO: "ph_renovacao",
      abrirRenovacao: (valor) => {
        if (valor !== "refresh-protegido") throw new Error("refresh inválido");
        return { token: "refresh", expiraEm: Date.now() + 86_400_000 };
      },
      protegerRenovacao: () => "refresh-protegido",
      duracaoCookieRenovacao: () => 3600,
    },
  });

  assert.equal((await sessao.obterSessao()).id, "usuario-a");
  perfil = null;
  assert.equal(await sessao.obterSessao(), null);
  perfil = { id: "usuario-a", nome: "Pessoa", perfil: "administrador", lojas: ["loja-a"] };
  tokenAtivo = false;
  assert.equal(await sessao.obterSessao(), null);
  tokenAtivo = true;
  valores.set("ph_renovacao", "adulterado");
  assert.equal(await sessao.obterSessao(), null);
});

test("renovação não recria sessão quando o vínculo local foi revogado", async () => {
  const sessao = carregar("../src/features/acesso/server/sessao.ts", {
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "./perfil-local": { obterPerfilLocal: async () => null },
    "@/integrations/server/cognito": {
      renovarTokens: async () => ({ AccessToken: "novo-access", ExpiresIn: 3600 }),
      verificarToken: async () => ({ emissor: "emissor", sub: "sub" }),
      conferirTokenAtivo: async () => {},
    },
    "./refresh-cookie": {
      COOKIE_RENOVACAO: "ph_renovacao",
      abrirRenovacao: () => ({ token: "refresh", expiraEm: Date.now() + 86_400_000 }),
      protegerRenovacao: () => "protegido",
      duracaoCookieRenovacao: () => 3600,
    },
  });
  await assert.rejects(sessao.renovarSessao("protegido"), /Sessão inválida/);
});

test("falhas do PostgreSQL são sanitizadas e a conexão sempre é liberada", async () => {
  const indisponivel = carregar("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": { obterPool: () => ({ connect: async () => {
      const erro = new Error("host privado"); erro.code = "ECONNREFUSED"; throw erro;
    } }) },
  });
  await assert.rejects(indisponivel.comClienteBanco(async () => null),
    (erro) => erro.name === "ErroBanco" && erro.tipo === "indisponivel" && !erro.message.includes("host privado"));

  let liberacoes = 0;
  const falha = carregar("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": { obterPool: () => ({ connect: async () => ({
      query: async () => { const erro = new Error("SQL e dado privados"); erro.code = "XX000"; throw erro; },
      release: () => { liberacoes += 1; },
    }) }) },
  });
  await assert.rejects(falha.comClienteBanco((cliente) => cliente.consultar({ texto: "SELECT $1", parametros: ["x"] })),
    (erro) => erro.name === "ErroBanco" && erro.tipo === "falha" && !erro.message.includes("privados"));
  assert.equal(liberacoes, 1);
});

test("APIs mutáveis exigem autorização server-side, mesma origem, JSON limitado e resposta sem cache", () => {
  const rotas = [
    "../src/app/api/catalogo/route.ts",
    "../src/app/api/clientes/route.ts",
    "../src/app/api/estoque/movimentos/route.ts",
    "../src/app/api/financeiro/route.ts",
    "../src/app/api/metas/route.ts",
    "../src/app/api/vendas/route.ts",
  ];
  for (const rota of rotas) {
    const fonte = readFileSync(new URL(rota, import.meta.url), "utf8");
    assert.match(fonte, /autorizarAcao\(/, rota);
    assert.match(fonte, /headers\.get\("origin"\)/, rota);
    assert.match(fonte, /application\/json/, rota);
    assert.match(fonte, /texto\.length > [\d_]+/, rota);
    assert.match(fonte, /Cache-Control["']?:?\s*["']no-store/, rota);
    assert.match(fonte, /503/, rota);
    assert.doesNotMatch(fonte, /erro\.stack|String\(erro\)|JSON\.stringify\(erro\)/, rota);
  }
});

test("bloqueios de loja, pessoa, adulteração e reenvio permanecem cobertos no backend", () => {
  const politica = readFileSync(new URL("../tests/autorizacao.test.mjs", import.meta.url), "utf8");
  const estoque = readFileSync(new URL("../tests/estoque-p32.test.mjs", import.meta.url), "utf8");
  const venda = readFileSync(new URL("../tests/vendas-p43.test.mjs", import.meta.url), "utf8");
  const renovacao = readFileSync(new URL("../tests/renovacao-sessao.test.mjs", import.meta.url), "utf8");
  assert.match(politica, /loja-2/);
  assert.match(politica, /usuarioId: "colega"/);
  assert.match(estoque, /mesma chave com payload diferente gera conflito/);
  assert.match(venda, /mesma chave e payload devolve a venda sem nova baixa/);
  assert.match(venda, /payload diferente conflita/);
  assert.match(renovacao, /revogado/);
});
