export type TipoMovimentacao = "entrada" | "ajuste";

export class ErroMovimentacao extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ErroMovimentacao";
  }
}

export function validarMovimentacao(
  tipo: unknown, variacao: unknown, motivo: unknown, chaveIdempotencia: unknown,
) {
  if (tipo !== "entrada" && tipo !== "ajuste")
    throw new ErroMovimentacao("Tipo de movimentação inválido.");
  if (typeof variacao !== "number" || !Number.isSafeInteger(variacao) ||
      variacao === 0 || Math.abs(variacao) > 1_000_000_000 ||
      (tipo === "entrada" && variacao < 0))
    throw new ErroMovimentacao("Informe uma quantidade inteira válida; entrada deve ser positiva.");
  if (typeof motivo !== "string" || !motivo.trim() || motivo.trim().length > 500)
    throw new ErroMovimentacao("Informe um motivo de até 500 caracteres.");
  if (typeof chaveIdempotencia !== "string" ||
      !/^[A-Za-z0-9_-]{16,200}$/.test(chaveIdempotencia))
    throw new ErroMovimentacao("Chave da operação inválida.");
  return { tipo: tipo as TipoMovimentacao, variacao, motivo: motivo.trim(), chaveIdempotencia };
}

export function saldoAposMovimento(saldoAtual: string, variacao: number) {
  if (!/^(0|[1-9][0-9]*)$/.test(saldoAtual)) throw new ErroMovimentacao("Saldo indisponível.", 503);
  const saldoApos = BigInt(saldoAtual) + BigInt(variacao);
  if (saldoApos < 0n) throw new ErroMovimentacao("Estoque insuficiente para o ajuste.", 409);
  if (saldoApos > 9223372036854775807n) throw new ErroMovimentacao("Limite de estoque excedido.", 409);
  return saldoApos.toString();
}
