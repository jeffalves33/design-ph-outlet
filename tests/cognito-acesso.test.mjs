import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const fonte = readFileSync(new URL("../src/integrations/server/cognito.ts", import.meta.url), "utf8");
const rota = readFileSync(new URL("../src/app/api/acesso/route.ts", import.meta.url), "utf8");
const cookies = readFileSync(new URL("../src/features/acesso/server/cookies-sessao.ts", import.meta.url), "utf8");
const compilado = ts.transpileModule(fonte, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const ambiente = { COGNITO_REGION: "us-east-1", COGNITO_USER_POOL_ID: "us-east-1_Jm4EQEGdZ",
  COGNITO_CLIENT_ID: "4ia9j9rb19t0qqncadeugjqu9e",
  COGNITO_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Jm4EQEGdZ" };

function carregar({ env = ambiente, verificar = async () => ({ iss: ambiente.COGNITO_ISSUER, sub: "sub-teste" }),
  enviar = async () => ({}) } = {}) {
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    module: modulo, exports: modulo.exports, process: { env },
    require(nome) {
      if (nome === "server-only") return {};
      if (nome === "aws-jwt-verify") return { CognitoJwtVerifier: { create(config) {
        assert.equal(config.tokenUse, "access");
        assert.equal(config.clientId, ambiente.COGNITO_CLIENT_ID);
        return { verify: verificar };
      } } };
      if (nome === "@aws-sdk/client-cognito-identity-provider") return new Proxy({}, { get(_alvo, propriedade) {
        if (propriedade === "CognitoIdentityProviderClient") return class { send(comando) { return enviar(comando); } };
        return class { constructor(input) { this.input = input; this.tipo = propriedade; } };
      } });
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
  return modulo.exports;
}

test("somente configuração PH e JWT access validado dão identidade", async () => {
  const modulo = carregar();
  assert.deepEqual(JSON.parse(JSON.stringify(await modulo.verificarToken("token-sintetico"))),
    { emissor: ambiente.COGNITO_ISSUER, sub: "sub-teste" });
  await assert.rejects(carregar({ env: { ...ambiente, COGNITO_CLIENT_ID: "outro" } }).verificarToken("x"));
  await assert.rejects(carregar({ verificar: async () => ({ iss: "outro", sub: "sub-teste" }) }).verificarToken("x"));
  await assert.rejects(carregar({ verificar: async () => { throw new Error("token privado"); } }).verificarToken("x"),
    (erro) => !erro.message.includes("token privado"));
});

test("login e desafios usam client PH; logout falho não afirma revogação", async () => {
  const comandos = [];
  const modulo = carregar({ enviar: async (comando) => { comandos.push(comando); return {}; } });
  await modulo.autenticar("pessoa@example.test", "senha-sintetica");
  assert.equal(comandos[0].input.AuthFlow, "USER_PASSWORD_AUTH");
  assert.equal(comandos[0].input.ClientId, ambiente.COGNITO_CLIENT_ID);
  await modulo.responderDesafio("SOFTWARE_TOKEN_MFA", "pessoa", "sessao-sintetica", "123456");
  assert.equal(comandos[1].input.ChallengeResponses.SOFTWARE_TOKEN_MFA_CODE, "123456");
  await assert.rejects(carregar({ enviar: async () => { throw new Error("detalhe privado"); } }).encerrarTokens("token"),
    (erro) => !erro.message.includes("detalhe privado"));
});

test("renovação usa App Client PH e revogação contempla refresh token", async () => {
  const comandos = [];
  const modulo = carregar({ enviar: async (comando) => {
    comandos.push(comando);
    return comando.tipo === "GetTokensFromRefreshTokenCommand"
      ? { AuthenticationResult: { AccessToken: "acesso-renovado" } } : {};
  } });
  const resultado = await modulo.renovarTokens("refresh-sintetico");
  assert.equal(resultado.AccessToken, "acesso-renovado");
  assert.equal(comandos[0].input.ClientId, ambiente.COGNITO_CLIENT_ID);
  assert.equal(comandos[0].input.RefreshToken, "refresh-sintetico");
  await modulo.encerrarTokens("acesso-sintetico", "refresh-sintetico");
  assert.ok(comandos.some((comando) => comando.tipo === "RevokeTokenCommand" &&
    comando.input.Token === "refresh-sintetico"));
  await assert.rejects(carregar({ enviar: async () => { throw new Error("privado"); } }).renovarTokens("x"),
    (erro) => !erro.message.includes("privado"));
});

test("rota exige origem e JSON; cookies HttpOnly e páginas operacionais exigem sessão", () => {
  assert.match(rota, /origem === req\.nextUrl\.origin/);
  assert.match(rota, /site === "same-origin"/);
  assert.match(cookies, /httpOnly: true/);
  assert.match(cookies, /sameSite: "strict"/);
  assert.match(cookies, /COOKIE_RENOVACAO/);
  assert.match(rota, /await obterPerfilLocal\(identidade\)/);
  assert.match(rota, /MFA_SETUP/);
  for (const pagina of ["page.tsx", "vendas/page.tsx", "estoque/page.tsx", "clientes/page.tsx",
    "financeiro/page.tsx", "colaboradores/page.tsx", "meu-desempenho/page.tsx"]) {
    const codigo = readFileSync(new URL(`../src/app/${pagina}`, import.meta.url), "utf8");
    assert.match(codigo, /await exigirPaginaAutorizada\(/, pagina);
  }
});
