import "server-only";
import { randomUUID } from "node:crypto";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";
import { ErroMeta, validarEdicaoMeta, validarNovaMeta } from "../dominio/meta";

type LinhaMeta = {
  id: string; loja_id: string; loja_nome: string; vendedor_usuario_id: string;
  vendedor_nome: string; nome: string; alvo_centavos: string; inicio_data: string;
  fim_data: string; versao: number; realizado_centavos: string; quantidade_vendas: number;
};

type MetaAtual = {
  id: string; loja_id: string; vendedor_usuario_id: string; nome: string;
  alvo_centavos: string; inicio_data: string; fim_data: string; versao: number;
};

const selecionarMetas = `SELECT m.id, m.loja_id, l.nome AS loja_nome,
       m.vendedor_usuario_id, u.nome_exibicao AS vendedor_nome, m.nome,
       m.alvo_centavos::text, m.inicio_data::text, m.fim_data::text, m.versao,
       COALESCE(sum(v.total_centavos), 0)::text AS realizado_centavos,
       count(v.id)::integer AS quantidade_vendas
  FROM public.metas m
  JOIN public.lojas l ON l.id = m.loja_id AND l.ativa = true
  JOIN public.usuarios u ON u.id = m.vendedor_usuario_id AND u.ativo = true
  LEFT JOIN public.vendas v
    ON v.loja_id = m.loja_id AND v.vendedor_usuario_id = m.vendedor_usuario_id
   AND (v.realizada_em AT TIME ZONE 'America/Sao_Paulo')::date
       BETWEEN m.inicio_data AND m.fim_data`;

function apresentar(linha: LinhaMeta) {
  return {
    id: linha.id, lojaId: linha.loja_id, lojaNome: linha.loja_nome,
    vendedorUsuarioId: linha.vendedor_usuario_id, vendedorNome: linha.vendedor_nome,
    nome: linha.nome, alvoCentavos: linha.alvo_centavos, inicioData: linha.inicio_data,
    fimData: linha.fim_data, versao: linha.versao,
    realizadoCentavos: linha.realizado_centavos, quantidadeVendas: linha.quantidade_vendas,
  };
}

export async function listarMetasEquipe(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return [];
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<LinhaMeta>({
      texto: `${selecionarMetas}
       WHERE m.loja_id = ANY($1::uuid[])
       GROUP BY m.id, l.nome, u.nome_exibicao
       ORDER BY m.inicio_data DESC, m.nome, m.id`,
      parametros: [lojasAutorizadas],
    });
    return resultado.rows.map(apresentar);
  });
}

export async function listarMetasProprias(usuarioId: string, lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return [];
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<LinhaMeta>({
      texto: `${selecionarMetas}
       WHERE m.vendedor_usuario_id = $1 AND m.loja_id = ANY($2::uuid[])
       GROUP BY m.id, l.nome, u.nome_exibicao
       ORDER BY m.inicio_data DESC, m.nome, m.id`,
      parametros: [usuarioId, lojasAutorizadas],
    });
    return resultado.rows.map(apresentar);
  });
}

export async function listarResponsaveisMetas(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return [];
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{
      id: string; nome: string; perfil: "administrador" | "vendedor";
      loja_id: string; loja_nome: string;
    }>({ texto: `SELECT u.id, u.nome_exibicao AS nome, u.perfil, ul.loja_id, l.nome AS loja_nome
                    FROM public.usuarios u
                    JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id AND ul.ativo = true
                    JOIN public.lojas l ON l.id = ul.loja_id AND l.ativa = true
                   WHERE u.ativo = true AND u.perfil IN ('administrador', 'vendedor')
                     AND ul.loja_id = ANY($1::uuid[])
                   ORDER BY u.nome_exibicao, l.nome, u.id`, parametros: [lojasAutorizadas] });
    return resultado.rows.map((linha) => ({ id: linha.id, nome: linha.nome, perfil: linha.perfil,
      lojaId: linha.loja_id, lojaNome: linha.loja_nome }));
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
      try { await cliente.consultar({ texto: "ROLLBACK", parametros: [] }); } catch { /* preservar erro */ }
      throw erro;
    }
  });
}

