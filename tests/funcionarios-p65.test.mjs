import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const ler = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8");
function compilar(fonte, extras = {}) {
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports, ...extras });
  return modulo.exports;
}

const dominio = compilar(ler("../src/features/equipe/dominio/funcionario.ts"));
const LOJA_1 = "11111111-1111-4111-8111-111111111111";
const LOJA_2 = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";

test("funcionário aceita somente vendedor, e-mail válido e ao menos uma loja", () => {
  const pessoa = dominio.validarNovoFuncionario({ nome: "  Maria   Silva ", email: " MARIA@EXAMPLE.COM ",
    lojas: [LOJA_1, LOJA_1, LOJA_2] });
  assert.equal(pessoa.nome, "Maria Silva");
  assert.equal(pessoa.email, "maria@example.com");
  assert.deepEqual([...pessoa.lojas], [LOJA_1, LOJA_2]);
  assert.throws(() => dominio.validarNovoFuncionario({ ...pessoa, perfil: "administrador" }), /vendedor/);
  assert.throws(() => dominio.validarNovoFuncionario({ ...pessoa, lojas: [] }), /loja/);
  assert.throws(() => dominio.validarEdicaoFuncionario({ ...pessoa, id: "invalido" }), /Funcionário/);
});

function carregarCognito(enviar, configuracoes = []) {
  return compilar(ler("../src/integrations/server/cognito-admin.ts"), {
    process: { env: { COGNITO_REGION: "us-east-1", COGNITO_USER_POOL_ID: "us-east-1_Jm4EQEGdZ" } },
    require(nome) {
      if (nome === "server-only") return {};
      if (nome === "@aws-sdk/client-cognito-identity-provider") return new Proxy({}, { get(_alvo, propriedade) {
        if (propriedade === "CognitoIdentityProviderClient") return class {
          constructor(configuracao) { configuracoes.push(configuracao); }
          send(comando) { return enviar(comando); }
        };
        return class { constructor(input) { this.input = input; this.tipo = propriedade; } };
      } });
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
}

test("admin Cognito usa cadeia padrão e somente os comandos autorizados", async () => {
  const comandos = []; const configuracoes = [];
  const cognito = carregarCognito(async (comando) => {
    comandos.push(comando);
    if (comando.tipo === "AdminCreateUserCommand" && comando.input.MessageAction !== "RESEND")
      return { User: { Username: "maria@example.com", Attributes: [{ Name: "sub", Value: "sub-1" }] } };
    if (comando.tipo === "AdminGetUserCommand")
      return { Username: "maria@example.com", UserAttributes: [{ Name: "email", Value: "maria@example.com" }] };
    return {};
  }, configuracoes);
  await cognito.criarContaFuncionario("Maria", "maria@example.com");
  await cognito.editarContaFuncionario("sub-1", "Maria S.", "maria@example.com");
  await cognito.ativarContaFuncionario("sub-1");
  await cognito.bloquearContaFuncionario("sub-1");
  await cognito.reenviarConviteFuncionario("sub-1");
  await cognito.excluirContaIncompleta("maria@example.com");
  assert.deepEqual(JSON.parse(JSON.stringify(configuracoes)), [{ region: "us-east-1" }]);
  assert.deepEqual(comandos.map((item) => item.tipo), [
    "AdminCreateUserCommand", "AdminUpdateUserAttributesCommand", "AdminEnableUserCommand",
    "AdminDisableUserCommand", "AdminUserGlobalSignOutCommand", "AdminGetUserCommand",
    "AdminCreateUserCommand", "AdminDeleteUserCommand",
  ]);
  assert.equal(comandos[6].input.MessageAction, "RESEND");
  assert.equal(comandos[0].input.TemporaryPassword, undefined);
  assert.ok(comandos[1].input.UserAttributes.some((item) =>
    item.Name === "email_verified" && item.Value === "true"));
});

test("falha Cognito é sanitizada e configuração divergente falha fechada", async () => {
  await assert.rejects(carregarCognito(async () => { throw new Error("segredo AWS"); })
    .criarContaFuncionario("Maria", "maria@example.com"), (erro) => !erro.message.includes("segredo AWS"));
  const fonte = ler("../src/integrations/server/cognito-admin.ts");
  assert.doesNotMatch(fonte, /AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|credentials\s*:/);
  assert.match(fonte, /new CognitoIdentityProviderClient\(\{ region: REGIAO \}\)/);
});

test("persistência protege administrador, restringe lojas e compensa criação incompleta", () => {
  const servidor = ler("../src/features/equipe/server/funcionarios.ts");
  assert.match(servidor, /u\.perfil = 'vendedor'/);
  assert.match(servidor, /autorizadas\.includes\(loja\)/);
  assert.match(servidor, /INSERT INTO public\.usuarios[\s\S]*'vendedor', true/);
  assert.match(servidor, /ON CONFLICT \(usuario_id, loja_id\) DO UPDATE SET ativo = true/);
  assert.match(servidor, /excluirContaIncompleta\(conta\.usuario\)/);
  assert.match(servidor, /repetida: true/);
  assert.doesNotMatch(servidor, /DELETE FROM public\.(usuarios|usuarios_lojas)/);
  assert.ok(servidor.indexOf("SET ativo = false WHERE id = $1") < servidor.indexOf("bloquearContaFuncionario(alvo.sub_cognito)"));
});

test("API autoriza no servidor e UI entrega todo o fluxo sem senha humana", () => {
  const api = ler("../src/app/api/funcionarios/route.ts");
  const ui = ler("../src/features/equipe/components/funcionarios-painel.tsx");
  const pagina = ler("../src/app/colaboradores/page.tsx");
  assert.match(api, /autorizarAcao\("equipe\.gerir"\)/);
  assert.match(api, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.match(pagina, /exigirPaginaAutorizada\("equipe\.consultar"\)/);
  for (const texto of ["Novo funcionário", "Reenviar convite", "Bloquear", "Ativar", "Lojas liberadas"])
    assert.match(ui, new RegExp(texto));
  assert.match(ui, /Nenhuma senha é armazenada no PH/);
  assert.doesNotMatch(ui, /type="password"|TemporaryPassword|AWS_ACCESS_KEY/);
  assert.match(ui, /await carregar\(\)/);
});
