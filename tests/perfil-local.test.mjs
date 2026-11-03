import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const codigo = readFileSync(
  new URL("../src/features/acesso/server/perfil-local.ts", import.meta.url),
  "utf8",
);
const compilado = ts.transpileModule(codigo, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const modulo = { exports: {} };
runInNewContext(compilado, {
  module: modulo,
  exports: modulo.exports,
  require(nome) {
    if (nome === "server-only") return {};
    if (nome === "@/integrations/server/postgres-client") {
      return { comClienteBanco: async (executar) => executar(clienteFalso) };
    }
    throw new Error(`Dependência inesperada no teste: ${nome}`);
  },
});

let clienteFalso;
const identidade = {
  emissor: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXEMPLO",
  sub: "sub-sintetico",
};

test("perfil local usa issuer/sub parametrizados e somente usuário e lojas ativos", async () => {
  let consulta;
  clienteFalso = {
    async consultar(recebida) {
      consulta = recebida;
      return {
        rows: [{
          id: "id-local",
          nome_exibicao: "Pessoa sintética",
          perfil: "vendedor",
          lojas: ["loja-ativa"],
        }],
      };
    },
  };
  const perfil = await modulo.exports.obterPerfilLocal(identidade);
  assert.deepEqual(JSON.parse(JSON.stringify(perfil)), {
    id: "id-local",
    nome: "Pessoa sintética",
    perfil: "vendedor",
    lojas: ["loja-ativa"],
  });
  assert.deepEqual([...consulta.parametros], [identidade.emissor, identidade.sub]);
  assert.match(consulta.texto, /u\.emissor_cognito = \$1 AND u\.sub_cognito = \$2 AND u\.ativo = true/);
  assert.match(consulta.texto, /ul\.ativo = true/);
  assert.match(consulta.texto, /l\.ativa = true/);
  assert.doesNotMatch(consulta.texto, /\$\{.*\}/);
});

test("identidade sem vínculo ou inativa não recebe perfil; identidade vazia não consulta banco", async () => {
  let consultas = 0;
  clienteFalso = {
    async consultar() {
      consultas += 1;
      return { rows: [] };
    },
  };
  assert.equal(await modulo.exports.obterPerfilLocal(identidade), null);
  assert.equal(await modulo.exports.obterPerfilLocal({ emissor: "", sub: identidade.sub }), null);
  assert.equal(await modulo.exports.obterPerfilLocal({ emissor: identidade.emissor, sub: " " }), null);
  assert.equal(consultas, 1);
});
