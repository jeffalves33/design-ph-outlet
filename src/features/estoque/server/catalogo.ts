import "server-only";
import { randomUUID } from "node:crypto";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";
import { validarCategoria, ErroCategoria } from "../dominio/categoria";

export type CategoriaBanco = {
  id: string; loja_id: string; loja_nome: string; codigo: number; nome: string; tamanho: string;
  preco_centavos: string; quantidade: string; arquivada_em: string | null;
};

export async function listarCatalogo(lojas: readonly string[]) {
  if (!lojas.length) return { lojas: [], categorias: [] };
  return comClienteBanco(async (cliente) => {
    const lojasAtivas = await cliente.consultar<{ id: string; nome: string }>({
      texto: `SELECT id, nome FROM public.lojas
               WHERE id = ANY($1::uuid[]) AND ativa = true ORDER BY nome`,
      parametros: [lojas],
    });
    const resultado = await cliente.consultar<CategoriaBanco>({
      texto: `SELECT c.id, c.loja_id, l.nome AS loja_nome, c.codigo, c.nome, c.tamanho,
                     c.preco_centavos::text, s.quantidade::text, c.arquivada_em
                FROM public.categorias c
                JOIN public.lojas l ON l.id = c.loja_id AND l.ativa = true
                JOIN public.saldos_estoque s ON s.categoria_id = c.id AND s.loja_id = c.loja_id
               WHERE c.loja_id = ANY($1::uuid[])
               ORDER BY l.nome, c.nome, c.tamanho, c.codigo`,
      parametros: [lojas],
    });
    return { lojas: lojasAtivas.rows, categorias: resultado.rows };
  });
}

async function transacao<T>(executar: (cliente: ClienteBanco) => Promise<T>) {
  return comClienteBanco(async (cliente) => {
    await cliente.consultar({ texto: "BEGIN", parametros: [] });
    try {
      const resultado = await executar(cliente);
      await cliente.consultar({ texto: "COMMIT", parametros: [] });
      return resultado;
    } catch (erro) {
      try { await cliente.consultar({ texto: "ROLLBACK", parametros: [] }); } catch { /* erro original */ }
      throw erro;
    }
  });
}

export async function criarCategoria(lojaId: string, nome: unknown, tamanho: unknown, precoCentavos: unknown) {
  const entrada = validarCategoria(nome, tamanho, precoCentavos);
  return transacao(async (cliente) => {
    const loja = await cliente.consultar({
      texto: "SELECT id FROM public.lojas WHERE id = $1 AND ativa = true FOR SHARE",
      parametros: [lojaId],
    });
    if (!loja.rows.length) throw new ErroCategoria("Loja indisponível.");
    await cliente.consultar({
      texto: `INSERT INTO public.sequencias_categoria (loja_id, proximo_codigo)
              VALUES ($1, 1) ON CONFLICT (loja_id) DO NOTHING`, parametros: [lojaId],
    });
    const reservado = await cliente.consultar<{ codigo: number }>({
      texto: `UPDATE public.sequencias_categoria SET proximo_codigo = proximo_codigo + 1
               WHERE loja_id = $1 AND proximo_codigo <= 99999
           RETURNING proximo_codigo - 1 AS codigo`, parametros: [lojaId],
    });
    const codigo = reservado.rows[0]?.codigo;
    if (!codigo) throw new ErroCategoria("Faixa de códigos esgotada nesta loja.");
    const id = randomUUID();
    await cliente.consultar({
      texto: `INSERT INTO public.categorias (id, loja_id, codigo, nome, tamanho, preco_centavos)
              VALUES ($1, $2, $3, $4, $5, $6)`,
      parametros: [id, lojaId, codigo, entrada.nome, entrada.tamanho, entrada.precoCentavos],
    });
    await cliente.consultar({
      texto: `INSERT INTO public.saldos_estoque (categoria_id, loja_id, quantidade)
              VALUES ($1, $2, 0)`, parametros: [id, lojaId],
    });
    return { id, codigo };
  });
}

export async function alterarCategoria(
  id: string, lojaId: string, nome: unknown, tamanho: unknown, precoCentavos: unknown, arquivar: boolean,
) {
  const entrada = validarCategoria(nome, tamanho, precoCentavos);
  return transacao(async (cliente) => {
    const resultado = await cliente.consultar({
      texto: `UPDATE public.categorias
                 SET nome = $3, tamanho = $4, preco_centavos = $5,
                     arquivada_em = CASE WHEN $6::boolean THEN now() ELSE arquivada_em END
               WHERE id = $1 AND loja_id = $2 AND arquivada_em IS NULL
           RETURNING id`,
      parametros: [id, lojaId, entrada.nome, entrada.tamanho, entrada.precoCentavos, arquivar],
    });
    if (!resultado.rows.length) throw new ErroCategoria("Categoria não encontrada ou arquivada.");
    return { id };
  });
}
