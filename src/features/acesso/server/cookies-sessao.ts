import "server-only";
import { NextResponse } from "next/server";
import { COOKIE_ACESSO, COOKIE_DESAFIO } from "./sessao";
import { COOKIE_RENOVACAO, JANELA_COOKIE_RENOVACAO_SEGUNDOS } from "./refresh-cookie";

export function definirCookie(res: NextResponse, nome: string, valor: string, segundos: number) {
  const maxAge = Math.max(1, Math.floor(segundos));
  res.cookies.set(nome, valor, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: nome === COOKIE_RENOVACAO
      ? Math.min(maxAge, JANELA_COOKIE_RENOVACAO_SEGUNDOS) : maxAge, priority: "high",
  });
}

export function gravarSessao(
  res: NextResponse, acesso: string, duracaoAcesso: number,
  renovacaoProtegida: string, duracaoRenovacao: number,
) {
  definirCookie(res, COOKIE_ACESSO, acesso, duracaoAcesso);
  definirCookie(res, COOKIE_RENOVACAO, renovacaoProtegida, duracaoRenovacao);
  res.cookies.set(COOKIE_DESAFIO, "", { path: "/", maxAge: 0 });
  return res;
}

export function limparSessao(res: NextResponse) {
  for (const nome of [COOKIE_ACESSO, COOKIE_RENOVACAO, COOKIE_DESAFIO])
    res.cookies.set(nome, "", { path: "/", maxAge: 0 });
  return res;
}
