import "server-only";
import { randomUUID } from "node:crypto";
import { comClienteBanco, type ClienteBanco } from "@/integrations/server/postgres-client";
import {
  EMISSOR_COGNITO_PH, ativarContaFuncionario, bloquearContaFuncionario,
  criarContaFuncionario, editarContaFuncionario, excluirContaIncompleta,
  reenviarConviteFuncionario,
} from "@/integrations/server/cognito-admin";
import { ErroFuncionario, validarAcaoFuncionario, validarEdicaoFuncionario,
  validarNovoFuncionario } from "../dominio/funcionario";

type LinhaFuncionario = {
  id: string; nome_exibicao: string; email: string | null; perfil: "administrador" | "vendedor";
  ativo: boolean; sub_cognito: string; loja_id: string | null; loja_nome: string | null;
  vinculo_ativo: boolean | null;
};
type Alvo = { id: string; nome_exibicao: string; email: string | null; sub_cognito: string; ativo: boolean };

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

function conferirLojas(solicitadas: readonly string[], autorizadas: readonly string[]) {
  if (solicitadas.some((loja) => !autorizadas.includes(loja)))
    throw new ErroFuncionario("Acesso negado para uma das lojas.", 403);
}

export async function listarFuncionarios(lojasAutorizadas: readonly string[]) {
  if (!lojasAutorizadas.length) return { funcionarios: [], lojas: [] };
  return comClienteBanco(async (cliente) => {
    const [pessoas, lojas] = await Promise.all([
      cliente.consultar<LinhaFuncionario>({
        texto: `SELECT u.id, u.nome_exibicao, u.email, u.perfil, u.ativo, u.sub_cognito,
                       ul.loja_id, l.nome AS loja_nome, ul.ativo AS vinculo_ativo
                  FROM public.usuarios u
                  LEFT JOIN public.usuarios_lojas ul
                    ON ul.usuario_id = u.id AND ul.loja_id = ANY($1::uuid[])
                  LEFT JOIN public.lojas l ON l.id = ul.loja_id
                 WHERE EXISTS (
                   SELECT 1 FROM public.usuarios_lojas escopo
                    WHERE escopo.usuario_id = u.id AND escopo.loja_id = ANY($1::uuid[])
                 )
                 ORDER BY lower(u.nome_exibicao), u.id, l.nome`,
        parametros: [lojasAutorizadas],
      }),
      cliente.consultar<{ id: string; nome: string }>({
        texto: `SELECT id, nome FROM public.lojas
                 WHERE ativa = true AND id = ANY($1::uuid[]) ORDER BY nome`,
        parametros: [lojasAutorizadas],
      }),
    ]);
    const mapa = new Map<string, {
      id: string; nome: string; email: string; perfil: "administrador" | "vendedor";
      ativo: boolean; lojas: { id: string; nome: string; ativo: boolean }[];
    }>();
    for (const linha of pessoas.rows) {
      const pessoa = mapa.get(linha.id) ?? { id: linha.id, nome: linha.nome_exibicao,
        email: linha.email ?? "", perfil: linha.perfil, ativo: linha.ativo, lojas: [] };
      if (linha.loja_id && linha.loja_nome)
        pessoa.lojas.push({ id: linha.loja_id, nome: linha.loja_nome, ativo: linha.vinculo_ativo === true });
      mapa.set(linha.id, pessoa);
    }
    return { funcionarios: [...mapa.values()], lojas: lojas.rows };
  });
}

async function carregarAlvo(id: string, lojasAutorizadas: readonly string[]) {
  return comClienteBanco(async (cliente) => {
    const resultado = await cliente.consultar<Alvo>({
      texto: `SELECT u.id, u.nome_exibicao, u.email, u.sub_cognito, u.ativo
                FROM public.usuarios u
               WHERE u.id = $1 AND u.perfil = 'vendedor'
                 AND EXISTS (SELECT 1 FROM public.usuarios_lojas ul
                              WHERE ul.usuario_id = u.id AND ul.loja_id = ANY($2::uuid[]))`,
      parametros: [id, lojasAutorizadas],
    });
    if (!resultado.rows[0]) throw new ErroFuncionario("Funcionário não encontrado ou protegido.", 404);
    return resultado.rows[0];
  });
}

async function salvarVinculos(cliente: ClienteBanco, usuarioId: string,
  selecionadas: readonly string[], autorizadas: readonly string[]) {
  await cliente.consultar({
    texto: `UPDATE public.usuarios_lojas SET ativo = false
             WHERE usuario_id = $1 AND loja_id = ANY($2::uuid[])`,
    parametros: [usuarioId, autorizadas],
  });
  for (const lojaId of selecionadas) {
    await cliente.consultar({
      texto: `INSERT INTO public.usuarios_lojas (usuario_id, loja_id, ativo)
             VALUES ($1, $2, true)
             ON CONFLICT (usuario_id, loja_id) DO UPDATE SET ativo = true`,
      parametros: [usuarioId, lojaId],
    });
  }
}

