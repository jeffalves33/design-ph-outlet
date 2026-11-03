import "server-only";
import { redirect } from "next/navigation";
import { obterSessao } from "./sessao";

/** Proteção de identidade; permissões por ação/loja pertencem a P2.6. */
export async function exigirSessao() {
  const perfil = await obterSessao();
  if (!perfil) redirect("/login");
  return perfil;
}
