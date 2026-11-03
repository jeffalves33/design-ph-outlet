import "server-only";
import {
  AdminCreateUserCommand, AdminDeleteUserCommand, AdminDisableUserCommand,
  AdminEnableUserCommand, AdminGetUserCommand, AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand, CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

const REGIAO = "us-east-1";
const POOL = "us-east-1_Jm4EQEGdZ";
export const EMISSOR_COGNITO_PH = `https://cognito-idp.${REGIAO}.amazonaws.com/${POOL}`;

export class ErroCognitoAdministrativo extends Error {
  constructor(message = "Não foi possível concluir a gestão da conta de acesso.") {
    super(message);
    this.name = "ErroCognitoAdministrativo";
  }
}

function conferirConfiguracao() {
  if (process.env["COGNITO_REGION"] !== REGIAO || process.env["COGNITO_USER_POOL_ID"] !== POOL)
    throw new ErroCognitoAdministrativo();
}

let provedor: CognitoIdentityProviderClient | undefined;
function cliente() {
  conferirConfiguracao();
  // Sem credentials explícitas: usa a cadeia padrão server-side do AWS SDK.
  return (provedor ??= new CognitoIdentityProviderClient({ region: REGIAO }));
}

function atributo(atributos: { Name?: string | undefined; Value?: string | undefined }[] | undefined, nome: string) {
  return atributos?.find((item) => item.Name === nome)?.Value;
}

export async function criarContaFuncionario(nome: string, email: string) {
  try {
    const resultado = await cliente().send(new AdminCreateUserCommand({
      UserPoolId: POOL, Username: email,
      UserAttributes: [{ Name: "email", Value: email }, { Name: "email_verified", Value: "true" },
        { Name: "name", Value: nome }],
      DesiredDeliveryMediums: ["EMAIL"],
    }));
    const sub = atributo(resultado.User?.Attributes, "sub");
    const usuario = resultado.User?.Username;
    if (!sub || !usuario) throw new ErroCognitoAdministrativo();
    return { sub, usuario };
  } catch (erro) {
    if (erro instanceof ErroCognitoAdministrativo) throw erro;
    throw new ErroCognitoAdministrativo();
  }
}

export async function obterContaFuncionario(sub: string) {
  try {
    const resultado = await cliente().send(new AdminGetUserCommand({ UserPoolId: POOL, Username: sub }));
    if (!resultado.Username) throw new ErroCognitoAdministrativo();
    return { usuario: resultado.Username,
      email: atributo(resultado.UserAttributes, "email") ?? "",
      nome: atributo(resultado.UserAttributes, "name") ?? "" };
  } catch { throw new ErroCognitoAdministrativo(); }
}

export async function editarContaFuncionario(sub: string, nome: string, email: string) {
  try {
    await cliente().send(new AdminUpdateUserAttributesCommand({
      UserPoolId: POOL, Username: sub,
      UserAttributes: [{ Name: "email", Value: email }, { Name: "email_verified", Value: "true" },
        { Name: "name", Value: nome }],
    }));
  } catch { throw new ErroCognitoAdministrativo(); }
}

export async function ativarContaFuncionario(sub: string) {
  try { await cliente().send(new AdminEnableUserCommand({ UserPoolId: POOL, Username: sub })); }
  catch { throw new ErroCognitoAdministrativo(); }
}

export async function bloquearContaFuncionario(sub: string) {
  try {
    await cliente().send(new AdminDisableUserCommand({ UserPoolId: POOL, Username: sub }));
    await cliente().send(new AdminUserGlobalSignOutCommand({ UserPoolId: POOL, Username: sub }));
  } catch { throw new ErroCognitoAdministrativo("O acesso local foi bloqueado, mas a revogação remota precisa ser repetida."); }
}

export async function reenviarConviteFuncionario(sub: string) {
  const conta = await obterContaFuncionario(sub);
  try {
    await cliente().send(new AdminCreateUserCommand({
      UserPoolId: POOL, Username: conta.usuario, MessageAction: "RESEND",
      DesiredDeliveryMediums: ["EMAIL"],
    }));
  } catch { throw new ErroCognitoAdministrativo("Não foi possível reenviar o convite."); }
}

export async function excluirContaIncompleta(usuario: string) {
  try { await cliente().send(new AdminDeleteUserCommand({ UserPoolId: POOL, Username: usuario })); }
  catch { throw new ErroCognitoAdministrativo("Cadastro local falhou e a compensação da conta incompleta também falhou."); }
}
