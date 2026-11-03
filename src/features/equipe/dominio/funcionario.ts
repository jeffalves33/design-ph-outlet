const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ErroFuncionario extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ErroFuncionario";
  }
}

function texto(valor: unknown, campo: string, maximo: number) {
  if (typeof valor !== "string") throw new ErroFuncionario(`${campo} inválido.`);
  const normalizado = valor.trim().replace(/\s+/g, " ");
  if (normalizado.length < 2 || normalizado.length > maximo)
    throw new ErroFuncionario(`${campo} deve ter entre 2 e ${maximo} caracteres.`);
  return normalizado;
}

function email(valor: unknown) {
  const normalizado = texto(valor, "E-mail", 254).toLowerCase();
  if (!EMAIL.test(normalizado)) throw new ErroFuncionario("E-mail inválido.");
  return normalizado;
}

function lojas(valor: unknown) {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > 20 ||
      valor.some((item) => typeof item !== "string" || !UUID.test(item)))
    throw new ErroFuncionario("Selecione ao menos uma loja válida.");
  return [...new Set(valor as string[])];
}

export function validarNovoFuncionario(dados: Record<string, unknown>) {
  if (dados["perfil"] !== undefined && dados["perfil"] !== "vendedor")
    throw new ErroFuncionario("Novos funcionários devem usar o perfil vendedor.");
  return { nome: texto(dados["nome"], "Nome", 120), email: email(dados["email"]),
    lojas: lojas(dados["lojas"]) };
}

export function validarEdicaoFuncionario(dados: Record<string, unknown>) {
  if (typeof dados["id"] !== "string" || !UUID.test(dados["id"]))
    throw new ErroFuncionario("Funcionário inválido.");
  return { id: dados["id"], nome: texto(dados["nome"], "Nome", 120),
    email: email(dados["email"]), lojas: lojas(dados["lojas"]) };
}

export function validarAcaoFuncionario(dados: Record<string, unknown>) {
  if (typeof dados["id"] !== "string" || !UUID.test(dados["id"]))
    throw new ErroFuncionario("Funcionário inválido.");
  if (!["ativar", "bloquear", "reenviar_convite"].includes(String(dados["acao"])))
    throw new ErroFuncionario("Ação inválida.");
  return { id: dados["id"], acao: dados["acao"] as "ativar" | "bloquear" | "reenviar_convite" };
}
