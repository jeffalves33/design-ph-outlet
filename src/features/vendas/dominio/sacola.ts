export type ProdutoVenda = Readonly<{
  id: string;
  lojaId: string;
  lojaNome: string;
  codigo: string;
  nome: string;
  tamanho: string;
  precoCentavos: string;
  estoque: string;
}>;

export type ItemSacola = ProdutoVenda & Readonly<{ quantidade: number }>;

export class ErroSacola extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroSacola";
  }
}

export function normalizarCodigoVenda(valor: unknown) {
  if (typeof valor !== "string" || !/^[0-9]{5}$/.test(valor)) {
    throw new ErroSacola("Informe exatamente os cinco dígitos do código.");
  }
  return valor;
}

function inteiroNaoNegativo(valor: string, campo: string) {
  if (!/^[0-9]+$/.test(valor)) throw new ErroSacola(`${campo} inválido.`);
  return BigInt(valor);
}

export function adicionarNaSacola(
  itens: readonly ItemSacola[],
  produto: ProdutoVenda,
  quantidade = 1,
): ItemSacola[] {
  normalizarCodigoVenda(produto.codigo);
  if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
    throw new ErroSacola("A quantidade deve ser um número inteiro positivo.");
  }
  if (itens.some((item) => item.lojaId !== produto.lojaId)) {
    throw new ErroSacola("A sacola não pode misturar itens de lojas diferentes.");
  }
  const estoque = inteiroNaoNegativo(produto.estoque, "Estoque");
  const existente = itens.find((item) => item.id === produto.id);
  const proximaQuantidade = (existente?.quantidade ?? 0) + quantidade;
  if (BigInt(proximaQuantidade) > estoque) {
    throw new ErroSacola(`Estoque disponível: ${produto.estoque}.`);
  }
  if (existente) {
    return itens.map((item) =>
      item.id === produto.id ? { ...produto, quantidade: proximaQuantidade } : item,
    );
  }
  return [...itens, { ...produto, quantidade }];
}

export function definirQuantidade(
  itens: readonly ItemSacola[],
  produtoId: string,
  quantidade: number,
): ItemSacola[] {
  if (!Number.isSafeInteger(quantidade)) throw new ErroSacola("Quantidade inválida.");
  if (quantidade <= 0) return itens.filter((item) => item.id !== produtoId);
  const item = itens.find((atual) => atual.id === produtoId);
  if (!item) return [...itens];
  if (BigInt(quantidade) > inteiroNaoNegativo(item.estoque, "Estoque")) {
    throw new ErroSacola(`Estoque disponível: ${item.estoque}.`);
  }
  return itens.map((atual) =>
    atual.id === produtoId ? { ...atual, quantidade } : atual,
  );
}

export function totalSacolaCentavos(itens: readonly ItemSacola[]) {
  return itens.reduce(
    (total, item) => total + inteiroNaoNegativo(item.precoCentavos, "Preço") * BigInt(item.quantidade),
    0n,
  );
}

export function quantidadePecas(itens: readonly ItemSacola[]) {
  return itens.reduce((total, item) => total + item.quantidade, 0);
}
