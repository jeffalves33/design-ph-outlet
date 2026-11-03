import { NextRequest, NextResponse } from "next/server";
import { AcessoNegado } from "@/features/acesso/politica";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { ErroFuncionario } from "@/features/equipe/dominio/funcionario";
import { criarFuncionario, editarFuncionario, executarAcaoFuncionario,
  listarFuncionarios } from "@/features/equipe/server/funcionarios";
import { ErroCognitoAdministrativo } from "@/integrations/server/cognito-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resposta = (dados: object, status = 200) => NextResponse.json(dados,
  { status, headers: { "Cache-Control": "no-store" } });

function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroFuncionario) return resposta({ erro: erro.message }, erro.status);
  if (erro instanceof ErroCognitoAdministrativo) return resposta({ erro: erro.message }, 503);
  return resposta({ erro: "Não foi possível concluir a operação de funcionários." }, 503);
}

async function corpo(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin ||
      (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
      !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroFuncionario("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 16_384) throw new ErroFuncionario("Solicitação inválida.");
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados as Record<string, unknown>;
  } catch { throw new ErroFuncionario("Solicitação inválida."); }
}

export async function GET() {
  try {
    const perfil = await autorizarAcao("equipe.consultar");
    return resposta(await listarFuncionarios(perfil.lojas));
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    const perfil = await autorizarAcao("equipe.gerir");
    return resposta({ funcionario: await criarFuncionario(perfil.lojas, await corpo(req)) }, 201);
  } catch (erro) { return erroSeguro(erro); }
}

export async function PATCH(req: NextRequest) {
  try {
    const perfil = await autorizarAcao("equipe.gerir");
    const dados = await corpo(req);
    const resultado = dados["acao"] === "editar"
      ? await editarFuncionario(perfil.lojas, dados)
      : await executarAcaoFuncionario(perfil.lojas, dados);
    return resposta({ funcionario: resultado });
  } catch (erro) { return erroSeguro(erro); }
}