async function conferirResponsavel(cliente: ClienteBanco, lojaId: string, usuarioId: string) {
  const resultado = await cliente.consultar<{ id: string }>({
    texto: `SELECT u.id FROM public.usuarios u
              JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = $1 AND ul.ativo = true
              JOIN public.lojas l ON l.id = ul.loja_id AND l.ativa = true
             WHERE u.id = $2 AND u.ativo = true AND u.perfil IN ('administrador', 'vendedor')
             FOR SHARE OF u, ul, l`, parametros: [lojaId, usuarioId],
  });
  if (!resultado.rows.length) throw new ErroMeta("Responsável não está ativo ou vinculado à loja.", 409);
}

function igual(meta: MetaAtual, entrada: ReturnType<typeof validarNovaMeta>) {
  return meta.loja_id === entrada.lojaId && meta.vendedor_usuario_id === entrada.vendedorUsuarioId
    && meta.nome === entrada.nome && meta.alvo_centavos === entrada.alvoCentavos
    && meta.inicio_data === entrada.inicioData && meta.fim_data === entrada.fimData;
}

export async function criarMeta(
  autorUsuarioId: string, lojasAutorizadas: readonly string[], dados: Record<string, unknown>,
) {
  const entrada = validarNovaMeta(dados);
  if (!lojasAutorizadas.includes(entrada.lojaId)) throw new ErroMeta("Acesso negado.", 403);
  return transacao(async (cliente) => {
    await conferirResponsavel(cliente, entrada.lojaId, entrada.vendedorUsuarioId);
    const incluida = await cliente.consultar<MetaAtual>({
      texto: `INSERT INTO public.metas
                (id, loja_id, vendedor_usuario_id, nome, alvo_centavos, inicio_data, fim_data,
                 criada_por_usuario_id, atualizada_por_usuario_id)
              VALUES ($1, $2, $3, $4, $5::bigint, $6::date, $7::date, $8, $8)
              ON CONFLICT (id) DO NOTHING
              RETURNING id, loja_id, vendedor_usuario_id, nome, alvo_centavos::text,
                        inicio_data::text, fim_data::text, versao`,
      parametros: [entrada.id, entrada.lojaId, entrada.vendedorUsuarioId, entrada.nome,
        entrada.alvoCentavos, entrada.inicioData, entrada.fimData, autorUsuarioId],
    });
    if (!incluida.rows.length) {
      const anterior = await cliente.consultar<MetaAtual>({
        texto: `SELECT id, loja_id, vendedor_usuario_id, nome, alvo_centavos::text,
                       inicio_data::text, fim_data::text, versao
                  FROM public.metas WHERE id = $1`, parametros: [entrada.id],
      });
      if (!anterior.rows[0] || !igual(anterior.rows[0], entrada))
        throw new ErroMeta("Identificador já utilizado por outra meta.", 409);
      return { id: entrada.id, versao: anterior.rows[0].versao, repetida: true };
    }
    await cliente.consultar({
      texto: `INSERT INTO public.historico_metas
                (id, meta_id, loja_id, vendedor_usuario_id, versao, nome, alvo_centavos,
                 inicio_data, fim_data, tipo_alteracao, alterada_por_usuario_id)
              VALUES ($1, $2, $3, $4, 1, $5, $6::bigint, $7::date, $8::date, 'criacao', $9)`,
      parametros: [randomUUID(), entrada.id, entrada.lojaId, entrada.vendedorUsuarioId,
        entrada.nome, entrada.alvoCentavos, entrada.inicioData, entrada.fimData, autorUsuarioId],
    });
    return { id: entrada.id, versao: 1, repetida: false };
  });
}

