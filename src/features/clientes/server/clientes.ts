import "server-only";
import { comClienteBanco } from "@/integrations/server/postgres-client";
import { ErroCliente, validarNovoCliente } from "../dominio/cliente";

type LinhaCliente = {
  id: string; nome: string; whatsapp_digitos: string; data_nascimento: string | null;
  cidade: string | null; loja_preferida_id: string | null; loja_preferida_nome: string | null;
  observacao: string | null; criada_em: string;
};
type LinhaVenda = {
  id: string; cliente_id: string; total_centavos: string; realizada_em: string;
  loja_nome: string; itens: string;
};

function apresentarCliente(linha: LinhaCliente, vendas: LinhaVenda[]) {
  const historico = vendas.filter((venda) => venda.cliente_id === linha.id).map((venda) => ({
    id: venda.id, totalCentavos: venda.total_centavos, realizadaEm: venda.realizada_em,
    lojaNome: venda.loja_nome, itens: venda.itens,
  }));
  return {
    id: linha.id, nome: linha.nome, whatsappDigitos: linha.whatsapp_digitos,
    dataNascimento: linha.data_nascimento, cidade: linha.cidade,
    lojaPreferidaId: linha.loja_preferida_id, lojaPreferidaNome: linha.loja_preferida_nome,
    observacao: linha.observacao, criadaEm: linha.criada_em, vendas: historico,
    quantidadeCompras: historico.length,
    totalCentavos: historico.reduce((soma, venda) => soma + BigInt(venda.totalCentavos), 0n).toString(),
  };
}

export async function listarClientes(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return { clientes: [], lojas: [] };
  return comClienteBanco(async (cliente) => {
    const [lojas, clientes] = await Promise.all([
      cliente.consultar<{ id: string; nome: string }>({
        texto: `SELECT id, nome FROM public.lojas
                 WHERE ativa = true AND id = ANY($1::uuid[]) ORDER BY nome`,
        parametros: [lojasAutorizadas],
      }),
      cliente.consultar<LinhaCliente>({
        texto: `SELECT c.id, c.nome, c.whatsapp_digitos, c.data_nascimento::text,
                       c.cidade, c.loja_preferida_id, l.nome AS loja_preferida_nome,
                       c.observacao, c.criada_em
                  FROM public.clientes c
                  LEFT JOIN public.lojas l ON l.id = c.loja_preferida_id
                 WHERE c.loja_preferida_id IS NULL OR c.loja_preferida_id = ANY($1::uuid[])
                 ORDER BY lower(c.nome), c.id`,
        parametros: [lojasAutorizadas],
      }),
    ]);
    const ids = clientes.rows.map((linha) => linha.id);
    const vendas = ids.length ? await cliente.consultar<LinhaVenda>({
      texto: `SELECT v.id, v.cliente_id, v.total_centavos::text, v.realizada_em,
                     l.nome AS loja_nome,
                     string_agg(iv.quantidade::text || '× ' || iv.nome_registrado || ' · ' ||
                       iv.tamanho_registrado, ', ' ORDER BY iv.nome_registrado, iv.tamanho_registrado) AS itens
                FROM public.vendas v
                JOIN public.lojas l ON l.id = v.loja_id
                JOIN public.itens_venda iv ON iv.venda_id = v.id AND iv.loja_id = v.loja_id
               WHERE v.cliente_id = ANY($1::uuid[]) AND v.loja_id = ANY($2::uuid[])
               GROUP BY v.id, l.nome
               ORDER BY v.realizada_em DESC`,
      parametros: [ids, lojasAutorizadas],
    }) : { rows: [] as LinhaVenda[] };
    return { lojas: lojas.rows, clientes: clientes.rows.map((linha) => apresentarCliente(linha, vendas.rows)) };
  });
}

export async function criarCliente(
  autorUsuarioId: string,
  lojasAutorizadas: readonly string[],
  dados: Record<string, unknown>,
) {
  const entrada = validarNovoCliente(dados);
  if (entrada.lojaPreferidaId && !lojasAutorizadas.includes(entrada.lojaPreferidaId))
    throw new ErroCliente("Acesso negado à loja preferida.", 403);
  return comClienteBanco(async (cliente) => {
    const inserido = await cliente.consultar<{ id: string }>({
      texto: `INSERT INTO public.clientes
                (id, nome, whatsapp_digitos, data_nascimento, cidade, loja_preferida_id,
                 observacao, criada_por_usuario_id)
              VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)
              ON CONFLICT DO NOTHING RETURNING id`,
      parametros: [entrada.id, entrada.nome, entrada.whatsappDigitos, entrada.dataNascimento,
        entrada.cidade, entrada.lojaPreferidaId, entrada.observacao, autorUsuarioId],
    });
    if (inserido.rows.length) return { id: entrada.id, repetido: false };
    const existente = await cliente.consultar<{
      id: string; nome: string; whatsapp_digitos: string; data_nascimento: string | null;
      cidade: string | null; loja_preferida_id: string | null; observacao: string | null;
    }>({
      texto: `SELECT id, nome, whatsapp_digitos, data_nascimento::text, cidade,
                     loja_preferida_id, observacao
                FROM public.clientes WHERE id = $1 OR whatsapp_digitos = $2`,
      parametros: [entrada.id, entrada.whatsappDigitos],
    });
    const anterior = existente.rows[0];
    const igual = anterior?.id === entrada.id && anterior.nome === entrada.nome &&
      anterior.whatsapp_digitos === entrada.whatsappDigitos &&
      anterior.data_nascimento === entrada.dataNascimento && anterior.cidade === entrada.cidade &&
      anterior.loja_preferida_id === entrada.lojaPreferidaId && anterior.observacao === entrada.observacao;
    if (!igual) throw new ErroCliente("WhatsApp já cadastrado para outro cliente.", 409);
    return { id: entrada.id, repetido: true };
  });
}
