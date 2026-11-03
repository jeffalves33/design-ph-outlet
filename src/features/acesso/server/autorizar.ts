import "server-only";
import { redirect } from "next/navigation";
import { obterSessao, temRenovacao } from "./sessao";
import { autorizar, type Acao, type EscopoAutorizacao } from "../politica";

/** Entrada server-side para APIs/actions; não confia em identidade ou loja do payload. */
export async function autorizarAcao(acao: Acao, escopo: EscopoAutorizacao = {}) {
  const perfil = await obterSessao();
  return autorizar(perfil, acao, escopo);
}

/** Páginas usam a mesma decisão da API, com redirecionamento apenas na apresentação. */
export async function exigirPaginaAutorizada(acao: Acao, escopo: EscopoAutorizacao = {}, retornoCatalogo?: "/catalogo") {
  const perfil = await obterSessao();
  if (!perfil) {
    if (await temRenovacao()) {
      const caminhos: Partial<Record<Acao, string>> = {
        "painel.consultar": "/", "vendas.consultar": "/vendas",
        "estoque.consultar": "/estoque", "equipe.consultar": "/colaboradores",
        "metas.equipe.consultar": "/colaboradores",
        "metas.proprias.consultar": "/meu-desempenho",
        "clientes.consultar": "/clientes", "financeiro.consultar": "/financeiro",
      };
      const retorno = retornoCatalogo ?? caminhos[acao];
      if (retorno) redirect(`/api/acesso/renovar?retorno=${encodeURIComponent(retorno)}`);
    }
    redirect("/login");
  }
  try { return autorizar(perfil, acao, escopo); }
  catch { redirect("/acesso-negado"); }
}
