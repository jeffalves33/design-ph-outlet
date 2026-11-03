import "server-only";
import { cookies } from "next/headers";
import { obterPerfilLocal } from "./perfil-local";
import { conferirTokenAtivo, verificarToken } from "@/integrations/server/cognito";
import { renovarTokens } from "@/integrations/server/cognito";
import { abrirRenovacao, protegerRenovacao, duracaoCookieRenovacao, COOKIE_RENOVACAO } from "./refresh-cookie";

export const COOKIE_ACESSO = "ph_acesso";
export const COOKIE_DESAFIO = "ph_desafio";

export async function temRenovacao() {
  return Boolean((await cookies()).get(COOKIE_RENOVACAO)?.value);
}

export async function obterSessao() {
  const armazenamento = await cookies();
  const token = armazenamento.get(COOKIE_ACESSO)?.value;
  const protegido = armazenamento.get(COOKIE_RENOVACAO)?.value;
  if (!token || !protegido) return null;
  try {
    abrirRenovacao(protegido);
    const identidade = await verificarToken(token);
    await conferirTokenAtivo(token);
    return await obterPerfilLocal(identidade);
  } catch { return null; }
}

/** Chamado apenas em route handler, que pode emitir novos cookies na resposta. */
export async function renovarSessao(cookieProtegido: string) {
  const anterior = abrirRenovacao(cookieProtegido);
  const resultado = await renovarTokens(anterior.token);
  const acesso = resultado.AccessToken;
  if (!acesso) throw new Error("Sessão inválida.");
  const identidade = await verificarToken(acesso);
  await conferirTokenAtivo(acesso);
  const perfil = await obterPerfilLocal(identidade);
  if (!perfil) throw new Error("Sessão inválida.");
  const tokenRenovacao = resultado.RefreshToken ?? anterior.token;
  return {
    acesso,
    duracaoAcesso: resultado.ExpiresIn ?? 3600,
    renovacaoProtegida: protegerRenovacao(tokenRenovacao, anterior.expiraEm),
    duracaoRenovacao: duracaoCookieRenovacao(anterior.expiraEm),
    perfil,
  };
}