export async function editarMeta(
  autorUsuarioId: string, lojasAutorizadas: readonly string[], dados: Record<string, unknown>,
) {
  if (typeof dados["id"] !== "string") throw new ErroMeta("Identificador da meta inválido.");
  return transacao(async (cliente) => {
    const atual = await cliente.consultar<MetaAtual>({
      texto: `SELECT id, loja_id, vendedor_usuario_id, nome, alvo_centavos::text,
                     inicio_data::text, fim_data::text, versao
                FROM public.metas
               WHERE id = $1 AND loja_id = ANY($2::uuid[])
               FOR UPDATE`, parametros: [dados["id"], lojasAutorizadas],
    });
    const meta = atual.rows[0];
    if (!meta) throw new ErroMeta("Meta não encontrada.", 404);
    const entrada = validarEdicaoMeta({ ...dados, lojaIdFixa: meta.loja_id,
      vendedorUsuarioIdFixo: meta.vendedor_usuario_id });
    const mesmosDados = meta.nome === entrada.nome && meta.alvo_centavos === entrada.alvoCentavos
      && meta.inicio_data === entrada.inicioData && meta.fim_data === entrada.fimData;
    if (meta.versao !== entrada.versaoEsperada) {
      if (meta.versao === entrada.versaoEsperada + 1 && mesmosDados)
        return { id: meta.id, versao: meta.versao, repetida: true };
      throw new ErroMeta("A meta foi alterada em outra sessão. Recarregue antes de editar.", 409);
    }
    if (mesmosDados) return { id: meta.id, versao: meta.versao, repetida: true };
    const versao = meta.versao + 1;
    await cliente.consultar({
      texto: `UPDATE public.metas
                 SET nome = $2, alvo_centavos = $3::bigint, inicio_data = $4::date,
                     fim_data = $5::date, versao = $6, atualizada_por_usuario_id = $7,
                     atualizada_em = now()
               WHERE id = $1`,
      parametros: [meta.id, entrada.nome, entrada.alvoCentavos, entrada.inicioData,
        entrada.fimData, versao, autorUsuarioId],
    });
    await cliente.consultar({
      texto: `INSERT INTO public.historico_metas
                (id, meta_id, loja_id, vendedor_usuario_id, versao, nome, alvo_centavos,
                 inicio_data, fim_data, tipo_alteracao, alterada_por_usuario_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7::bigint, $8::date, $9::date, 'edicao', $10)`,
      parametros: [randomUUID(), meta.id, meta.loja_id, meta.vendedor_usuario_id, versao,
        entrada.nome, entrada.alvoCentavos, entrada.inicioData, entrada.fimData, autorUsuarioId],
    });
    return { id: meta.id, versao, repetida: false };
  });
}

export async function listarHistoricoMeta(metaId: string, lojasAutorizadas: readonly string[]) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{
      versao: number; nome: string; alvo_centavos: string; inicio_data: string;
      fim_data: string; tipo_alteracao: "criacao" | "edicao"; alterada_em: string; autor: string;
    }>({ texto: `SELECT h.versao, h.nome, h.alvo_centavos::text, h.inicio_data::text,
                         h.fim_data::text, h.tipo_alteracao, h.alterada_em,
                         u.nome_exibicao AS autor
                    FROM public.historico_metas h
                    JOIN public.usuarios u ON u.id = h.alterada_por_usuario_id
                   WHERE h.meta_id = $1 AND h.loja_id = ANY($2::uuid[])
                   ORDER BY h.versao DESC`, parametros: [metaId, lojasAutorizadas] });
    return resultado.rows.map((linha) => ({ versao: linha.versao, nome: linha.nome,
      alvoCentavos: linha.alvo_centavos, inicioData: linha.inicio_data, fimData: linha.fim_data,
      tipoAlteracao: linha.tipo_alteracao, alteradaEm: linha.alterada_em, autor: linha.autor }));
  });
}
