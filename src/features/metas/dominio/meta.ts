const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_BIGINT = 9_223_372_036_854_775_807n;

export class ErroMeta extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ErroMeta";
  }
}

function id(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new ErroMeta(`${campo} inválido.`);
  return valor;
}

function dataCivil(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !DATA.test(valor)) throw new ErroMeta(`${campo} inválida.`);
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor)
    throw new ErroMeta(`${campo} inválida.`);
  return valor;
}

function alvo(valor: unknown) {
  if (typeof valor !== "string" || !/^[1-9]\d{0,18}$/.test(valor))
    throw new ErroMeta("Informe um alvo positivo em centavos.");
  const inteiro = BigInt(valor);
  if (inteiro > LIMITE_BIGINT) throw new ErroMeta("Alvo acima do limite permitido.");
  return inteiro.toString();
}

export function validarNovaMeta(entrada: Record<string, unknown>) {
  const nome = typeof entrada["nome"] === "string"
    ? entrada["nome"].trim().replace(/\s+/g, " ") : "";
  if (!nome || nome.length > 120) throw new ErroMeta("Informe um nome de até 120 caracteres.");
  const inicioData = dataCivil(entrada["inicioData"], "Data inicial");
  const fimData = dataCivil(entrada["fimData"], "Data final");
  if (inicioData > fimData) throw new ErroMeta("A data final deve ser igual ou posterior à inicial.");
  return {
    id: id(entrada["id"], "Identificador da meta"),
    lojaId: id(entrada["lojaId"], "Loja"),
    vendedorUsuarioId: id(entrada["vendedorUsuarioId"], "Responsável"),
    nome, alvoCentavos: alvo(entrada["alvoCentavos"]), inicioData, fimData,
  };
}

export function validarEdicaoMeta(entrada: Record<string, unknown>) {
  const base = validarNovaMeta({ ...entrada, lojaId: entrada["lojaIdFixa"],
    vendedorUsuarioId: entrada["vendedorUsuarioIdFixo"] });
  const versaoEsperada = entrada["versaoEsperada"];
  if (!Number.isInteger(versaoEsperada) || Number(versaoEsperada) < 1)
    throw new ErroMeta("Versão da meta inválida.");
  return { id: base.id, nome: base.nome, alvoCentavos: base.alvoCentavos,
    inicioData: base.inicioData, fimData: base.fimData, versaoEsperada: Number(versaoEsperada) };
}
