export type Loja = "outlet" | "kids";

export const LOJAS: { id: Loja; nome: string; curto: string }[] = [
  { id: "outlet", nome: "PH Outlet", curto: "Outlet" },
  { id: "kids", nome: "PH Outlet Kids", curto: "Kids" },
];

export const nomeLoja = (id: Loja) => LOJAS.find((l) => l.id === id)?.nome ?? "—";

export type Categoria =
  | "Camisetas"
  | "Calças"
  | "Vestidos"
  | "Conjuntos"
  | "Bermudas"
  | "Jaquetas"
  | "Calçados"
  | "Acessórios";

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  categoria: Categoria;
  tamanho: string;
  cor: string;
  custo: number;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  loja: Loja;
};

export type Colaborador = {
  id: string;
  nome: string;
  login: string;
  senha: string;
  cargo: "Administrador" | "Gerente" | "Vendedor" | "Estoquista";
  lojas: Loja[];
  ativo: boolean;
  desde: string;
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  nascimento: string; // AAAA-MM-DD
  cidade: string;
  desde: string;
  lojaPreferida: Loja;
  observacao?: string | undefined;
};

export type ItemVenda = {
  produtoId: string;
  codigo: string;
  nome: string;
  qtd: number;
  precoUnit: number;
};

export type Venda = {
  id: string;
  data: string;
  loja: Loja;
  clienteId: string | null;
  clienteAvulso?: string | undefined;
  vendedorId: string;
  itens: ItemVenda[];
  desconto: number;
  total: number;
  pagamento: "Pix" | "Débito" | "Crédito" | "Dinheiro";
};

export type Despesa = {
  id: string;
  data: string;
  loja: Loja;
  descricao: string;
  categoria: "Fornecedores" | "Aluguel" | "Folha" | "Marketing" | "Operacional";
  valor: number;
};

export const produtos: Produto[] = [
  { id: "p1", codigo: "OUT-1001", nome: "Camiseta oversized preta", categoria: "Camisetas", tamanho: "M", cor: "Preto", custo: 28, preco: 79.9, estoque: 34, estoqueMinimo: 10, loja: "outlet" },
  { id: "p2", codigo: "OUT-1002", nome: "Calça jeans slim escura", categoria: "Calças", tamanho: "42", cor: "Azul escuro", custo: 74, preco: 189.9, estoque: 6, estoqueMinimo: 8, loja: "outlet" },
  { id: "p3", codigo: "OUT-1003", nome: "Jaqueta corta-vento", categoria: "Jaquetas", tamanho: "G", cor: "Grafite", custo: 96, preco: 249.9, estoque: 11, estoqueMinimo: 5, loja: "outlet" },
  { id: "p4", codigo: "OUT-1004", nome: "Bermuda sarja bege", categoria: "Bermudas", tamanho: "40", cor: "Bege", custo: 42, preco: 109.9, estoque: 22, estoqueMinimo: 8, loja: "outlet" },
  { id: "p5", codigo: "OUT-1005", nome: "Tênis casual branco", categoria: "Calçados", tamanho: "41", cor: "Branco", custo: 118, preco: 289.9, estoque: 4, estoqueMinimo: 6, loja: "outlet" },
  { id: "p6", codigo: "OUT-1006", nome: "Boné aba curva", categoria: "Acessórios", tamanho: "Único", cor: "Preto", custo: 19, preco: 59.9, estoque: 40, estoqueMinimo: 12, loja: "outlet" },
  { id: "p7", codigo: "KID-2001", nome: "Conjunto infantil moletom", categoria: "Conjuntos", tamanho: "6 anos", cor: "Azul claro", custo: 46, preco: 129.9, estoque: 18, estoqueMinimo: 8, loja: "kids" },
  { id: "p8", codigo: "KID-2002", nome: "Vestido infantil floral", categoria: "Vestidos", tamanho: "4 anos", cor: "Rosa", custo: 38, preco: 99.9, estoque: 3, estoqueMinimo: 6, loja: "kids" },
  { id: "p9", codigo: "KID-2003", nome: "Camiseta infantil estampada", categoria: "Camisetas", tamanho: "8 anos", cor: "Branco", custo: 18, preco: 49.9, estoque: 45, estoqueMinimo: 15, loja: "kids" },
  { id: "p10", codigo: "KID-2004", nome: "Calça jeans infantil", categoria: "Calças", tamanho: "10 anos", cor: "Azul", custo: 44, preco: 119.9, estoque: 9, estoqueMinimo: 10, loja: "kids" },
  { id: "p11", codigo: "KID-2005", nome: "Tênis infantil velcro", categoria: "Calçados", tamanho: "28", cor: "Azul/branco", custo: 62, preco: 159.9, estoque: 14, estoqueMinimo: 6, loja: "kids" },
  { id: "p12", codigo: "KID-2006", nome: "Jaqueta jeans infantil", categoria: "Jaquetas", tamanho: "6 anos", cor: "Jeans claro", custo: 58, preco: 149.9, estoque: 7, estoqueMinimo: 5, loja: "kids" },
];

