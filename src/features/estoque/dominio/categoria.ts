export class ErroCategoria extends Error {
  constructor(message: string) { super(message); this.name = "ErroCategoria"; }
}

export function codigoExibido(codigo: number) {
  if (!Number.isInteger(codigo) || codigo < 1 || codigo > 99999) throw new ErroCategoria("Código inválido.");
  return String(codigo).padStart(5, "0");
}

export function validarCategoria(nome: unknown, tamanho: unknown, precoCentavos: unknown) {
  if (typeof nome !== "string" || !nome.trim() || nome.trim().length > 120)
    throw new ErroCategoria("Informe um nome de até 120 caracteres.");
  if (typeof tamanho !== "string" || !tamanho.trim() || tamanho.trim().length > 40)
    throw new ErroCategoria("Informe um tamanho de até 40 caracteres.");
  if (typeof precoCentavos !== "number" || !Number.isSafeInteger(precoCentavos) ||
      precoCentavos < 0 || precoCentavos > 999999999999)
    throw new ErroCategoria("Informe um preço válido em centavos.");
  return { nome: nome.trim(), tamanho: tamanho.trim(), precoCentavos };
}

export function centavosDoTexto(valor: string) {
  const limpo = valor.trim().replace(",", ".");
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(limpo)) throw new ErroCategoria("Preço inválido.");
  const [inteiro, fracao = ""] = limpo.split(".");
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
}
