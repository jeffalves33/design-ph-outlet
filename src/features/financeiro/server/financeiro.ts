import "server-only";
import { comClienteBanco } from "@/integrations/server/postgres-client";
import { ErroFinanceiro, validarNovaDespesa, validarPeriodo } from "../dominio/financeiro";

type LinhaVenda = { id: string; loja_id: string; loja_nome: string; total_centavos: string;
  realizada_em: string; cliente_nome: string | null };
type LinhaDespesa = { id: string; loja_id: string; loja_nome: string; descricao: string;
  categoria: string; valor_centavos: string; data_despesa: string; criada_em: string };

export async function consultarFinanceiro(
  lojasAutorizadas: readonly string[], inicio: unknown, fim: unknown,
) {
  const periodo = validarPeriodo(inicio, fim);
  if (!lojasAutorizadas.length) return { lojas: [], vendas: [], despesas: [] };
  return comClienteBanco(async (cliente) => {
    const [lojas, vendas, despesas] = await Promise.all([
      cliente.consultar<{ id: string; nome: string }>({
        texto: `SELECT id, nome FROM public.lojas
                 WHERE ativa = true AND id = ANY($1::uuid[]) ORDER BY nome`,
        parametros: [lojasAutorizadas],
      }),
      cliente.consultar<LinhaVenda>({
        texto: `SELECT v.id, v.loja_id, l.nome AS loja_nome, v.total_centavos::text,
                       v.realizada_em, c.nome AS cliente_nome
                  FROM public.vendas v
                  JOIN public.lojas l ON l.id = v.loja_id
                  LEFT JOIN public.clientes c ON c.id = v.cliente_id
                 WHERE v.loja_id = ANY($1::uuid[])
                   AND (v.realizada_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2::date AND $3::date
                 ORDER BY v.realizada_em DESC`,
        parametros: [lojasAutorizadas, periodo.inicioData, periodo.fimData],
      }),
      cliente.consultar<LinhaDespesa>({
        texto: `SELECT d.id, d.loja_id, l.nome AS loja_nome, d.descricao, d.categoria,
                       d.valor_centavos::text, d.data_despesa::text, d.criada_em
                  FROM public.despesas d JOIN public.lojas l ON l.id = d.loja_id
                 WHERE d.loja_id = ANY($1::uuid[]) AND d.data_despesa BETWEEN $2::date AND $3::date
                 ORDER BY d.data_despesa DESC, d.criada_em DESC, d.id`,
        parametros: [lojasAutorizadas, periodo.inicioData, periodo.fimData],
      }),
    ]);
    return {
      lojas: lojas.rows,
      vendas: vendas.rows.map((linha) => ({ id: linha.id, lojaId: linha.loja_id,
        lojaNome: linha.loja_nome, totalCentavos: linha.total_centavos,
        realizadaEm: linha.realizada_em, clienteNome: linha.cliente_nome })),
      despesas: despesas.rows.map((linha) => ({ id: linha.id, lojaId: linha.loja_id,
        lojaNome: linha.loja_nome, descricao: linha.descricao, categoria: linha.categoria,
        valorCentavos: linha.valor_centavos, dataDespesa: linha.data_despesa,
        criadaEm: linha.criada_em })),
      periodo,
    };
  });
}

export async function criarDespesa(
  autorUsuarioId: string, lojasAutorizadas: readonly string[], dados: Record<string, unknown>,
) {
  const entrada = validarNovaDespesa(dados);
  if (!lojasAutorizadas.includes(entrada.lojaId)) throw new ErroFinanceiro("Acesso negado.", 403);
  return comClienteBanco(async (cliente) => {
    const inserida = await cliente.consultar<{ id: string }>({
      texto: `INSERT INTO public.despesas
                (id, loja_id, descricao, categoria, valor_centavos, data_despesa, criada_por_usuario_id)
              VALUES ($1, $2, $3, $4, $5::bigint, $6::date, $7)
              ON CONFLICT (id) DO NOTHING RETURNING id`,
      parametros: [entrada.id, entrada.lojaId, entrada.descricao, entrada.categoria,
        entrada.valorCentavos, entrada.dataDespesa, autorUsuarioId],
    });
    if (inserida.rows.length) return { id: entrada.id, repetida: false };
    const anterior = await cliente.consultar<{
      id: string; loja_id: string; descricao: string; categoria: string;
      valor_centavos: string; data_despesa: string;
    }>({
      texto: `SELECT id, loja_id, descricao, categoria, valor_centavos::text, data_despesa::text
                FROM public.despesas WHERE id = $1`, parametros: [entrada.id],
    });
    const despesa = anterior.rows[0];
    const igual = despesa?.loja_id === entrada.lojaId && despesa.descricao === entrada.descricao &&
      despesa.categoria === entrada.categoria && despesa.valor_centavos === entrada.valorCentavos &&
      despesa.data_despesa === entrada.dataDespesa;
    if (!igual) throw new ErroFinanceiro("Identificador já utilizado por outra despesa.", 409);
    return { id: entrada.id, repetida: true };
  });
}
