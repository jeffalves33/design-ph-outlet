import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { ErroVenda } from "@/features/vendas/dominio/venda";
import { confirmarVenda, consultarVenda } from "@/features/vendas/server/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

function loja(valor: unknown) {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new ErroVenda("Loja inválida.");
  return valor;
}

function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroVenda) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a venda." }, 503);
}

export async function GET(req: NextRequest) {
  try {
    const lojaId = loja(req.nextUrl.searchParams.get("lojaId"));
    const chave = req.nextUrl.searchParams.get("chaveIdempotencia") ?? "";
    await autorizarAcao("vendas.consultar", { lojaId });
    const venda = await consultarVenda(lojaId, chave);
    return venda ? resposta({ venda }) : resposta({ erro: "Venda ainda não localizada." }, 404);
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin ||
        (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
        !req.headers.get("content-type")?.startsWith("application/json")) {
      throw new ErroVenda("Solicitação inválida.");
    }
    const texto = await req.text();
    if (texto.length > 16_384) throw new ErroVenda("Solicitação inválida.");
    let dados: unknown;
    try { dados = JSON.parse(texto); } catch { throw new ErroVenda("Solicitação inválida."); }
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroVenda("Solicitação inválida.");
    const entrada = dados as Record<string, unknown>;
    const lojaId = loja(entrada["lojaId"]);
    const perfil = await autorizarAcao("vendas.registrar", { lojaId });
    const venda = await confirmarVenda(lojaId, perfil.id, entrada["vendedorUsuarioId"],
      entrada["itens"], entrada["chaveIdempotencia"], entrada["clienteId"]);
    return resposta({ venda }, "repetida" in venda && venda.repetida ? 200 : 201);
  } catch (erro) { return erroSeguro(erro); }
}
