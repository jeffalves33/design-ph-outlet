import { NextRequest, NextResponse } from "next/server";
import { AcessoNegado } from "@/features/acesso/politica";
import { autorizarAcao } from "@/features/acesso/server/autorizar";
import { ErroCliente } from "@/features/clientes/dominio/cliente";
import { criarCliente, listarClientes } from "@/features/clientes/server/clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resposta = (dados: object, status = 200) => NextResponse.json(dados,
  { status, headers: { "Cache-Control": "no-store" } });
function erroSeguro(erro: unknown) {
  if (erro instanceof AcessoNegado) return resposta({ erro: "Acesso negado." }, 403);
  if (erro instanceof ErroCliente) return resposta({ erro: erro.message }, erro.status);
  return resposta({ erro: "Não foi possível concluir a operação de clientes." }, 503);
}
async function corpo(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin ||
      (req.headers.get("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin") ||
      !req.headers.get("content-type")?.startsWith("application/json"))
    throw new ErroCliente("Solicitação inválida.");
  const texto = await req.text();
  if (texto.length > 8192) throw new ErroCliente("Solicitação inválida.");
  try {
    const dados: unknown = JSON.parse(texto);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados as Record<string, unknown>;
  } catch { throw new ErroCliente("Solicitação inválida."); }
}

export async function GET() {
  try {
    const perfil = await autorizarAcao("clientes.consultar", { todas: true });
    return resposta(await listarClientes(perfil.lojas));
  } catch (erro) { return erroSeguro(erro); }
}

export async function POST(req: NextRequest) {
  try {
    const perfil = await autorizarAcao("clientes.gerir");
    const cliente = await criarCliente(perfil.id, perfil.lojas, await corpo(req));
    return resposta({ cliente }, cliente.repetido ? 200 : 201);
  } catch (erro) { return erroSeguro(erro); }
}
