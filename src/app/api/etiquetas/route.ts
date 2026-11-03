import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { obterCategoriaParaEtiqueta } from "@/features/etiquetas/server/etiquetas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  try {
    const lojaId = req.nextUrl.searchParams.get("lojaId") ?? "";
    const categoriaId = req.nextUrl.searchParams.get("categoriaId") ?? "";
    if (!UUID.test(lojaId) || !UUID.test(categoriaId)) return resposta({ erro: "Consulta inválida." }, 400);
    await autorizarAcao("impressao.executar", { lojaId });
    const categoria = await obterCategoriaParaEtiqueta(lojaId, categoriaId);
    return categoria ? resposta({ categoria }) : resposta({ erro: "Categoria indisponível." }, 404);
  } catch (erro) {
    return erro instanceof AcessoNegado
      ? resposta({ erro: "Acesso negado." }, 403)
      : resposta({ erro: "Não foi possível preparar a etiqueta." }, 503);
  }
}
