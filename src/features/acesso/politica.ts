/** Política PH: compartilhada pelo servidor e pela apresentação do menu. */
export type PerfilAutorizado = Readonly<{
  id: string;
  perfil: "administrador" | "vendedor";
  lojas: readonly string[];
}>;

export type Acao =
  | "painel.consultar" | "estoque.consultar" | "estoque.gerir"
  | "vendas.consultar" | "vendas.registrar" | "impressao.executar"
  | "equipe.consultar" | "equipe.gerir" | "metas.gerir"
  | "metas.proprias.consultar" | "metas.equipe.consultar"
  | "clientes.consultar" | "clientes.gerir"
  | "financeiro.consultar" | "financeiro.gerir";

export type EscopoAutorizacao = Readonly<{
  lojaId?: string;
  todas?: boolean;
  usuarioId?: string;
}>;

const ACOES_ADMIN = new Set<Acao>([
  "painel.consultar", "estoque.consultar", "estoque.gerir",
  "vendas.consultar", "vendas.registrar", "impressao.executar",
  "equipe.consultar", "equipe.gerir", "metas.gerir", "metas.equipe.consultar",
  "clientes.consultar", "clientes.gerir", "financeiro.consultar", "financeiro.gerir",
]);
const MUTACOES = new Set<Acao>([
  "estoque.gerir", "vendas.registrar", "impressao.executar", "clientes.gerir", "financeiro.gerir",
]);
const ACOES_SEM_LOJA = new Set<Acao>([
  "equipe.consultar", "equipe.gerir", "metas.gerir", "metas.equipe.consultar", "clientes.gerir",
]);

export function podeAcessar(
  perfil: PerfilAutorizado | null,
  acao: Acao,
  escopo: EscopoAutorizacao = {},
): boolean {
  if (!perfil || !perfil.id || !["administrador", "vendedor"].includes(perfil.perfil)) return false;
  if (acao === "metas.proprias.consultar") {
    return perfil.perfil === "vendedor" &&
      (!escopo.usuarioId || escopo.usuarioId === perfil.id) &&
      !escopo.lojaId && !escopo.todas;
  }
  if (perfil.perfil !== "administrador" || !ACOES_ADMIN.has(acao)) return false;
  // Alvos de terceiros requerem verificação de vínculo do recurso na feature futura.
  if (escopo.usuarioId && escopo.usuarioId !== perfil.id) return false;
  if (escopo.todas && escopo.lojaId) return false;
  if (ACOES_SEM_LOJA.has(acao)) return !escopo.lojaId && !escopo.todas;
  if (escopo.lojaId) return perfil.lojas.includes(escopo.lojaId);
  if (escopo.todas) return !MUTACOES.has(acao) && perfil.lojas.length > 0;
  return false;
}

export class AcessoNegado extends Error {
  constructor() { super("Acesso não autorizado."); this.name = "AcessoNegado"; }
}

export function autorizar(perfil: PerfilAutorizado | null, acao: Acao, escopo: EscopoAutorizacao = {}) {
  if (!podeAcessar(perfil, acao, escopo)) throw new AcessoNegado();
  return perfil!;
}
