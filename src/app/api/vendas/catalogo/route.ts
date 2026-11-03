import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { ErroSacola, normalizarCodigoVenda } from "@/features/vendas/dominio/sacola";
import { buscarProdutoVenda } from "@/features/vendas/server/catalogo-venda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const lojaId = req.nextUrl.searchParams.get("lojaId") ?? "";
    if (!UUID.test(lojaId)) throw new ErroSacola("Loja inválida.");
    const codigo = normalizarCodigoVenda(req.nextUrl.searchParams.get("codigo") ?? "");
    await autorizarAcao("vendas.consultar", { lojaId });
    const produto = await buscarProdutoVenda(lojaId, codigo);
    return produto
      ? resposta({ produto })
      : resposta({ erro: "Código não encontrado nesta loja." }, 404);
  } catch (erro) {
    if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
    if (erro instanceof ErroSacola) return resposta({ erro: erro.message }, 400);
    return resposta({ erro: "Não foi possível consultar o código." }, 503);
  }
}
