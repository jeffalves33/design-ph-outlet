import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";
import { ErroMovimentacao, saldoAposMovimento, validarMovimentacao } from "../dominio/movimentacao";

type LinhaOperacao = { id: string; impressao_requisicao: string };
type LinhaMovimento = { id: string; saldo_apos: string };

async function transacao<T>(executar: (cliente: ClienteBanco) => Promise<T>) {
  return comClienteBanco(async (cliente) => {
    await cliente.consultar({ texto: "BEGIN", parametros: [] });
    try {
      const resultado = await executar(cliente);
      await cliente.consultar({ texto: "COMMIT", parametros: [] });
      return resultado;
    } catch (erro) {
      try { await cliente.consultar({ texto: "ROLLBACK", parametros: [] }); } catch { /* preservar erro original */ }
      throw erro;
    }
  });
}

export async function registrarMovimentacao(
  lojaId: string, categoriaId: string, autorUsuarioId: string,
  tipo: unknown, variacao: unknown, motivo: unknown, chaveIdempotencia: unknown,
) {
  const entrada = validarMovimentacao(tipo, variacao, motivo, chaveIdempotencia);
  const impressao = createHash("sha256").update(JSON.stringify({
    lojaId, categoriaId, autorUsuarioId, ...entrada,
  })).digest("hex");

  return transacao(async (cliente) => {
    const operacaoId = randomUUID();
    const incluida = await cliente.consultar<{ id: string }>({
      texto: `INSERT INTO public.operacoes_estoque
                (id, loja_id, autor_usuario_id, chave_idempotencia, impressao_requisicao, tipo, motivo)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (loja_id, chave_idempotencia) DO NOTHING RETURNING id`,
      parametros: [operacaoId, lojaId, autorUsuarioId, entrada.chaveIdempotencia,
        impressao, entrada.tipo, entrada.motivo],
    });

    if (!incluida.rows.length) {
      const anterior = await cliente.consultar<LinhaOperacao>({
        texto: `SELECT id, impressao_requisicao FROM public.operacoes_estoque
                WHERE loja_id = $1 AND chave_idempotencia = $2`,
        parametros: [lojaId, entrada.chaveIdempotencia],
      });
      if (!anterior.rows.length || anterior.rows[0]!.impressao_requisicao !== impressao)
        throw new ErroMovimentacao("Chave já usada por outra operação.", 409);
      const movimento = await cliente.consultar<LinhaMovimento>({
        texto: `SELECT id, saldo_apos::text FROM public.movimentos_estoque
                WHERE operacao_estoque_id = $1 AND loja_id = $2 AND categoria_id = $3`,
        parametros: [anterior.rows[0]!.id, lojaId, categoriaId],
      });
      if (!movimento.rows.length) throw new ErroMovimentacao("Operação anterior incompleta.", 503);
      return { id: anterior.rows[0]!.id, saldoApos: movimento.rows[0]!.saldo_apos, repetida: true };
    }

    const saldo = await cliente.consultar<{ quantidade: string }>({
      texto: `SELECT s.quantidade::text FROM public.saldos_estoque s
                JOIN public.categorias c ON c.id = s.categoria_id AND c.loja_id = s.loja_id
                JOIN public.lojas l ON l.id = c.loja_id
               WHERE c.id = $1 AND c.loja_id = $2 AND c.arquivada_em IS NULL AND l.ativa = true
               FOR UPDATE OF s`,
      parametros: [categoriaId, lojaId],
    });
    if (!saldo.rows.length) throw new ErroMovimentacao("Categoria não encontrada nesta loja ou arquivada.", 404);
    const saldoApos = saldoAposMovimento(saldo.rows[0]!.quantidade, entrada.variacao);
    await cliente.consultar({
      texto: `UPDATE public.saldos_estoque
                 SET quantidade = $3::bigint, atualizado_em = now()
               WHERE categoria_id = $1 AND loja_id = $2`,
      parametros: [categoriaId, lojaId, saldoApos],
    });
    await cliente.consultar({
      texto: `INSERT INTO public.movimentos_estoque
                (id, loja_id, categoria_id, autor_usuario_id, operacao_estoque_id,
                 variacao_quantidade, saldo_apos, motivo)
              VALUES ($1, $2, $3, $4, $5, $6, $7::bigint, $8)`,
      parametros: [randomUUID(), lojaId, categoriaId, autorUsuarioId, operacaoId,
        entrada.variacao, saldoApos, entrada.motivo],
    });
    return { id: operacaoId, saldoApos, repetida: false };
  });
}

export async function listarMovimentacoes(lojaId: string, categoriaId: string) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{
      id: string; tipo: "entrada" | "ajuste"; variacao_quantidade: string;
      saldo_apos: string; motivo: string; criado_em: string; autor: string;
    }>({
      texto: `SELECT m.id, o.tipo, m.variacao_quantidade::text, m.saldo_apos::text,
                     m.motivo, m.criado_em, u.nome_exibicao AS autor
                FROM public.movimentos_estoque m
                JOIN public.operacoes_estoque o ON o.id = m.operacao_estoque_id AND o.loja_id = m.loja_id
                JOIN public.usuarios u ON u.id = m.autor_usuario_id
               WHERE m.loja_id = $1 AND m.categoria_id = $2
               ORDER BY m.criado_em DESC, m.id DESC LIMIT 50`,
      parametros: [lojaId, categoriaId],
    });
    return resultado.rows;
  });
}

export async function consultarOperacaoEstoque(lojaId: string, chaveIdempotencia: string) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<{
      id: string; categoria_id: string | null; saldo_apos: string | null;
      nome: string | null; tamanho: string | null;
    }>({
      texto: `SELECT o.id, m.categoria_id, m.saldo_apos::text, c.nome, c.tamanho
                FROM public.operacoes_estoque o
                LEFT JOIN public.movimentos_estoque m
                  ON m.operacao_estoque_id = o.id AND m.loja_id = o.loja_id
                LEFT JOIN public.categorias c
                  ON c.id = m.categoria_id AND c.loja_id = m.loja_id
               WHERE o.loja_id = $1 AND o.chave_idempotencia = $2`,
      parametros: [lojaId, chaveIdempotencia],
    });
    const linha = resultado.rows[0];
    if (!linha) return null;
    if (!linha.categoria_id || linha.saldo_apos === null || !linha.nome || !linha.tamanho)
      throw new ErroMovimentacao("Operação encontrada sem movimento íntegro; solicite conferência.", 503);
    return { id: linha.id, categoriaId: linha.categoria_id, saldoApos: linha.saldo_apos,
      nome: linha.nome, tamanho: linha.tamanho };
  });
}