export const colaboradores: Colaborador[] = [
  { id: "u1", nome: "Paulo Henrique", login: "paulo@phoutlet.com", senha: "ph-admin-2026", cargo: "Administrador", lojas: ["outlet", "kids"], ativo: true, desde: "2022-03-01" },
  { id: "u2", nome: "Camila Duarte", login: "camila@phoutlet.com", senha: "camila2026", cargo: "Gerente", lojas: ["outlet"], ativo: true, desde: "2023-07-14" },
  { id: "u3", nome: "Rafael Lima", login: "rafael@phoutlet.com", senha: "rafael2026", cargo: "Vendedor", lojas: ["outlet"], ativo: true, desde: "2024-02-05" },
  { id: "u4", nome: "Beatriz Souza", login: "beatriz@phkids.com", senha: "bia2026", cargo: "Vendedor", lojas: ["kids"], ativo: true, desde: "2024-09-19" },
  { id: "u5", nome: "Tiago Moraes", login: "tiago@phoutlet.com", senha: "tiago2026", cargo: "Estoquista", lojas: ["outlet", "kids"], ativo: false, desde: "2023-01-23" },
];

export const clientes: Cliente[] = [
  { id: "c1", nome: "Fernanda Ribeiro", telefone: "(27) 99743-6355", nascimento: "1991-09-12", cidade: "Vila Velha - ES", desde: "2024-04-12", lojaPreferida: "kids", observacao: "Compra para os dois filhos." },
  { id: "c2", nome: "Marcos Antônio Silva", telefone: "(27) 99970-0691", nascimento: "1985-09-24", cidade: "Vitória - ES", desde: "2023-11-02", lojaPreferida: "outlet" },
  { id: "c3", nome: "Juliana Prado", telefone: "(27) 99812-4410", nascimento: "1996-10-03", cidade: "Serra - ES", desde: "2025-01-22", lojaPreferida: "kids" },
  { id: "c4", nome: "Diego Nogueira", telefone: "(27) 99604-7788", nascimento: "1990-03-18", cidade: "Cariacica - ES", desde: "2022-06-15", lojaPreferida: "outlet", observacao: "Prefere tamanho G." },
  { id: "c5", nome: "Patrícia Gomes", telefone: "(27) 99155-3021", nascimento: "1988-12-01", cidade: "Vila Velha - ES", desde: "2024-08-19", lojaPreferida: "outlet" },
  { id: "c6", nome: "Luana Martins", telefone: "(27) 99333-1180", nascimento: "1993-09-08", cidade: "Guarapari - ES", desde: "2025-06-30", lojaPreferida: "kids" },
];

const item = (p: Produto, qtd: number): ItemVenda => ({
  produtoId: p.id,
  codigo: p.codigo,
  nome: p.nome,
  qtd,
  precoUnit: p.preco,
});

const P = (id: string) => produtos.find((p) => p.id === id)!;

const mk = (
  id: string,
  data: string,
  loja: Loja,
  clienteId: string | null,
  vendedorId: string,
  itens: ItemVenda[],
  desconto: number,
  pagamento: Venda["pagamento"],
  clienteAvulso?: string,
): Venda => ({
  id,
  data,
  loja,
  clienteId,
  clienteAvulso,
  vendedorId,
  itens,
  desconto,
  pagamento,
  total: itens.reduce((s, i) => s + i.qtd * i.precoUnit, 0) - desconto,
});

