export type OperacaoPendente = {
  usuarioId: string;
  lojaId: string;
  categoriaId: string;
  tipo: "entrada" | "ajuste";
  variacao: number;
  motivo: string;
  chave: string;
};

export const CHAVE_OPERACAO_PENDENTE = "ph-estoque-operacao-pendente-v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function lerOperacaoPendente(valor: string | null, usuarioId: string): OperacaoPendente | null {
  if (!valor || valor.length > 2048) return null;
  try {
    const dados: unknown = JSON.parse(valor);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
    const item = dados as OperacaoPendente;
    if (item.usuarioId !== usuarioId || !UUID.test(item.usuarioId) ||
      typeof item.lojaId !== "string" || !UUID.test(item.lojaId) ||
      typeof item.categoriaId !== "string" || !UUID.test(item.categoriaId) ||
      typeof item.chave !== "string" || !UUID.test(item.chave) ||
      (item.tipo !== "entrada" && item.tipo !== "ajuste") ||
      typeof item.variacao !== "number" || !Number.isSafeInteger(item.variacao) ||
      item.variacao === 0 || Math.abs(item.variacao) > 1_000_000_000 ||
      (item.tipo === "entrada" && item.variacao < 0) ||
      typeof item.motivo !== "string" || !item.motivo.trim() || item.motivo.length > 500)
      return null;
    return item;
  } catch { return null; }
}
