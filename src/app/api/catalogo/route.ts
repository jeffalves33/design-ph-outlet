import { NextRequest, NextResponse } from "next/server";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { AcessoNegado } from "@/features/acesso/politica";
import { ErroCategoria } from "@/features/estoque/dominio/categoria";
import { alterarCategoria, criarCategoria, listarCatalogo } from "@/features/estoque/server/catalogo";
import { ErroBanco } from "@/integrations/server/postgres-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(dados: object, status = 200) {
  return NextResponse.json(dados, { status, headers: { "Cache-Control": "no-store" } });
}

function origemValida(req: NextRequest) {
  return req.headers.get("origin") === req.nextUrl.origin &&
    (!req.headers.get("sec-fetch-site") || req.headers.get("sec-fetch-site") === "same-origin");
}

async function corpo(req: NextRequest) {
  if (!origemValida(req) || !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroCategoria("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 4096) throw new ErroCategoria("Solicitação inválida.");
  let dados: unknown;
  try { dados = JSON.parse(texto); } catch { throw new ErroCategoria("Solicitação inválida."); }
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroCategoria("Solicitação inválida.");
  return dados as Record<string, unknown>;
}

function lojaId(dados: Record<string, unknown>) {
  const id = dados["lojaId"];
  if (typeof id !== "string" || !UUID.test(id)) throw new ErroCategoria("Loja inválida.");
  return id;
}

function erroSeguro(erro: unknown) {
  return erro instanceof AcessoNegado ? resposta({ erro: "Acesso negado." }, 403)
    : erro instanceof ErroCategoria ? resposta({ erro: erro.message }, 400)
    : erro instanceof ErroBanco && erro.tipo === "conflito"
      ? resposta({ erro: "Código ou combinação de nome e tamanho já existe nesta loja." }, 409)
    : resposta({ erro: "Não foi possível concluir a operação." }, 503);
}

export async function GET() {
  try {
    const perfil = await autorizarAcao("estoque.consultar", { todas: true });
    return resposta(await listarCatalogo(perfil.lojas));
  } catch (erro) { return erro instanceof AcessoNegado
    ? resposta({ erro: "Acesso negado." }, 403)
    : resposta({ erro: "Catálogo indisponível." }, 503); }
}

export async function POST(req: NextRequest) {
  try {
    const dados = await corpo(req);
    const loja = lojaId(dados);
    await autorizarAcao("estoque.gerir", { lojaId: loja });
    const criada = await criarCategoria(loja, dados["nome"], dados["tamanho"], dados["precoCentavos"]);
    return resposta({ categoria: criada }, 201);
  } catch (erro) { return erroSeguro(erro); }
}

export async function PATCH(req: NextRequest) {
  try {
    const dados = await corpo(req);
    const loja = lojaId(dados);
    await autorizarAcao("estoque.gerir", { lojaId: loja });
    const id = dados["id"];
    if (typeof id !== "string" || !UUID.test(id)) throw new ErroCategoria("Categoria inválida.");
    const alterada = await alterarCategoria(id, loja, dados["nome"], dados["tamanho"], dados["precoCentavos"], dados["arquivar"] === true);
    return resposta({ categoria: alterada });
  } catch (erro) { return erroSeguro(erro); }
}
