import "server-only";

import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";

export type Notificacao = Readonly<{
  chave: string;
  tipo: "aniversario" | "estoque_zerado";
  lojaId: string | null;
  titulo: string;
  descricao: string;
  lida: boolean;
}>;

type ClienteAniversario = { id: string; nome: string; data_nascimento: string };
type CategoriaSemEstoque = {
  id: string; loja_id: string; nome: string; tamanho: string; codigo: number; atualizado_em: string;
};

export class ErroNotificacao extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ErroNotificacao";
  }
}

export function proximoAniversario(nascimento: string, agora = new Date()) {
  const hojeTexto = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(agora);
  const [anoHoje, mesHoje, diaHoje] = hojeTexto.split("-").map(Number);
  const [, mesNascimento, diaNascimento] = nascimento.split("-").map(Number);
  const jaPassou = `${String(mesNascimento).padStart(2, "0")}-${String(diaNascimento).padStart(2, "0")}` <
    `${String(mesHoje).padStart(2, "0")}-${String(diaHoje).padStart(2, "0")}`;
  const ano = (anoHoje ?? 0) + (jaPassou ? 1 : 0);
  const hoje = Date.UTC(anoHoje ?? 0, (mesHoje ?? 1) - 1, diaHoje ?? 1);
  const proximo = Date.UTC(ano, (mesNascimento ?? 1) - 1, diaNascimento ?? 1);
  return { ano, dias: Math.round((proximo - hoje) / 86_400_000) };
}

async function carregarAtivas(cliente: ClienteBanco, lojas: readonly string[], agora: Date) {
  if (!lojas.length) return [];
  const [clientes, categorias] = await Promise.all([
    cliente.consultar<ClienteAniversario>({
      texto: `SELECT id, nome, data_nascimento::text
                FROM public.clientes
               WHERE data_nascimento IS NOT NULL
                 AND (loja_preferida_id IS NULL OR loja_preferida_id = ANY($1::uuid[]))
               ORDER BY lower(nome), id`,
      parametros: [lojas],
    }),
    cliente.consultar<CategoriaSemEstoque>({
      texto: `SELECT c.id, c.loja_id, c.nome, c.tamanho, c.codigo, s.atualizado_em::text
                FROM public.categorias c
                JOIN public.lojas l ON l.id = c.loja_id AND l.ativa = true
                JOIN public.saldos_estoque s ON s.categoria_id = c.id AND s.loja_id = c.loja_id
               WHERE c.loja_id = ANY($1::uuid[])
                 AND c.arquivada_em IS NULL
                 AND s.quantidade = 0
               ORDER BY l.nome, c.nome, c.tamanho, c.codigo`,
      parametros: [lojas],
    }),
  ]);
  const aniversarios: Omit<Notificacao, "lida">[] = clientes.rows.flatMap((pessoa) => {
    const aniversario = proximoAniversario(pessoa.data_nascimento, agora);
    return aniversario.dias <= 15 ? [{
      chave: `aniversario:${pessoa.id}:${aniversario.ano}`,
      tipo: "aniversario" as const,
      lojaId: null,
      titulo: pessoa.nome,
      descricao: aniversario.dias === 0 ? "Faz aniversário hoje" : `Aniversário em ${aniversario.dias} dias`,
    }] : [];
  });
  const estoques: Omit<Notificacao, "lida">[] = categorias.rows.map((categoria) => ({
    chave: `estoque:${categoria.id}:${categoria.atualizado_em}`,
    tipo: "estoque_zerado" as const,
    lojaId: categoria.loja_id,
    titulo: `${categoria.nome} · ${categoria.tamanho}`,
    descricao: `${String(categoria.codigo).padStart(5, "0")} · estoque zerado`,
  }));
  return [...aniversarios, ...estoques];
}

export async function listarNotificacoes(usuarioId: string, lojas: readonly string[], agora = new Date()) {
  return comClienteBanco(async (cliente) => {
    const ativas = await carregarAtivas(cliente, lojas, agora);
    if (!ativas.length) return [];
    const leituras = await cliente.consultar<{ chave: string }>({
      texto: `SELECT chave FROM public.notificacoes_lidas
               WHERE usuario_id = $1 AND chave = ANY($2::text[])`,
      parametros: [usuarioId, ativas.map((item) => item.chave)],
    });
    const lidas = new Set(leituras.rows.map((item) => item.chave));
    return ativas.map((item): Notificacao => ({ ...item, lida: lidas.has(item.chave) }));
  });
}

export async function marcarNotificacoesLidas(
  usuarioId: string,
  lojas: readonly string[],
  chavesInformadas: unknown,
  agora = new Date(),
) {
  if (!Array.isArray(chavesInformadas) || chavesInformadas.length < 1 || chavesInformadas.length > 100 ||
      chavesInformadas.some((chave) => typeof chave !== "string" || chave.length > 240))
    throw new ErroNotificacao("Notificações inválidas.");
  const solicitadas = [...new Set(chavesInformadas as string[])];
  return comClienteBanco(async (cliente) => {
    const ativas = new Set((await carregarAtivas(cliente, lojas, agora)).map((item) => item.chave));
    const validas = solicitadas.filter((chave) => ativas.has(chave));
    if (validas.length !== solicitadas.length) throw new ErroNotificacao("Notificação inexistente ou encerrada.", 409);
    await cliente.consultar({
      texto: `INSERT INTO public.notificacoes_lidas (usuario_id, chave)
              SELECT $1, unnest($2::text[])
              ON CONFLICT (usuario_id, chave) DO UPDATE SET lida_em = now()`,
      parametros: [usuarioId, validas],
    });
    return { marcadas: validas.length };
  });
}
