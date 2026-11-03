import { NextRequest, NextResponse } from "next/server";
import { COOKIE_RENOVACAO, abrirRenovacao, duracaoCookieRenovacao } from "@/features/acesso/server/refresh-cookie";
import { obterSessao, renovarSessao } from "@/features/acesso/server/sessao";
import { definirCookie, gravarSessao, limparSessao } from "@/features/acesso/server/cookies-sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DESTINOS = new Set(["/", "/vendas", "/estoque", "/catalogo", "/colaboradores", "/meu-desempenho", "/clientes", "/financeiro"]);

export async function GET(req: NextRequest) {
  const retorno = req.nextUrl.searchParams.get("retorno") ?? "/";
  if (!DESTINOS.has(retorno)) return NextResponse.json({ erro: "Destino inválido." }, { status: 400 });
  const destino = new URL(retorno, req.nextUrl.origin);
  const protegido = req.cookies.get(COOKIE_RENOVACAO)?.value;
  if (!protegido) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  try {
    if (await obterSessao()) {
      const { expiraEm } = abrirRenovacao(protegido);
      const res = NextResponse.redirect(destino);
      definirCookie(res, COOKIE_RENOVACAO, protegido, duracaoCookieRenovacao(expiraEm));
      return res;
    }
    const renovada = await renovarSessao(protegido);
    return gravarSessao(NextResponse.redirect(destino), renovada.acesso,
      renovada.duracaoAcesso, renovada.renovacaoProtegida, renovada.duracaoRenovacao);
  } catch {
    return limparSessao(NextResponse.redirect(new URL("/login", req.nextUrl.origin)));
  }
}
