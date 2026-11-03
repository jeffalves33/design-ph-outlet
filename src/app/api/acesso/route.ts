import { NextRequest, NextResponse } from "next/server";
import { autenticar, responderDesafio, iniciarRecuperacao, concluirRecuperacao,
  encerrarTokens, verificarToken, conferirTokenAtivo, iniciarTotp, confirmarTotp, ErroAcesso } from "@/integrations/server/cognito";
import { obterPerfilLocal } from "@/features/acesso/server/perfil-local";
import { COOKIE_ACESSO, COOKIE_DESAFIO, obterSessao, renovarSessao } from "@/features/acesso/server/sessao";
import { COOKIE_RENOVACAO, PRAZO_RENOVACAO_SEGUNDOS, abrirRenovacao, protegerRenovacao, duracaoCookieRenovacao } from "@/features/acesso/server/refresh-cookie";
import { definirCookie, gravarSessao, limparSessao } from "@/features/acesso/server/cookies-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Desafio = "NEW_PASSWORD_REQUIRED" | "SOFTWARE_TOKEN_MFA" | "SMS_MFA" | "EMAIL_OTP";
const DESAFIOS = new Set<Desafio>(["NEW_PASSWORD_REQUIRED", "SOFTWARE_TOKEN_MFA", "SMS_MFA", "EMAIL_OTP"]);

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

function origemValida(req: NextRequest) {
  const origem = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  return origem === req.nextUrl.origin && (!site || site === "same-origin");
}

function texto(valor: unknown, limite: number) {
  return typeof valor === "string" && valor.length > 0 && valor.length <= limite ? valor : null;
}

async function concluirLogin(respostaCognito: {
  AuthenticationResult?: { AccessToken?: string | undefined; RefreshToken?: string | undefined; ExpiresIn?: number | undefined } | undefined;
  ChallengeName?: string | undefined; Session?: string | undefined;
}, usuario: string) {
  if (respostaCognito.AuthenticationResult?.AccessToken) {
    const token = respostaCognito.AuthenticationResult.AccessToken;
    const refresh = respostaCognito.AuthenticationResult.RefreshToken;
    if (!refresh) throw new ErroAcesso();
    const identidade = await verificarToken(token);
    await conferirTokenAtivo(token);
    const perfil = await obterPerfilLocal(identidade);
    if (!perfil) throw new ErroAcesso();
    const res = resposta({ estado: "autenticado", perfil });
    const expiraEm = Date.now() + PRAZO_RENOVACAO_SEGUNDOS * 1000;
    return gravarSessao(res, token, respostaCognito.AuthenticationResult.ExpiresIn ?? 3600,
      protegerRenovacao(refresh, expiraEm), duracaoCookieRenovacao(expiraEm));
  }
  if (respostaCognito.ChallengeName === "MFA_SETUP" && respostaCognito.Session) {
    const inicio = await iniciarTotp(respostaCognito.Session);
    const res = resposta({ estado: "desafio", desafio: "MFA_SETUP", segredoTotp: inicio.segredo });
    definirCookie(res, COOKIE_DESAFIO, Buffer.from(JSON.stringify({ usuario, desafio: "MFA_SETUP", sessao: inicio.sessao })).toString("base64url"), 300);
    return res;
  }
  if (respostaCognito.ChallengeName && DESAFIOS.has(respostaCognito.ChallengeName as Desafio) && respostaCognito.Session) {
    const desafio = respostaCognito.ChallengeName as Desafio;
    const res = resposta({ estado: "desafio", desafio });
    definirCookie(res, COOKIE_DESAFIO, Buffer.from(JSON.stringify({ usuario, desafio, sessao: respostaCognito.Session })).toString("base64url"), 300);
    return res;
  }
  throw new ErroAcesso();
}