export async function criarFuncionario(lojasAutorizadas: readonly string[], dados: Record<string, unknown>) {
  const entrada = validarNovoFuncionario(dados);
  conferirLojas(entrada.lojas, lojasAutorizadas);
  const duplicado = await comClienteBanco((cliente) => cliente.consultar<{
    id: string; nome_exibicao: string; perfil: string; ativo: boolean; lojas: string[];
  }>({
    texto: `SELECT u.id, u.nome_exibicao, u.perfil, u.ativo,
                   COALESCE(array_agg(ul.loja_id::text ORDER BY ul.loja_id)
                     FILTER (WHERE ul.ativo = true), '{}') AS lojas
              FROM public.usuarios u
              LEFT JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id
             WHERE lower(u.email) = lower($1)
             GROUP BY u.id, u.nome_exibicao, u.perfil, u.ativo
             LIMIT 1`,
    parametros: [entrada.email],
  }));
  if (duplicado.rows[0]) {
    const anterior = duplicado.rows[0];
    const mesmasLojas = [...anterior.lojas].sort().join("|") === [...entrada.lojas].sort().join("|");
    if (anterior.perfil === "vendedor" && anterior.ativo && anterior.nome_exibicao === entrada.nome && mesmasLojas)
      return { id: anterior.id, conviteEnviado: false, repetida: true };
    throw new ErroFuncionario("Já existe um usuário local com este e-mail.", 409);
  }

  const conta = await criarContaFuncionario(entrada.nome, entrada.email);
  const id = randomUUID();
  try {
    await transacao(async (cliente) => {
      await cliente.consultar({
        texto: `INSERT INTO public.usuarios
                  (id, emissor_cognito, sub_cognito, email, nome_exibicao, perfil, ativo)
                VALUES ($1, $2, $3, $4, $5, 'vendedor', true)`,
        parametros: [id, EMISSOR_COGNITO_PH, conta.sub, entrada.email, entrada.nome],
      });
      await salvarVinculos(cliente, id, entrada.lojas, lojasAutorizadas);
    });
  } catch (erro) {
    await excluirContaIncompleta(conta.usuario);
    if (erro instanceof ErroFuncionario) throw erro;
    throw new ErroFuncionario("Não foi possível concluir o cadastro do funcionário.", 409);
  }
  return { id, conviteEnviado: true, repetida: false };
}

export async function editarFuncionario(lojasAutorizadas: readonly string[], dados: Record<string, unknown>) {
  const entrada = validarEdicaoFuncionario(dados);
  conferirLojas(entrada.lojas, lojasAutorizadas);
  const anterior = await carregarAlvo(entrada.id, lojasAutorizadas);
  await editarContaFuncionario(anterior.sub_cognito, entrada.nome, entrada.email);
  try {
    await transacao(async (cliente) => {
      const atualizada = await cliente.consultar({
        texto: `UPDATE public.usuarios SET nome_exibicao = $2, email = $3
                 WHERE id = $1 AND perfil = 'vendedor'
                   AND nome_exibicao = $4 AND email IS NOT DISTINCT FROM $5
                 RETURNING id`,
        parametros: [entrada.id, entrada.nome, entrada.email, anterior.nome_exibicao, anterior.email],
      });
      if (!atualizada.rows.length)
        throw new ErroFuncionario("O funcionário foi alterado em outra sessão. Recarregue antes de editar.", 409);
      await salvarVinculos(cliente, entrada.id, entrada.lojas, lojasAutorizadas);
    });
  } catch (erro) {
    try { await editarContaFuncionario(anterior.sub_cognito, anterior.nome_exibicao, anterior.email ?? entrada.email); }
    catch { throw new ErroFuncionario("Edição local falhou e a compensação do Cognito precisa de conferência.", 503); }
    throw erro;
  }
  return { id: entrada.id };
}

export async function executarAcaoFuncionario(lojasAutorizadas: readonly string[], dados: Record<string, unknown>) {
  const entrada = validarAcaoFuncionario(dados);
  const alvo = await carregarAlvo(entrada.id, lojasAutorizadas);
  if (entrada.acao === "reenviar_convite") {
    await reenviarConviteFuncionario(alvo.sub_cognito);
    return { id: entrada.id, conviteEnviado: true };
  }
  if (entrada.acao === "bloquear") {
    await comClienteBanco((cliente) => cliente.consultar({
      texto: "UPDATE public.usuarios SET ativo = false WHERE id = $1 AND perfil = 'vendedor'",
      parametros: [entrada.id],
    }));
    await bloquearContaFuncionario(alvo.sub_cognito);
    return { id: entrada.id, ativo: false, sessoesRevogadas: true };
  }

  await ativarContaFuncionario(alvo.sub_cognito);
  try {
    await comClienteBanco((cliente) => cliente.consultar({
      texto: "UPDATE public.usuarios SET ativo = true WHERE id = $1 AND perfil = 'vendedor'",
      parametros: [entrada.id],
    }));
  } catch (erro) {
    try { await bloquearContaFuncionario(alvo.sub_cognito); } catch { /* permanece sem vínculo local ativo */ }
    throw erro;
  }
  return { id: entrada.id, ativo: true };
}
