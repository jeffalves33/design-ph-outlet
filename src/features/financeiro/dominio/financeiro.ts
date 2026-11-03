const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_BIGINT = 9_223_372_036_854_775_807n;
export const CATEGORIAS_DESPESA = ["fornecedores", "aluguel", "folha", "marketing", "operacional"] as const;

export class ErroFinanceiro extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ErroFinanceiro";
  }
}

function dataCivil(valor: unknown, nome: string) {
  if (typeof valor !== "string" || !DATA.test(valor)) throw new ErroFinanceiro(`${nome} inválida.`);
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor)
    throw new ErroFinanceiro(`${nome} inválida.`);
  return valor;
}

export function validarPeriodo(inicio: unknown, fim: unknown) {
  const inicioData = dataCivil(inicio, "Data inicial");
  const fimData = dataCivil(fim, "Data final");
  if (inicioData > fimData) throw new ErroFinanceiro("A data final deve ser igual ou posterior à inicial.");
  return { inicioData, fimData };
}

export function validarNovaDespesa(entrada: Record<string, unknown>) {
  if (typeof entrada["id"] !== "string" || !UUID.test(entrada["id"]))
    throw new ErroFinanceiro("Identificador da despesa inválido.");
  if (typeof entrada["lojaId"] !== "string" || !UUID.test(entrada["lojaId"]))
    throw new ErroFinanceiro("Loja inválida.");
  const descricao = typeof entrada["descricao"] === "string"
    ? entrada["descricao"].trim().replace(/\s+/g, " ") : "";
  if (!descricao || descricao.length > 200)
    throw new ErroFinanceiro("Descrição deve ter até 200 caracteres.");
  if (typeof entrada["categoria"] !== "string" ||
      !CATEGORIAS_DESPESA.includes(entrada["categoria"] as typeof CATEGORIAS_DESPESA[number]))
    throw new ErroFinanceiro("Categoria de despesa inválida.");
  if (typeof entrada["valorCentavos"] !== "string" || !/^[1-9]\d{0,18}$/.test(entrada["valorCentavos"]))
    throw new ErroFinanceiro("Informe um valor positivo em centavos.");
  const valor = BigInt(entrada["valorCentavos"]);
  if (valor > LIMITE_BIGINT) throw new ErroFinanceiro("Valor acima do limite permitido.");
  return {
    id: entrada["id"], lojaId: entrada["lojaId"], descricao,
    categoria: entrada["categoria"] as typeof CATEGORIAS_DESPESA[number],
    valorCentavos: valor.toString(), dataDespesa: dataCivil(entrada["dataDespesa"], "Data da despesa"),
  };
}
