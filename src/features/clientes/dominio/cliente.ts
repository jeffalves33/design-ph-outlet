const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export class ErroCliente extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ErroCliente";
  }
}

function textoObrigatorio(valor: unknown, nome: string, limite: number) {
  const texto = typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
  if (!texto || texto.length > limite) throw new ErroCliente(`${nome} deve ter até ${limite} caracteres.`);
  return texto;
}

function textoOpcional(valor: unknown, nome: string, limite: number) {
  if (valor === undefined || valor === null || valor === "") return null;
  return textoObrigatorio(valor, nome, limite);
}

function dataOpcional(valor: unknown) {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !DATA.test(valor)) throw new ErroCliente("Data de nascimento inválida.");
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor)
    throw new ErroCliente("Data de nascimento inválida.");
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (valor > hoje) throw new ErroCliente("Data de nascimento não pode estar no futuro.");
  return valor;
}

export function normalizarWhatsapp(valor: unknown) {
  if (typeof valor !== "string") throw new ErroCliente("Informe o WhatsApp.");
  const digitos = valor.replace(/\D/g, "");
  if (!/^[0-9]{10,15}$/.test(digitos)) throw new ErroCliente("Informe um WhatsApp com 10 a 15 dígitos.");
  return digitos;
}

export function validarNovoCliente(entrada: Record<string, unknown>) {
  if (typeof entrada["id"] !== "string" || !UUID.test(entrada["id"]))
    throw new ErroCliente("Identificador do cliente inválido.");
  const lojaPreferidaId = entrada["lojaPreferidaId"];
  if (lojaPreferidaId !== undefined && lojaPreferidaId !== null && lojaPreferidaId !== "" &&
      (typeof lojaPreferidaId !== "string" || !UUID.test(lojaPreferidaId)))
    throw new ErroCliente("Loja preferida inválida.");
  return {
    id: entrada["id"],
    nome: textoObrigatorio(entrada["nome"], "Nome", 160),
    whatsappDigitos: normalizarWhatsapp(entrada["whatsapp"]),
    dataNascimento: dataOpcional(entrada["dataNascimento"]),
    cidade: textoOpcional(entrada["cidade"], "Cidade", 120),
    lojaPreferidaId: typeof lojaPreferidaId === "string" && lojaPreferidaId ? lojaPreferidaId : null,
    observacao: textoOpcional(entrada["observacao"], "Observação", 1000),
  };
}
