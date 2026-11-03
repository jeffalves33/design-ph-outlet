import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";
import { ErroVenda, validarVenda } from "../dominio/venda";

type LinhaVenda = {
  id: string;
  vendedor_usuario_id: string;
  cliente_id: string | null;
  impressao_requisicao: string;
  total_centavos: string;
  realizada_em: string;
};

type LinhaItem = {
  categoria_id: string;
  codigo_registrado: number;
  nome_registrado: string;
  tamanho_registrado: string;
  preco_unitario_centavos: string;
  quantidade: number;
  total_linha_centavos: string;
};

type LinhaCategoria = {
  id: string;
  codigo: number;
  nome: string;
  tamanho: string;
  preco_centavos: string;
  quantidade: string;
};

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

function impressaoRequisicao(
  lojaId: string,
  autorUsuarioId: string,
  venda: ReturnType<typeof validarVenda>,
) {
  return createHash("sha256").update(JSON.stringify({
    lojaId,
    autorUsuarioId,
    vendedorUsuarioId: venda.vendedorUsuarioId,
    clienteId: venda.clienteId,
    itens: venda.itens,
  })).digest("hex");
}

async function carregarVenda(cliente: ClienteBanco, lojaId: string, chaveIdempotencia: string) {
  const cabecalho = await cliente.consultar<LinhaVenda>({
    texto: `SELECT id, vendedor_usuario_id, cliente_id, impressao_requisicao,
                   total_centavos::text, realizada_em
              FROM public.vendas
             WHERE loja_id = $1 AND chave_idempotencia = $2`,
    parametros: [lojaId, chaveIdempotencia],
  });
  const venda = cabecalho.rows[0];
  if (!venda) return null;
  const itens = await cliente.consultar<LinhaItem>({
    texto: `SELECT categoria_id, codigo_registrado, nome_registrado, tamanho_registrado,
                   preco_unitario_centavos::text, quantidade, total_linha_centavos::text
              FROM public.itens_venda
             WHERE venda_id = $1 AND loja_id = $2
             ORDER BY categoria_id`,
    parametros: [venda.id, lojaId],
  });
  const movimentos = await cliente.consultar<{ categoria_id: string }>(
    { texto: `SELECT categoria_id FROM public.movimentos_estoque
               WHERE venda_id = $1 AND loja_id = $2 ORDER BY categoria_id`, parametros: [venda.id, lojaId] },
  );
  if (!itens.rows.length || movimentos.rows.length !== itens.rows.length) {
    throw new ErroVenda("Venda encontrada sem baixa íntegra; solicite conferência.", 503);
  }
  const soma = itens.rows.reduce((total, item) => total + BigInt(item.total_linha_centavos), 0n);
  if (soma.toString() !== venda.total_centavos) {
    throw new ErroVenda("Venda encontrada com total inconsistente; solicite conferência.", 503);
  }
  return {
    id: venda.id,
    vendedorUsuarioId: venda.vendedor_usuario_id,
    clienteId: venda.cliente_id,
    impressaoRequisicao: venda.impressao_requisicao,
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
}

function respostaVenda(venda: NonNullable<Awaited<ReturnType<typeof carregarVenda>>>, repetida?: boolean) {
  const { impressaoRequisicao: _impressaoInterna, ...resultado } = venda;
  return repetida === undefined ? resultado : { ...resultado, repetida };
}

export async function confirmarVenda(
  lojaId: string,
  autorUsuarioId: string,
  vendedorUsuarioId: unknown,
  itensInformados: unknown,
  chaveIdempotencia: unknown,
  clienteIdInformado: unknown = null,
) {
  const entrada = validarVenda(vendedorUsuarioId, itensInformados, chaveIdempotencia, clienteIdInformado);
  const impressao = impressaoRequisicao(lojaId, autorUsuarioId, entrada);
  return transacao(async (cliente) => {
    const anterior = await carregarVenda(cliente, lojaId, entrada.chaveIdempotencia);
    if (anterior) {
      if (anterior.impressaoRequisicao !== impressao) {
        throw new ErroVenda("Chave já usada por outra venda.", 409);
      }
      return respostaVenda(anterior, true);
    }

    const participantes = await cliente.consultar<{ id: string; perfil: "administrador" | "vendedor" }>(
      { texto: `SELECT u.id, u.perfil
                  FROM public.usuarios u
                  JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id AND ul.loja_id = $1 AND ul.ativo = true
                  JOIN public.lojas l ON l.id = ul.loja_id AND l.ativa = true
                 WHERE u.id = ANY($2::uuid[]) AND u.ativo = true
                 FOR SHARE OF u, ul, l`, parametros: [lojaId, [autorUsuarioId, entrada.vendedorUsuarioId]] },
    );
    const autorValido = participantes.rows.some((linha) => linha.id === autorUsuarioId && linha.perfil === "administrador");
    const vendedorValido = participantes.rows.some((linha) => linha.id === entrada.vendedorUsuarioId);
    if (!autorValido) throw new ErroVenda("Autor ou vínculo com a loja não está mais ativo.", 403);
    if (!vendedorValido) throw new ErroVenda("Responsável pela venda não está ativo ou vinculado à loja.", 409);

    if (entrada.clienteId) {
      const clienteVinculado = await cliente.consultar<{ id: string }>({
        texto: `SELECT id FROM public.clientes WHERE id = $1 FOR SHARE`,
        parametros: [entrada.clienteId],
      });
      if (!clienteVinculado.rows.length) throw new ErroVenda("Cliente não encontrado.", 409);
    }

    const categorias = await cliente.consultar<LinhaCategoria>({
      texto: `SELECT c.id, c.codigo, c.nome, c.tamanho, c.preco_centavos::text,
                     s.quantidade::text
                FROM public.categorias c
                JOIN public.saldos_estoque s ON s.categoria_id = c.id AND s.loja_id = c.loja_id
               WHERE c.loja_id = $1 AND c.id = ANY($2::uuid[]) AND c.arquivada_em IS NULL
               ORDER BY c.id
               FOR UPDATE OF c, s`,
      parametros: [lojaId, entrada.itens.map((item) => item.categoriaId)],
    });
    if (categorias.rows.length !== entrada.itens.length) {
      throw new ErroVenda("Um ou mais itens não estão disponíveis nesta loja.", 409);
    }

    // Uma requisição com a mesma chave pode ter confirmado enquanto esta aguardava os locks.
    const confirmadaEnquantoAguardava = await carregarVenda(cliente, lojaId, entrada.chaveIdempotencia);
    if (confirmadaEnquantoAguardava) {
      if (confirmadaEnquantoAguardava.impressaoRequisicao !== impressao) {
        throw new ErroVenda("Chave já usada por outra venda.", 409);
      }
      return respostaVenda(confirmadaEnquantoAguardava, true);
    }

    const porId = new Map(categorias.rows.map((categoria) => [categoria.id, categoria]));
    const linhas = entrada.itens.map((item) => {
      const categoria = porId.get(item.categoriaId)!;
      if (BigInt(categoria.quantidade) < BigInt(item.quantidade)) {
        throw new ErroVenda(`Estoque insuficiente para ${categoria.nome} · ${categoria.tamanho}.`, 409);
      }
      const totalLinha = BigInt(categoria.preco_centavos) * BigInt(item.quantidade);
      return { ...item, categoria, totalLinha };
    });
    const total = linhas.reduce((soma, linha) => soma + linha.totalLinha, 0n);
    if (total > 9223372036854775807n) throw new ErroVenda("Total da venda excede o limite permitido.", 409);

    const vendaId = randomUUID();
    const incluida = await cliente.consultar<{ id: string }>({
      texto: `INSERT INTO public.vendas
                (id, loja_id, autor_usuario_id, vendedor_usuario_id, chave_idempotencia,
                 impressao_requisicao, total_centavos, cliente_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7::bigint, $8)
              ON CONFLICT (loja_id, chave_idempotencia) DO NOTHING RETURNING id`,
      parametros: [vendaId, lojaId, autorUsuarioId, entrada.vendedorUsuarioId,
        entrada.chaveIdempotencia, impressao, total.toString(), entrada.clienteId],
    });
    if (!incluida.rows.length) {
      const concorrente = await carregarVenda(cliente, lojaId, entrada.chaveIdempotencia);
      if (!concorrente) throw new ErroVenda("Não foi possível reconciliar a venda concorrente.", 503);
      if (concorrente.impressaoRequisicao !== impressao) throw new ErroVenda("Chave já usada por outra venda.", 409);
      return respostaVenda(concorrente, true);
    }

    for (const linha of linhas) {
      const saldo = await cliente.consultar<{ quantidade: string }>({
        texto: `UPDATE public.saldos_estoque
                   SET quantidade = quantidade - $3::bigint, atualizado_em = now()
                 WHERE categoria_id = $1 AND loja_id = $2 AND quantidade >= $3::bigint
             RETURNING quantidade::text`,
        parametros: [linha.categoriaId, lojaId, linha.quantidade],
      });
      const saldoApos = saldo.rows[0]?.quantidade;
      if (saldoApos === undefined) throw new ErroVenda("Estoque alterado durante a confirmação.", 409);
      await cliente.consultar({
        texto: `INSERT INTO public.itens_venda
                  (id, venda_id, loja_id, categoria_id, codigo_registrado, nome_registrado,
                   tamanho_registrado, preco_unitario_centavos, quantidade, total_linha_centavos)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::bigint, $9, $10::bigint)`,
        parametros: [randomUUID(), vendaId, lojaId, linha.categoriaId, linha.categoria.codigo,
          linha.categoria.nome, linha.categoria.tamanho, linha.categoria.preco_centavos,
          linha.quantidade, linha.totalLinha.toString()],
      });
      await cliente.consultar({
        texto: `INSERT INTO public.movimentos_estoque
                  (id, loja_id, categoria_id, autor_usuario_id, venda_id,
                   variacao_quantidade, saldo_apos, motivo)
                VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8)`,
        parametros: [randomUUID(), lojaId, linha.categoriaId, autorUsuarioId, vendaId,
          -linha.quantidade, saldoApos, "Venda confirmada"],
      });
    }
    const confirmada = await carregarVenda(cliente, lojaId, entrada.chaveIdempotencia);
    if (!confirmada) throw new ErroVenda("Venda não pôde ser conferida.", 503);
    return respostaVenda(confirmada, false);
  });
}

export async function consultarVenda(lojaId: string, chaveIdempotencia: string) {
  if (typeof chaveIdempotencia !== "string" || !/^[A-Za-z0-9_-]{16,200}$/.test(chaveIdempotencia)) {
    throw new ErroVenda("Consulta inválida.");
  }
  return comClienteBanco(async (cliente) => {
    const venda = await carregarVenda(cliente, lojaId, chaveIdempotencia);
    return venda ? respostaVenda(venda) : null;
  });
}
