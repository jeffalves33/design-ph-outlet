import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { ErroVenda } from "@/features/vendas/dominio/venda";
import { listarVendasRecentes, obterComprovante } from "@/features/vendas/server/comprovantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

function identificar(valor: string | null) {
  if (!valor || !UUID.test(valor)) throw new ErroVenda("Consulta inválida.");
  return valor;
}

export async function GET(req: NextRequest) {
  try {
    const lojaId = identificar(req.nextUrl.searchParams.get("lojaId"));
    await autorizarAcao("impressao.executar", { lojaId });
    const vendaInformada = req.nextUrl.searchParams.get("vendaId");
    if (!vendaInformada) return resposta({ vendas: await listarVendasRecentes(lojaId) });
    const vendaId = identificar(vendaInformada);
    const comprovante = await obterComprovante(lojaId, vendaId);
    return comprovante
      ? resposta({ comprovante })
      : resposta({ erro: "Venda não encontrada nesta loja." }, 404);
  } catch (erro) {
    if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
    if (erro instanceof ErroVenda) return resposta({ erro: erro.message }, erro.status);
    return resposta({ erro: "Não foi possível preparar o comprovante." }, 503);
  }
}