export async function GET(req: NextRequest) {
  const perfil = await obterSessao();
  const protegido = req.cookies.get(COOKIE_RENOVACAO)?.value;
  if (!protegido) return limparSessao(resposta({ erro: "Sessão indisponível." }, 401));
  try {
    if (perfil) {
      const { expiraEm } = abrirRenovacao(protegido);
      const res = resposta({ perfil });
      definirCookie(res, COOKIE_RENOVACAO, protegido, duracaoCookieRenovacao(expiraEm));
      return res;
    }
    const renovada = await renovarSessao(protegido);
    return gravarSessao(resposta({ perfil: renovada.perfil }), renovada.acesso,
      renovada.duracaoAcesso, renovada.renovacaoProtegida, renovada.duracaoRenovacao);
  } catch { return limparSessao(resposta({ erro: "Sessão expirada." }, 401)); }
}

export async function POST(req: NextRequest) {
  if (!origemValida(req) || !req.headers.get("content-type")?.startsWith("application/json"))
    return resposta({ erro: "Solicitação inválida." }, 403);
  let dados: Record<string, unknown>;
  try {
    const corpo = await req.text();
    if (corpo.length > 8192) throw new Error();
    dados = JSON.parse(corpo) as Record<string, unknown>;
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
  } catch { return resposta({ erro: "Solicitação inválida." }, 400); }
  try {
    switch (dados["acao"]) {
      case "entrar": {
        const usuario = texto(dados["email"], 254)?.trim().toLowerCase();
        const senha = texto(dados["senha"], 1024);
        if (!usuario || !senha) return resposta({ erro: "Informe e-mail e senha." }, 400);
        return await concluirLogin(await autenticar(usuario, senha), usuario);
      }
      case "desafio": {
        const bruto = req.cookies.get(COOKIE_DESAFIO)?.value;
        if (!bruto || bruto.length > 8192) throw new ErroAcesso();
        const pendente = JSON.parse(Buffer.from(bruto, "base64url").toString("utf8")) as {
          usuario: string; desafio: Desafio | "MFA_SETUP"; sessao: string;
        };
        const respostaUsuario = texto(dados["resposta"], 1024);
        if (!respostaUsuario || !pendente.usuario || !pendente.sessao) throw new ErroAcesso();
        if (pendente.desafio === "MFA_SETUP")
          return await concluirLogin(await confirmarTotp(pendente.sessao, respostaUsuario, pendente.usuario), pendente.usuario);
        if (!DESAFIOS.has(pendente.desafio)) throw new ErroAcesso();
        return await concluirLogin(await responderDesafio(pendente.desafio, pendente.usuario, pendente.sessao, respostaUsuario), pendente.usuario);
      }
      case "recuperar": {
        const usuario = texto(dados["email"], 254)?.trim().toLowerCase();
        if (!usuario) return resposta({ erro: "Informe o e-mail." }, 400);
        await iniciarRecuperacao(usuario);
        return resposta({ estado: "solicitado" });
      }
      case "confirmar-recuperacao": {
        const usuario = texto(dados["email"], 254)?.trim().toLowerCase();
        const codigo = texto(dados["codigo"], 64);
        const senha = texto(dados["senha"], 1024);
        if (!usuario || !codigo || !senha) return resposta({ erro: "Preencha os campos." }, 400);
        await concluirRecuperacao(usuario, codigo, senha);
        return resposta({ estado: "concluido" });
      }
      case "sair": {
        const acesso = req.cookies.get(COOKIE_ACESSO)?.value;
        const protegido = req.cookies.get(COOKIE_RENOVACAO)?.value;
        const refresh = protegido ? abrirRenovacao(protegido).token : undefined;
        await encerrarTokens(acesso, refresh);
        return limparSessao(resposta({ estado: "encerrado" }));
      }
      default: return resposta({ erro: "Solicitação inválida." }, 400);
    }
  } catch {
    return dados["acao"] === "sair"
      ? limparSessao(resposta({ erro: "Sessão local encerrada; revogação remota não confirmada." }, 503))
      : resposta({ erro: "Não foi possível concluir. Confira os dados e tente novamente." }, 401);
  }
}
