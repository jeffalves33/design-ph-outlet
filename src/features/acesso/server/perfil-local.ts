import "server-only";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";

export type IdentidadeCognitoVerificada = Readonly<{
  emissor: string;
  sub: string;
}>;

export type PerfilLocal = Readonly<{
  id: string;
  nome: string;
  perfil: "administrador" | "vendedor";
  lojas: readonly string[];
}>;

type LinhaPerfil = {
  id: string;
  nome_exibicao: string;
  perfil: "administrador" | "vendedor";
  lojas: string[];
};

/** Recebe somente identidade previamente validada pelo verificador Cognito. */
export async function consultarPerfilLocal(
  identidade: IdentidadeCognitoVerificada,
  cliente: ClienteBanco,
): Promise<PerfilLocal | null> {
  if (!identidade.emissor.trim() || !identidade.sub.trim()) return null;

  const resultado = await cliente.consultar<LinhaPerfil>({
    texto: `SELECT u.id, u.nome_exibicao, u.perfil,
              COALESCE(array_agg(l.id) FILTER (WHERE l.id IS NOT NULL), '{}') AS lojas
         FROM public.usuarios AS u
         LEFT JOIN public.usuarios_lojas AS ul
           ON ul.usuario_id = u.id AND ul.ativo = true
         LEFT JOIN public.lojas AS l
           ON l.id = ul.loja_id AND l.ativa = true
        WHERE u.emissor_cognito = $1 AND u.sub_cognito = $2 AND u.ativo = true
        GROUP BY u.id, u.nome_exibicao, u.perfil`,
    parametros: [identidade.emissor, identidade.sub],
  });

  const linha = resultado.rows[0];
  if (!linha) return null;
  return {
    id: linha.id,
    nome: linha.nome_exibicao,
    perfil: linha.perfil,
    lojas: linha.lojas,
  };
}

export async function obterPerfilLocal(
  identidade: IdentidadeCognitoVerificada,
): Promise<PerfilLocal | null> {
  return comClienteBanco((cliente) => consultarPerfilLocal(identidade, cliente));
}
