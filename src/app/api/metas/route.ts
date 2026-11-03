import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { obterSessao } from "@/features/acesso/server/sessao";
import { AcessoNegado, autorizar } from "@/features/acesso/politica";
import { ErroMeta } from "@/features/metas/dominio/meta";
import { criarMeta, editarMeta, listarHistoricoMeta, listarMetasEquipe,
  listarMetasProprias, listarResponsaveisMetas } from "@/features/metas/server/metas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resposta = (dados: object, status = 200) => NextResponse.json(dados,
  { status, headers: { "Cache-Control": "no-store" } });

function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroMeta) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a operação de metas." }, 503);
}

async function corpo(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin
      || (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin")
      || !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroMeta("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 8192) throw new ErroMeta("Solicitação inválida.");
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados as Record<string, unknown>;
  } catch { throw new ErroMeta("Solicitação inválida."); }
}

export async function GET(req: NextRequest) {
  try {
    const perfil = await obterSessao();
    if (perfil?.perfil === "administrador") {
      autorizar(perfil, "metas.equipe.consultar");
      const historicoMetaId = req.nextUrl.searchParams.get("historicoMetaId");
      if (historicoMetaId !== null) {
        if (!UUID.test(historicoMetaId)) throw new ErroMeta("Meta inválida.");
        return resposta({ historico: await listarHistoricoMeta(historicoMetaId, perfil.lojas) });
      }
      const [metas, responsaveis] = await Promise.all([
        listarMetasEquipe(perfil.lojas), listarResponsaveisMetas(perfil.lojas),
      ]);
      return resposta({ modo: "equipe", metas, responsaveis });
    }
    if (!perfil) throw new AcessoNegado();
    const proprio = autorizar(perfil, "metas.proprias.consultar", { usuarioId: perfil.id });
    return resposta({ modo: "proprio", metas: await listarMetasProprias(proprio.id, proprio.lojas) });
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    const dados = await corpo(req);
    const perfil = await autorizarAcao("metas.gerir");
    const meta = await criarMeta(perfil.id, perfil.lojas, dados);
    return resposta({ meta }, meta.repetida ? 200 : 201);
  } catch (erro) { return erroSeguro(erro); }
}

export async function PATCH(req: NextRequest) {
  try {
    const dados = await corpo(req);
    const perfil = await autorizarAcao("metas.gerir");
    return resposta({ meta: await editarMeta(perfil.id, perfil.lojas, dados) });
  } catch (erro) { return erroSeguro(erro); }
}
