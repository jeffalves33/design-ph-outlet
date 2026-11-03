import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregarModulo(arquivo, dependencias = {}, contexto = {}) {
  const codigo = readFileSync(new URL(arquivo, import.meta.url), "utf8");
  const compilado = ts.transpileModule(codigo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  runInNewContext(compilado, {
    module: modulo,
    exports: modulo.exports,
    URL,
    console,
    ...contexto,
    require(nome) {
      if (nome === "server-only") return {};
      if (Object.hasOwn(dependencias, nome)) return dependencias[nome];
      throw new Error(`Dependência inesperada no teste: ${nome}`);
    },
  });
  return modulo.exports;
}

const configuracao = carregarModulo("../src/integrations/server/postgres-config.ts");
const urlSintetica =
  "postgresql://prodexy_ph_outlet_app:senha-sintetica@db01.prodexylabs.com:5432/prodexy_ph_outlet";

test("configuração exige destino PH, TLS validado e máximo de um cliente", () => {
  const config = configuracao.criarConfiguracaoPool(urlSintetica);
  assert.equal(config.host, "db01.prodexylabs.com");
  assert.equal(config.database, "prodexy_ph_outlet");
  assert.equal(config.user, "prodexy_ph_outlet_app");
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, "db01.prodexylabs.com");
  assert.equal(config.max, 1);
  assert.ok(config.connectionTimeoutMillis > 0);
  assert.ok(config.query_timeout > 0);
  assert.equal("connectionString" in config, false);
});

test("URL fora do contrato ou opções SSL na query são rejeitadas sem revelar segredo", () => {
  for (const url of [
    undefined,
    urlSintetica.replace("db01.prodexylabs.com", "outro.example"),
    urlSintetica.replace("prodexy_ph_outlet_app", "postgres"),
    `${urlSintetica}?sslmode=disable`,
    urlSintetica.replace("senha-sintetica", ""),
  ]) {
    assert.throws(
      () => configuracao.criarConfiguracaoPool(url),
      (erro) => !erro.message.includes("senha-sintetica") && erro.name === "ConfiguracaoBancoInvalida",
    );
  }
});

test("pool é criado uma vez e anexado ao Fluid Compute quando VERCEL=1", () => {
  let anexos = 0;
  let construcoes = 0;
  class PoolFalso {
    constructor(config) {
      construcoes += 1;
      this.config = config;
    }
    on(evento) {
      assert.equal(evento, "error");
    }
  }
  const modulo = carregarModulo(
    "../src/integrations/server/postgres-pool.ts",
    {
      "./postgres-config": configuracao,
      "@vercel/functions": { attachDatabasePool: () => { anexos += 1; } },
      pg: { Pool: PoolFalso },
    },
    { process: { env: { DATABASE_URL: urlSintetica, VERCEL: "1" } } },
  );
  const primeiro = modulo.obterPool();
  assert.strictEqual(modulo.obterPool(), primeiro);
  assert.equal(primeiro.config.max, 1);
  assert.equal(construcoes, 1);
  assert.equal(anexos, 1);
});

test("consulta mantém SQL e parâmetros separados e libera cliente no sucesso", async () => {
  let liberacoes = 0;
  let recebido;
  const cliente = {
    async query(consulta) {
      recebido = consulta;
      return { rows: [{ numero: 7 }] };
    },
    release() { liberacoes += 1; },
  };
  const modulo = carregarModulo("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": { obterPool: () => ({ connect: async () => cliente }) },
  });
  const linhas = await modulo.comClienteBanco(async (banco) => {
    const resultado = await banco.consultar({ texto: "SELECT $1::int AS numero", parametros: [7] });
    return resultado.rows;
  });
  assert.equal(linhas[0].numero, 7);
  assert.equal(recebido.text, "SELECT $1::int AS numero");
  assert.deepEqual([...recebido.values], [7]);
  assert.equal(liberacoes, 1);
});

test("falha de consulta é sanitizada e cliente é liberado", async () => {
  let liberacoes = 0;
  const cliente = {
    async query() {
      throw Object.assign(new Error("SQL e credencial privados"), { code: "23505" });
    },
    release() { liberacoes += 1; },
  };
  const modulo = carregarModulo("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": { obterPool: () => ({ connect: async () => cliente }) },
  });
  await assert.rejects(
    modulo.comClienteBanco((banco) => banco.consultar({ texto: "SELECT $1", parametros: [1] })),
    (erro) => erro.tipo === "conflito" && !erro.message.includes("credencial"),
  );
  assert.equal(liberacoes, 1);
});

test("falha de aquisição não expõe detalhe interno; callback falho libera cliente", async () => {
  const semConexao = carregarModulo("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": {
      obterPool: () => ({
        connect: async () => { throw Object.assign(new Error("host privado"), { code: "ECONNREFUSED" }); },
      }),
    },
  });
  await assert.rejects(
    semConexao.comClienteBanco(async () => undefined),
    (erro) => erro.tipo === "indisponivel" && !erro.message.includes("host privado"),
  );

  let liberado = false;
  const falhaCallback = carregarModulo("../src/integrations/server/postgres-client.ts", {
    "./postgres-pool": {
      obterPool: () => ({ connect: async () => ({ release: () => { liberado = true; } }) }),
    },
  });
  const erroDominio = new Error("falha de domínio sintética");
  await assert.rejects(falhaCallback.comClienteBanco(async () => { throw erroDominio; }), erroDominio);
  assert.equal(liberado, true);
});
