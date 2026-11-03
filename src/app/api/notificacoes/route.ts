import { NextRequest, NextResponse } from "next/server";
import { AcessoNegado } from "@/features/acesso/politica";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { ErroNotificacao, listarNotificacoes, marcarNotificacoesLidas } from "@/features/notificacoes/server/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (dados: object, status = 200) => NextResponse.json(dados,
  { status, headers: { "Cache-Control": "no-store" } });

function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroNotificacao) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a operação de notificações." }, 503);
}

async function corpo(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin ||
      (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
      !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroNotificacao("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 32768) throw new ErroNotificacao("Solicitação inválida.");
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados as Record<string, unknown>;
  } catch { throw new ErroNotificacao("Solicitação inválida."); }
}

export async function GET() {
  try {
    const perfil = await autorizarAcao("painel.consultar", { todas: true });
    return resposta({ notificacoes: await listarNotificacoes(perfil.id, perfil.lojas) });
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    const perfil = await autorizarAcao("painel.consultar", { todas: true });
    const dados = await corpo(req);
    return resposta(await marcarNotificacoesLidas(perfil.id, perfil.lojas, dados["chaves"]));
  } catch (erro) { return erroSeguro(erro); }
}
