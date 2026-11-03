import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const requireNode = createRequire(import.meta.url);

function carregar(arquivo, dependencias = {}, contexto = {}) {
  const fonte = readFileSync(new URL(arquivo, import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports, Buffer, ...contexto,
    require(nome) {
      if (nome === "server-only") return {};
      if (nome === "node:crypto") return requireNode(nome);
      if (Object.hasOwn(dependencias, nome)) return dependencias[nome];
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
  return modulo.exports;
}

test("refresh cookie é cifrado, autenticado, expira e exige chave server-side", () => {
  let agora = 1_000;
  const chave = Buffer.alloc(32, 7).toString("base64");
  const modulo = carregar("../src/features/acesso/server/refresh-cookie.ts", {}, {
    process: { env: { PH_SESSION_ENCRYPTION_KEY: chave } }, Date: { now: () => agora },
  });
  const protegido = modulo.protegerRenovacao("refresh-sintetico", 2_000);
  assert.ok(!protegido.includes("refresh-sintetico"));
  assert.deepEqual(JSON.parse(JSON.stringify(modulo.abrirRenovacao(protegido))),
    { token: "refresh-sintetico", expiraEm: 2_000 });
  const alterado = `${protegido.slice(0, -2)}${protegido.endsWith("AA") ? "BB" : "AA"}`;
  assert.throws(() => modulo.abrirRenovacao(alterado));
  agora = 2_001;
  assert.throws(() => modulo.abrirRenovacao(protegido));
  const semChave = carregar("../src/features/acesso/server/refresh-cookie.ts", {}, {
    process: { env: {} }, Date: { now: () => 1_000 },
  });
  assert.throws(() => semChave.protegerRenovacao("x", 2_000));
});

test("relógio simulado: retorno após 30 dias e janela móvel de até 400 dias", () => {
  const dia = 24 * 60 * 60 * 1000;
  const inicio = Date.UTC(2026, 0, 1);
  let agora = inicio;
  const modulo = carregar("../src/features/acesso/server/refresh-cookie.ts", {}, {
    process: { env: { PH_SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") } },
    Date: { now: () => agora },
  });
  const absoluto = inicio + modulo.PRAZO_RENOVACAO_SEGUNDOS * 1000;
  assert.equal(modulo.PRAZO_RENOVACAO_SEGUNDOS, 3650 * 24 * 60 * 60);
  assert.equal(modulo.duracaoCookieRenovacao(absoluto), 400 * 24 * 60 * 60);
  const primeiraExpiracaoCookie = inicio + modulo.duracaoCookieRenovacao(absoluto) * 1000;
  const protegido = modulo.protegerRenovacao("credencial-sintetica", absoluto);
  agora += 31 * dia;
  assert.equal(modulo.abrirRenovacao(protegido).expiraEm, absoluto);
  assert.equal(modulo.duracaoCookieRenovacao(absoluto), 400 * 24 * 60 * 60);
  agora = inicio + 399 * dia;
  const novaExpiracaoCookie = agora + modulo.duracaoCookieRenovacao(absoluto) * 1000;
  agora = inicio + 401 * dia;
  assert.ok(agora > primeiraExpiracaoCookie);
  assert.ok(agora < novaExpiracaoCookie);
  assert.equal(modulo.abrirRenovacao(protegido).expiraEm, absoluto);
  agora = absoluto - dia;
  assert.equal(modulo.duracaoCookieRenovacao(absoluto), 24 * 60 * 60);
  agora = absoluto;
  assert.throws(() => modulo.abrirRenovacao(protegido));
  assert.throws(() => modulo.duracaoCookieRenovacao(absoluto));
});

test("cookie de renovação nunca solicita mais de 400 dias por emissão", () => {
  const registrados = [];
  const modulo = carregar("../src/features/acesso/server/cookies-sessao.ts", {
    "next/server": {},
    "./sessao": { COOKIE_ACESSO: "ph_acesso", COOKIE_DESAFIO: "ph_desafio" },
    "./refresh-cookie": { COOKIE_RENOVACAO: "ph_renovacao",
      JANELA_COOKIE_RENOVACAO_SEGUNDOS: 400 * 24 * 60 * 60 },
  }, { process: { env: { NODE_ENV: "production" } } });
  const resposta = { cookies: { set: (nome, valor, opcoes) => registrados.push({ nome, valor, ...opcoes }) } };
  modulo.definirCookie(resposta, "ph_renovacao", "cifrado", 3650 * 24 * 60 * 60);
  assert.equal(registrados[0].maxAge, 400 * 24 * 60 * 60);
  assert.equal(registrados[0].httpOnly, true);
  assert.equal(registrados[0].secure, true);
  assert.equal(registrados[0].sameSite, "strict");
});

test("renovação confirma token e vínculo local e preserva expiração original", async () => {
  const vencimento = Date.now() + 60_000;
  let consultas = 0;
  const dependencias = {
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "./perfil-local": { obterPerfilLocal: async () => { consultas += 1; return { id: "usuario-ph", perfil: "vendedor", lojas: [] }; } },
    "@/integrations/server/cognito": {
      renovarTokens: async () => ({ AccessToken: "novo-acesso", RefreshToken: "novo-refresh", ExpiresIn: 1800 }),
      verificarToken: async () => ({ emissor: "issuer-ph", sub: "sub-ph" }),
      conferirTokenAtivo: async () => undefined,
    },
    "./refresh-cookie": {
      COOKIE_RENOVACAO: "ph_renovacao",
      abrirRenovacao: () => ({ token: "refresh-antigo", expiraEm: vencimento }),
      protegerRenovacao: (token, expiraEm) => `${token}:${expiraEm}`,
      duracaoCookieRenovacao: (expiraEm) => Math.floor((expiraEm - Date.now()) / 1000),
    },
  };
  const modulo = carregar("../src/features/acesso/server/sessao.ts", dependencias);
  const sessao = await modulo.renovarSessao("cookie-sintetico");
  assert.equal(sessao.acesso, "novo-acesso");
  assert.equal(sessao.perfil.id, "usuario-ph");
  assert.equal(sessao.renovacaoProtegida, `novo-refresh:${vencimento}`);
  assert.ok(sessao.duracaoRenovacao > 0 && sessao.duracaoRenovacao <= 60);
  assert.equal(consultas, 1);

  const semVinculo = carregar("../src/features/acesso/server/sessao.ts", {
    ...dependencias, "./perfil-local": { obterPerfilLocal: async () => null },
  });
  await assert.rejects(semVinculo.renovarSessao("cookie-sintetico"));
  const falha = carregar("../src/features/acesso/server/sessao.ts", {
    ...dependencias,
    "@/integrations/server/cognito": { renovarTokens: async () => { throw new Error("refresh revogado"); } },
  });
  await assert.rejects(falha.renovarSessao("cookie-sintetico"));
});

test("relógio simulado: sessão continua no dia 8, encerra no vencimento ou revogação", async () => {
  const dia = 24 * 60 * 60 * 1000;
  const inicio = Date.UTC(2026, 0, 1);
  let agora = inicio + 8 * dia;
  let revogado = false;
  const protegidoModulo = carregar("../src/features/acesso/server/refresh-cookie.ts", {}, {
    process: { env: { PH_SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString("base64") } },
    Date: { now: () => agora },
  });
  const absoluto = inicio + protegidoModulo.PRAZO_RENOVACAO_SEGUNDOS * 1000;
  const protegido = protegidoModulo.protegerRenovacao("credencial-sintetica", absoluto);
  const modulo = carregar("../src/features/acesso/server/sessao.ts", {
    "next/headers": { cookies: async () => ({ get: (nome) => ({ value:
      nome === "ph_acesso" ? "acesso-sintetico" : protegido }) }) },
    "./perfil-local": { obterPerfilLocal: async () => ({ id: "usuario-ph" }) },
    "@/integrations/server/cognito": {
      renovarTokens: async () => {
        if (revogado) throw new Error("revogado");
        return { AccessToken: "acesso-renovado", RefreshToken: "refresh-rotacionado", ExpiresIn: 3600 };
      },
      verificarToken: async () => ({ emissor: "issuer-ph", sub: "sub-ph" }),
      conferirTokenAtivo: async () => undefined,
    },
    "./refresh-cookie": protegidoModulo,
  });
  assert.equal((await modulo.obterSessao()).id, "usuario-ph");
  const renovada = await modulo.renovarSessao(protegido);
  assert.equal(renovada.duracaoRenovacao, 400 * 24 * 60 * 60);
  assert.equal(protegidoModulo.abrirRenovacao(renovada.renovacaoProtegida).expiraEm, absoluto);
  revogado = true;
  await assert.rejects(modulo.renovarSessao(protegido));
  revogado = false;
  agora = absoluto;
  assert.equal(await modulo.obterSessao(), null);
  await assert.rejects(modulo.renovarSessao(protegido));
});

test("GET de sessão renova cookie durante uso e limpa na falha de refresh", async () => {
  let perfil = { id: "usuario-ph" };
  let falhar = false;
  const cookiesGravados = [];
  const dependencias = {
    "next/server": { NextResponse: { json: (dados, opcoes) => ({ dados, ...opcoes }) } },
    "@/integrations/server/cognito": {},
    "@/features/acesso/server/perfil-local": {},
    "@/features/acesso/server/sessao": {
      obterSessao: async () => perfil,
      renovarSessao: async () => { if (falhar) throw new Error("revogado");
        return { perfil: { id: "renovado" }, acesso: "novo", duracaoAcesso: 3600,
          renovacaoProtegida: "novo-protegido", duracaoRenovacao: 100 }; },
    },
    "@/features/acesso/server/refresh-cookie": {
      COOKIE_RENOVACAO: "ph_renovacao", abrirRenovacao: () => ({ expiraEm: 123 }),
      duracaoCookieRenovacao: () => 400 * 24 * 60 * 60,
    },
    "@/features/acesso/server/cookies-sessao": {
      definirCookie: (_res, nome, valor, duracao) => cookiesGravados.push({ nome, valor, duracao }),
      gravarSessao: (res, _acesso, _duracaoAcesso, _renovacao, duracao) => ({ ...res, duracao }),
      limparSessao: (res) => ({ ...res, limpa: true }),
    },
  };
  const modulo = carregar("../src/app/api/acesso/route.ts", dependencias);
  const req = { cookies: { get: () => ({ value: "protegido" }) } };
  const ativa = await modulo.GET(req);
  assert.equal(ativa.dados.perfil.id, "usuario-ph");
  assert.deepEqual(cookiesGravados, [{ nome: "ph_renovacao", valor: "protegido", duracao: 400 * 24 * 60 * 60 }]);
  perfil = null;
  const renovada = await modulo.GET(req);
  assert.equal(renovada.duracao, 100);
  falhar = true;
  const negada = await modulo.GET(req);
  assert.equal(negada.status, 401);
  assert.equal(negada.limpa, true);
  const semCookie = await modulo.GET({ cookies: { get: () => undefined } });
  assert.equal(semCookie.status, 401);
  assert.equal(semCookie.limpa, true);
});

test("rotas renovam silenciosamente, limpam na falha e revogam no logout", () => {
  const acesso = readFileSync(new URL("../src/app/api/acesso/route.ts", import.meta.url), "utf8");
  const renovar = readFileSync(new URL("../src/app/api/acesso/renovar/route.ts", import.meta.url), "utf8");
  const entrada = readFileSync(new URL("../src/features/acesso/server/autorizar.ts", import.meta.url), "utf8");
  assert.match(acesso, /await renovarSessao\(protegido\)/);
  assert.match(acesso, /definirCookie\(res, COOKIE_RENOVACAO, protegido, duracaoCookieRenovacao\(expiraEm\)\)/);
  assert.match(acesso, /encerrarTokens\(acesso, refresh\)/);
  assert.match(acesso, /limparSessao\(resposta\(\{ erro: "Sessão expirada/);
  assert.match(renovar, /const DESTINOS = new Set/);
  assert.match(renovar, /gravarSessao\(NextResponse\.redirect\(destino\)/);
  assert.match(renovar, /definirCookie\(res, COOKIE_RENOVACAO, protegido, duracaoCookieRenovacao\(expiraEm\)\)/);
  assert.match(renovar, /limparSessao\(NextResponse\.redirect/);
  assert.match(entrada, /await temRenovacao\(\)/);
});
