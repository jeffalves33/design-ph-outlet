import { NextRequest, NextResponse } from "next/server";
import { AcessoNegado } from "@/features/acesso/politica";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { ErroFinanceiro } from "@/features/financeiro/dominio/financeiro";
import { consultarFinanceiro, criarDespesa } from "@/features/financeiro/server/financeiro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resposta = (dados: object, status = 200) => NextResponse.json(dados,
  { status, headers: { "Cache-Control": "no-store" } });
function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroFinanceiro) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a operação financeira." }, 503);
}
async function corpo(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin ||
      (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
      !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroFinanceiro("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 8192) throw new ErroFinanceiro("Solicitação inválida.");
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados as Record<string, unknown>;
  } catch { throw new ErroFinanceiro("Solicitação inválida."); }
}

export async function GET(req: NextRequest) {
  try {
    const perfil = await autorizarAcao("financeiro.consultar", { todas: true });
    return resposta(await consultarFinanceiro(perfil.lojas,
      req.nextUrl.searchParams.get("inicio"), req.nextUrl.searchParams.get("fim")));
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    const dados = await corpo(req);
    const lojaId = typeof dados["lojaId"] === "string" ? dados["lojaId"] : "";
    const perfil = await autorizarAcao("financeiro.gerir", { lojaId });
    const despesa = await criarDespesa(perfil.id, perfil.lojas, dados);
    return resposta({ despesa }, despesa.repetida ? 200 : 201);
  } catch (erro) { return erroSeguro(erro); }
}
