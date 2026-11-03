import "server-only";
import { comClienteBanco } from "@/integrations/server/postgres-client";

export type DadosEtiqueta = {
  id: string; loja_id: string; loja_nome: string; codigo: number;
  nome: string; tamanho: string; preco_centavos: string;
};

export async function obterCategoriaParaEtiqueta(lojaId: string, categoriaId: string) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<DadosEtiqueta>({
      texto: `SELECT c.id, c.loja_id, l.nome AS loja_nome, c.codigo, c.nome, c.tamanho,
                     c.preco_centavos::text
                FROM public.categorias c
                JOIN public.lojas l ON l.id = c.loja_id AND l.ativa = true
               WHERE c.id = $1 AND c.loja_id = $2 AND c.arquivada_em IS NULL`,
      parametros: [categoriaId, lojaId],
    });
    return resultado.rows[0] ?? null;
  });
}
