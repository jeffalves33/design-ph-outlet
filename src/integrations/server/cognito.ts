import "server-only";
import {
  CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand,
  ForgotPasswordCommand, ConfirmForgotPasswordCommand, GlobalSignOutCommand,
  RevokeTokenCommand, GetUserCommand,
  AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand,
  GetTokensFromRefreshTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const REGIAO = "us-east-1";
const POOL = "us-east-1_Jm4EQEGdZ";
const CLIENTE = "4ia9j9rb19t0qqncadeugjqu9e";
const EMISSOR = `https://cognito-idp.${REGIAO}.amazonaws.com/${POOL}`;

export class ErroAcesso extends Error {
  constructor() {
    super("Não foi possível confirmar o acesso. Confira os dados e tente novamente.");
    this.name = "ErroAcesso";
  }
}

function conferirConfiguracao() {
  if (
    process.env["COGNITO_REGION"] !== REGIAO ||
    process.env["COGNITO_USER_POOL_ID"] !== POOL ||
    process.env["COGNITO_CLIENT_ID"] !== CLIENTE ||
    process.env["COGNITO_ISSUER"] !== EMISSOR
  ) throw new ErroAcesso();
}

let provedor: CognitoIdentityProviderClient | undefined;
function cliente() {
  conferirConfiguracao();
  return (provedor ??= new CognitoIdentityProviderClient({ region: REGIAO }));
}

const verificador = CognitoJwtVerifier.create({ userPoolId: POOL, clientId: CLIENTE, tokenUse: "access" });

export async function verificarToken(token: string) {
  conferirConfiguracao();
  try {
    const claims = await verificador.verify(token);
    if (claims.iss !== EMISSOR || !claims.sub) throw new ErroAcesso();
    return { emissor: claims.iss, sub: claims.sub };
  } catch { throw new ErroAcesso(); }
}

export async function autenticar(usuario: string, senha: string) {
  try {
    return await cliente().send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH", ClientId: CLIENTE,
      AuthParameters: { USERNAME: usuario, PASSWORD: senha },
    }));
  } catch { throw new ErroAcesso(); }
}

export async function responderDesafio(
  desafio: "NEW_PASSWORD_REQUIRED" | "SOFTWARE_TOKEN_MFA" | "SMS_MFA" | "EMAIL_OTP",
  usuario: string, sessao: string, resposta: string,
) {
  const chave = desafio === "NEW_PASSWORD_REQUIRED" ? "NEW_PASSWORD" :
    desafio === "SOFTWARE_TOKEN_MFA" ? "SOFTWARE_TOKEN_MFA_CODE" :
    desafio === "SMS_MFA" ? "SMS_MFA_CODE" : "EMAIL_OTP_CODE";
  try {
    return await cliente().send(new RespondToAuthChallengeCommand({
      ClientId: CLIENTE, ChallengeName: desafio, Session: sessao,
      ChallengeResponses: { USERNAME: usuario, [chave]: resposta },
    }));
  } catch { throw new ErroAcesso(); }
}

export async function iniciarRecuperacao(usuario: string) {
  const provedor = cliente();
  try { await provedor.send(new ForgotPasswordCommand({ ClientId: CLIENTE, Username: usuario })); }
  catch { /* Não revelar existência da conta. */ }
}

export async function concluirRecuperacao(usuario: string, codigo: string, senha: string) {
  try {
    await cliente().send(new ConfirmForgotPasswordCommand({
      ClientId: CLIENTE, Username: usuario, ConfirmationCode: codigo, Password: senha,
    }));
  } catch { throw new ErroAcesso(); }
}

export async function conferirTokenAtivo(token: string) {
  try { await cliente().send(new GetUserCommand({ AccessToken: token })); }
  catch { throw new ErroAcesso(); }
}

export async function encerrarTokens(acesso?: string, renovacao?: string) {
  let revogado = false;
  if (acesso) {
    try { await cliente().send(new GlobalSignOutCommand({ AccessToken: acesso })); revogado = true; }
    catch { /* Tentar revogar refresh. */ }
  }
  if (renovacao) {
    try { await cliente().send(new RevokeTokenCommand({ ClientId: CLIENTE, Token: renovacao })); revogado = true; }
    catch { /* A falha será comunicada abaixo. */ }
  }
  if ((acesso || renovacao) && !revogado) throw new ErroAcesso();
}

export async function renovarTokens(renovacao: string) {
  try {
    const resultado = await cliente().send(new GetTokensFromRefreshTokenCommand({
      ClientId: CLIENTE, RefreshToken: renovacao,
    }));
    if (!resultado.AuthenticationResult?.AccessToken) throw new ErroAcesso();
    return resultado.AuthenticationResult;
  } catch { throw new ErroAcesso(); }
}

export async function iniciarTotp(sessao: string) {
  try {
    const resultado = await cliente().send(new AssociateSoftwareTokenCommand({ Session: sessao }));
    if (!resultado.SecretCode || !resultado.Session) throw new ErroAcesso();
    return { segredo: resultado.SecretCode, sessao: resultado.Session };
  } catch { throw new ErroAcesso(); }
}

export async function confirmarTotp(sessao: string, codigo: string, usuario: string) {
  try {
    const verificado = await cliente().send(new VerifySoftwareTokenCommand({ Session: sessao, UserCode: codigo }));
    if (verificado.Status !== "SUCCESS" || !verificado.Session) throw new ErroAcesso();
    return await cliente().send(new RespondToAuthChallengeCommand({
      ClientId: CLIENTE, ChallengeName: "MFA_SETUP", Session: verificado.Session,
      ChallengeResponses: { USERNAME: usuario },
    }));
  } catch { throw new ErroAcesso(); }
}

