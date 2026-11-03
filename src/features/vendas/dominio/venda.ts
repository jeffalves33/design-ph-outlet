import type { ItemSacola } from "./sacola";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAVE = /^[A-Za-z0-9_-]{16,200}$/;

export const CHAVE_VENDA_PENDENTE = "prodexy.ph.venda-pendente.v1";

export class ErroVenda extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ErroVenda";
  }
}

export type ItemVendaEntrada = Readonly<{ categoriaId: string; quantidade: number }>;

export type VendaPendente = Readonly<{
  usuarioId: string;
  lojaId: string;
  vendedorUsuarioId: string;
  clienteId: string | null;
  itens: readonly ItemVendaEntrada[];
  itensExibicao: readonly ItemSacola[];
  chave: string;
}>;

function identificador(valor: unknown, mensagem: string) {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new ErroVenda(mensagem);
  return valor;
}

export function validarVenda(
  vendedorUsuarioId: unknown,
  itensInformados: unknown,
  chaveIdempotencia: unknown,
  clienteIdInformado: unknown = null,
) {
  const vendedor = identificador(vendedorUsuarioId, "Vendedor inválido.");
  const clienteId = clienteIdInformado === undefined || clienteIdInformado === null || clienteIdInformado === ""
    ? null : identificador(clienteIdInformado, "Cliente inválido.");
  if (typeof chaveIdempotencia !== "string" || !CHAVE.test(chaveIdempotencia)) {
    throw new ErroVenda("Chave da venda inválida.");
  }
  if (!Array.isArray(itensInformados) || itensInformados.length < 1 || itensInformados.length > 100) {
    throw new ErroVenda("A venda deve conter de 1 a 100 itens distintos.");
  }
  const quantidades = new Map<string, number>();
  for (const informado of itensInformados) {
    if (!informado || typeof informado !== "object" || Array.isArray(informado)) {
      throw new ErroVenda("Item da venda inválido.");
    }
    const dados = informado as Record<string, unknown>;
    const categoriaId = identificador(dados["categoriaId"], "Categoria inválida.");
    const quantidade = dados["quantidade"];
    if (typeof quantidade !== "number" || !Number.isSafeInteger(quantidade) ||
        quantidade < 1 || quantidade > 1_000_000_000) {
      throw new ErroVenda("A quantidade deve ser inteira e positiva.");
    }
    const somada = (quantidades.get(categoriaId) ?? 0) + quantidade;
    if (!Number.isSafeInteger(somada) || somada > 1_000_000_000) {
      throw new ErroVenda("Quantidade total inválida.");
    }
    quantidades.set(categoriaId, somada);
  }
  const itens = [...quantidades.entries()]
    .map(([categoriaId, quantidade]) => ({ categoriaId, quantidade }))
    .sort((a, b) => a.categoriaId.localeCompare(b.categoriaId));
  return { vendedorUsuarioId: vendedor, clienteId, itens, chaveIdempotencia };
}

export function itensDaSacola(itens: readonly ItemSacola[]): ItemVendaEntrada[] {
  return itens.map((item) => ({ categoriaId: item.id, quantidade: item.quantidade }));
}

export function lerVendaPendente(texto: string | null, usuarioId: string): VendaPendente | null {
  if (!texto || !UUID.test(usuarioId)) return null;
  try {
    const dados = JSON.parse(texto) as Record<string, unknown>;
    if (dados["usuarioId"] !== usuarioId || !UUID.test(String(dados["lojaId"] ?? ""))) return null;
    const validada = validarVenda(dados["vendedorUsuarioId"], dados["itens"], dados["chave"], dados["clienteId"]);
    if (!Array.isArray(dados["itensExibicao"]) || dados["itensExibicao"].length !== validada.itens.length) return null;
    const exibicao = dados["itensExibicao"] as ItemSacola[];
    if (exibicao.some((item) => !item || item.lojaId !== dados["lojaId"] ||
        !validada.itens.some((entrada) => entrada.categoriaId === item.id && entrada.quantidade === item.quantidade))) {
      return null;
    }
    return {
      usuarioId,
      lojaId: String(dados["lojaId"]),
      vendedorUsuarioId: validada.vendedorUsuarioId,
      clienteId: validada.clienteId,
      itens: validada.itens,
      itensExibicao: exibicao,
      chave: validada.chaveIdempotencia,
    };
  } catch {
    return null;
  }
}
