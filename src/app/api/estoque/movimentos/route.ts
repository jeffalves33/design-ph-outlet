import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { ErroMovimentacao } from "@/features/estoque/dominio/movimentacao";
import { consultarOperacaoEstoque, listarMovimentacoes, registrarMovimentacao } from "@/features/estoque/server/movimentacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

function identificar(valor: unknown) {
  if (typeof valor !== "string" || !UUID.test(valor))
    throw new ErroMovimentacao("Loja ou categoria inválida.");
  return valor;
}

function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroMovimentacao) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a operação." }, 503);
}

export async function GET(req: NextRequest) {
  try {
    const lojaId = identificar(req.nextUrl.searchParams.get("lojaId"));
    await autorizarAcao("estoque.consultar", { lojaId });
    const chave = req.nextUrl.searchParams.get("chaveIdempotencia");
    if (chave !== null) {
      if (!/^[A-Za-z0-9_-]{16,200}$/.test(chave) || req.nextUrl.searchParams.has("categoriaId"))
        throw new ErroMovimentacao("Consulta inválida.");
      const operacao = await consultarOperacaoEstoque(lojaId, chave);
      return operacao ? resposta({ operacao }) : resposta({ erro: "Operação ainda não localizada." }, 404);
    }
    const categoriaId = identificar(req.nextUrl.searchParams.get("categoriaId"));
    return resposta({ movimentos: await listarMovimentacoes(lojaId, categoriaId) });
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin ||
        (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
        !req.headers.get("content-type")?.startsWith("application/json"))
      throw new ErroMovimentacao("Solicitação inválida.");
    const texto = await req.text();
    if (texto.length > 4096) throw new ErroMovimentacao("Solicitação inválida.");
    let dados: unknown;
    try { dados = JSON.parse(texto); } catch { throw new ErroMovimentacao("Solicitação inválida."); }
    if (!dados || typeof dados !== "object" || Array.isArray(dados))
      throw new ErroMovimentacao("Solicitação inválida.");
    const entrada = dados as Record<string, unknown>;
    const lojaId = identificar(entrada["lojaId"]);
    const categoriaId = identificar(entrada["categoriaId"]);
    const perfil = await autorizarAcao("estoque.gerir", { lojaId });
    const movimento = await registrarMovimentacao(lojaId, categoriaId, perfil.id,
      entrada["tipo"], entrada["variacao"], entrada["motivo"], entrada["chaveIdempotencia"]);
    return resposta({ movimento }, movimento.repetida ? 200 : 201);
  } catch (erro) { return erroSeguro(erro); }
}
