import "server-only";
import { comClienteBanco } from "@/integrations/server/postgres-client";
import { ErroVenda } from "../dominio/venda";

type CabecalhoComprovante = {
  id: string;
  loja_nome: string;
  responsavel_nome: string;
  total_centavos: string;
  realizada_em: string;
};

type ItemComprovante = {
  categoria_id: string;
  codigo_registrado: number;
  nome_registrado: string;
  tamanho_registrado: string;
  preco_unitario_centavos: string;
  quantidade: number;
  total_linha_centavos: string;
};

export async function obterComprovante(lojaId: string, vendaId: string) {
  return comClienteBanco(async (cliente) => {
    const cabecalho = await cliente.consultar<CabecalhoComprovante>({
      texto: `SELECT v.id, l.nome AS loja_nome, u.nome_exibicao AS responsavel_nome,
                     v.total_centavos::text, v.realizada_em
                FROM public.vendas v
                JOIN public.lojas l ON l.id = v.loja_id
                JOIN public.usuarios u ON u.id = v.vendedor_usuario_id
               WHERE v.id = $1 AND v.loja_id = $2`,
      parametros: [vendaId, lojaId],
    });
    const venda = cabecalho.rows[0];
    if (!venda) return null;
    const itens = await cliente.consultar<ItemComprovante>({
      texto: `SELECT categoria_id, codigo_registrado, nome_registrado, tamanho_registrado,
                     preco_unitario_centavos::text, quantidade, total_linha_centavos::text
                FROM public.itens_venda
               WHERE venda_id = $1 AND loja_id = $2
               ORDER BY categoria_id`,
      parametros: [vendaId, lojaId],
    });
    const movimentos = await cliente.consultar<{ categoria_id: string }>({
      texto: `SELECT categoria_id FROM public.movimentos_estoque
               WHERE venda_id = $1 AND loja_id = $2 ORDER BY categoria_id`,
      parametros: [vendaId, lojaId],
    });
    if (!itens.rows.length || movimentos.rows.length !== itens.rows.length) {
      throw new ErroVenda("Venda sem itens ou baixas íntegros; comprovante indisponível.", 503);
    }
    const totalCalculado = itens.rows.reduce(
      (total, item) => total + BigInt(item.total_linha_centavos), 0n,
    );
    if (totalCalculado.toString() !== venda.total_centavos) {
      throw new ErroVenda("Venda com total inconsistente; comprovante indisponível.", 503);
    }
    return {
      id: venda.id,
      lojaNome: venda.loja_nome,
      responsavelNome: venda.responsavel_nome,
      totalCentavos: venda.total_centavos,
      realizadaEm: venda.realizada_em,
      itens: itens.rows.map((item) => ({
        categoriaId: item.categoria_id,
        codigo: String(item.codigo_registrado).padStart(5, "0"),
        nome: item.nome_registrado,
        tamanho: item.tamanho_registrado,
        precoUnitarioCentavos: item.preco_unitario_centavos,
        quantidade: item.quantidade,
        totalLinhaCentavos: item.total_linha_centavos,
      })),
    };
  });
}

export async function listarVendasRecentes(lojaId: string) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{
      id: string; total_centavos: string; realizada_em: string; responsavel_nome: string;
    }>({
      texto: `SELECT v.id, v.total_centavos::text, v.realizada_em,
                     u.nome_exibicao AS responsavel_nome
                FROM public.vendas v
                JOIN public.usuarios u ON u.id = v.vendedor_usuario_id
               WHERE v.loja_id = $1
               ORDER BY v.realizada_em DESC, v.id DESC
               LIMIT 10`,
      parametros: [lojaId],
    });
    return resultado.rows.map((venda) => ({
      id: venda.id,
      totalCentavos: venda.total_centavos,
      realizadaEm: venda.realizada_em,
      responsavelNome: venda.responsavel_nome,
    }));
  });
}
