import "server-only";
import { comClienteBanco } from "@/integrations/server/postgres-client";
import { normalizarCodigoVenda, type ProdutoVenda } from "../dominio/sacola";

export type LojaVenda = Readonly<{ id: string; nome: string }>;
export type VendedorVenda = Readonly<{ id: string; nome: string; lojaId: string }>;

type ProdutoVendaBanco = {
  id: string;
  loja_id: string;
  loja_nome: string;
  codigo: number;
  nome: string;
  tamanho: string;
  preco_centavos: string;
  estoque: string;
};

export async function listarLojasVenda(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return [];
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<LojaVenda>({
      texto: `SELECT id, nome
                FROM public.lojas
               WHERE id = ANY($1::uuid[]) AND ativa = true
               ORDER BY nome`,
      parametros: [lojasAutorizadas],
    });
    return resultado.rows;
  });
}

export async function listarVendedoresVenda(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return [];
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{ id: string; nome: string; loja_id: string }>({
      texto: `SELECT u.id, u.nome_exibicao AS nome, ul.loja_id
                FROM public.usuarios u
                JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id AND ul.ativo = true
                JOIN public.lojas l ON l.id = ul.loja_id AND l.ativa = true
               WHERE u.perfil IN ('administrador', 'vendedor') AND u.ativo = true
                 AND ul.loja_id = ANY($1::uuid[])
               ORDER BY u.nome_exibicao, u.id`,
      parametros: [lojasAutorizadas],
    });
    return resultado.rows.map((linha) => ({ id: linha.id, nome: linha.nome, lojaId: linha.loja_id }));
  });
}

export async function buscarProdutoVenda(lojaId: string, codigoInformado: string): Promise<ProdutoVenda | null> {
  const codigo = normalizarCodigoVenda(codigoInformado);
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<ProdutoVendaBanco>({
      texto: `SELECT c.id, c.loja_id, l.nome AS loja_nome, c.codigo, c.nome, c.tamanho,
                     c.preco_centavos::text, s.quantidade::text AS estoque
                FROM public.categorias c
                JOIN public.lojas l ON l.id = c.loja_id AND l.ativa = true
                JOIN public.saldos_estoque s ON s.categoria_id = c.id AND s.loja_id = c.loja_id
               WHERE c.loja_id = $1 AND c.codigo = $2 AND c.arquivada_em IS NULL
               LIMIT 1`,
      parametros: [lojaId, Number(codigo)],
    });
    const produto = resultado.rows[0];
    return produto ? {
      id: produto.id,
      lojaId: produto.loja_id,
      lojaNome: produto.loja_nome,
      codigo: String(produto.codigo).padStart(5, "0"),
      nome: produto.nome,
      tamanho: produto.tamanho,
      precoCentavos: produto.preco_centavos,
      estoque: produto.estoque,
    } : null;
  });
}