export const vendas: Venda[] = [
  mk("v1", "2026-09-05", "outlet", "c2", "u3", [item(P("p1"), 2), item(P("p6"), 1)], 10, "Pix"),
  mk("v2", "2026-09-04", "kids", "c1", "u4", [item(P("p7"), 1), item(P("p9"), 3)], 0, "Crédito"),
  mk("v3", "2026-09-03", "outlet", null, "u3", [item(P("p4"), 1)], 0, "Débito", "Cliente balcão"),
  mk("v4", "2026-09-02", "outlet", "c4", "u2", [item(P("p5"), 1), item(P("p2"), 1)], 30, "Crédito"),
  mk("v5", "2026-08-30", "kids", "c3", "u4", [item(P("p8"), 2), item(P("p11"), 1)], 15, "Pix"),
  mk("v6", "2026-08-28", "outlet", "c5", "u3", [item(P("p3"), 1)], 0, "Pix"),
  mk("v7", "2026-08-24", "kids", "c1", "u4", [item(P("p12"), 1), item(P("p10"), 1)], 0, "Débito"),
  mk("v8", "2026-08-18", "outlet", "c2", "u2", [item(P("p1"), 1), item(P("p4"), 2)], 20, "Dinheiro"),
  mk("v9", "2026-08-11", "kids", "c6", "u4", [item(P("p9"), 2)], 0, "Pix"),
  mk("v10", "2026-07-29", "outlet", "c4", "u3", [item(P("p6"), 2), item(P("p1"), 1)], 0, "Crédito"),
  mk("v11", "2026-07-21", "kids", "c3", "u4", [item(P("p7"), 2)], 10, "Pix"),
  mk("v12", "2026-07-08", "outlet", null, "u3", [item(P("p2"), 1)], 0, "Dinheiro", "Cliente balcão"),
  mk("v13", "2026-09-05", "kids", "c6", "u4", [item(P("p11"), 6), item(P("p9"), 12)], 20, "Crédito"),
  mk("v14", "2026-09-05", "outlet", null, "u3", [item(P("p3"), 6), item(P("p6"), 9)], 0, "Pix", "Cliente balcão"),
  mk("v15", "2026-09-04", "outlet", "c5", "u2", [item(P("p5"), 6), item(P("p1"), 9)], 50, "Crédito"),
  mk("v16", "2026-09-04", "kids", "c3", "u4", [item(P("p7"), 9), item(P("p12"), 6)], 0, "Débito"),
  mk("v17", "2026-09-03", "kids", null, "u4", [item(P("p9"), 18)], 0, "Dinheiro", "Cliente balcão"),
  mk("v18", "2026-09-03", "outlet", "c2", "u3", [item(P("p2"), 9), item(P("p4"), 6)], 40, "Pix"),
  mk("v19", "2026-09-02", "outlet", "c4", "u3", [item(P("p1"), 12), item(P("p6"), 6)], 0, "Débito"),
  mk("v20", "2026-09-02", "kids", "c1", "u4", [item(P("p8"), 9), item(P("p10"), 6)], 25, "Pix"),
  mk("v21", "2026-09-01", "outlet", null, "u2", [item(P("p3"), 9), item(P("p5"), 3)], 0, "Crédito", "Cliente balcão"),
  mk("v22", "2026-09-01", "kids", "c6", "u4", [item(P("p11"), 9), item(P("p7"), 6)], 30, "Débito"),
];

export const despesas: Despesa[] = [
  { id: "d1", data: "2026-09-05", loja: "outlet", descricao: "Fornecedor Bras - lote camisetas", categoria: "Fornecedores", valor: 3200 },
  { id: "d2", data: "2026-09-03", loja: "kids", descricao: "Fornecedor infantil - conjuntos", categoria: "Fornecedores", valor: 2450 },
  { id: "d3", data: "2026-09-01", loja: "outlet", descricao: "Aluguel loja centro", categoria: "Aluguel", valor: 4200 },
  { id: "d4", data: "2026-09-01", loja: "kids", descricao: "Aluguel quiosque shopping", categoria: "Aluguel", valor: 3100 },
  { id: "d5", data: "2026-08-30", loja: "outlet", descricao: "Folha de pagamento equipe", categoria: "Folha", valor: 7800 },
  { id: "d6", data: "2026-08-27", loja: "kids", descricao: "Tráfego pago Instagram", categoria: "Marketing", valor: 640 },
  { id: "d7", data: "2026-08-20", loja: "outlet", descricao: "Sacolas e etiquetas", categoria: "Operacional", valor: 380 },
  { id: "d8", data: "2026-07-28", loja: "kids", descricao: "Folha de pagamento equipe", categoria: "Folha", valor: 4200 },
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataCurta = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const HOJE = "2026-09-06";

export const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

/** Dias até o próximo aniversário, considerando HOJE como referência. */
export const diasParaAniversario = (nascimento: string, hoje = HOJE) => {
  const parts = nascimento.split("-").map(Number);
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const ref = new Date(`${hoje}T00:00:00`);
  let prox = new Date(ref.getFullYear(), m - 1, d);
  if (prox < ref) prox = new Date(ref.getFullYear() + 1, m - 1, d);
  return Math.round((prox.getTime() - ref.getTime()) / 86400000);
};

export const idade = (nascimento: string, hoje = HOJE) => {
  const n = new Date(`${nascimento}T00:00:00`);
  const h = new Date(`${hoje}T00:00:00`);
  let a = h.getFullYear() - n.getFullYear();
  const antes =
    h.getMonth() < n.getMonth() ||
    (h.getMonth() === n.getMonth() && h.getDate() < n.getDate());
  if (antes) a -= 1;
  return a;
};

export const mesRotulo = (iso: string) => {
  const y = iso.slice(0, 4);
  const m = iso.slice(5, 7);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${y.slice(2)}`;
};
