import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes, Minus, Plus, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LOJAS, brl, nomeLoja, type Categoria, type Loja } from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

const categorias: Categoria[] = [
  "Camisetas",
  "Calças",
  "Vestidos",
  "Conjuntos",
  "Bermudas",
  "Jaquetas",
  "Calçados",
  "Acessórios",
];

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque por código · PH Outlet" },
      {
        name: "description",
        content:
          "Controle de estoque das lojas PH Outlet e PH Outlet Kids por código de produto, com alertas de reposição e valor imobilizado.",
      },
      { property: "og:title", content: "Estoque por código · PH Outlet" },
      {
        property: "og:description",
        content:
          "Cadastre e acompanhe peças por código, tamanho e cor, com filtro por loja e alertas de estoque mínimo.",
      },
    ],
  }),
  component: Estoque,
});

function Estoque() {
  const { produtos, escopo, ajustarEstoque, addProduto } = useStore();
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<"todas" | Categoria>("todas");
  const [somenteAlerta, setSomenteAlerta] = useState(false);

  const base = porEscopo(produtos, escopo);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return base.filter(
      (p) =>
        (cat === "todas" || p.categoria === cat) &&
        (!somenteAlerta || p.estoque <= p.estoqueMinimo) &&
        (t === "" ||
          p.codigo.toLowerCase().includes(t) ||
          p.nome.toLowerCase().includes(t)),
    );
  }, [base, busca, cat, somenteAlerta]);

  const pecas = base.reduce((s, p) => s + p.estoque, 0);
  const imobilizado = base.reduce((s, p) => s + p.estoque * p.custo, 0);
  const potencial = base.reduce((s, p) => s + p.estoque * p.preco, 0);
  const alertas = base.filter((p) => p.estoque <= p.estoqueMinimo);

  return (
    <AppShell
      title="Estoque"
      subtitle={
        escopo === "todas"
          ? "Cadastro por código — visão das duas lojas"
          : `Cadastro por código — ${nomeLoja(escopo)}`
      }
      actions={<NovoProduto onSalvar={addProduto} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Peças em estoque" value={String(pecas)} icon={Boxes} tone="brand" />
        <StatCard label="Custo imobilizado" value={brl(imobilizado)} icon={Tag} />
        <StatCard
          label="Venda potencial"
          value={brl(potencial)}
          hint={`Margem estimada ${brl(potencial - imobilizado)}`}
          icon={Tag}
          tone="success"
        />
        <StatCard
          label="Repor com urgência"
          value={String(alertas.length)}
          icon={AlertTriangle}
          tone={alertas.length ? "warning" : "success"}
        />
      </div>

      <SectionCard
        title="Produtos cadastrados"
        description={`${lista.length} itens listados`}
        padded={false}
      >
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome"
              className={`${fieldCls} pl-9`}
            />
          </div>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value as "todas" | Categoria)}
            className={`${fieldCls} sm:w-44`}
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSomenteAlerta((s) => !s)}
            className={`h-10 rounded-xl border px-4 text-sm font-medium transition-colors ${
              somenteAlerta
                ? "border-warning bg-warning/15 text-warning-foreground"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            Só alertas
          </button>
        </div>

        {/* Mobile: cartões */}
        <ul className="divide-y divide-border lg:hidden">
          {lista.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.codigo} · {p.tamanho} · {p.cor}
                  </p>
                </div>
                <Chip tone={p.loja === "kids" ? "brand" : "muted"}>
                  {p.loja === "kids" ? "Kids" : "Outlet"}
                </Chip>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold tabular-nums">{brl(p.preco)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    custo {brl(p.custo)}
                  </span>
                </div>
                <ControleEstoque produto={p} onAjustar={ajustarEstoque} />
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: tabela */}
        <div className="hidden lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {["Código", "Produto", "Loja", "Tam./Cor", "Custo", "Preço", "Estoque"].map(
                  (h) => (
                    <th key={h} className="eyebrow px-5 py-3 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-mono text-xs">{p.codigo}</td>
                  <td className="px-5 py-3">
                    <span className="block font-medium">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{p.categoria}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Chip tone={p.loja === "kids" ? "brand" : "muted"}>
                      {p.loja === "kids" ? "Kids" : "Outlet"}
                    </Chip>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {p.tamanho} · {p.cor}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{brl(p.custo)}</td>
                  <td className="px-5 py-3 font-medium tabular-nums">{brl(p.preco)}</td>
                  <td className="px-5 py-3">
                    <ControleEstoque produto={p} onAjustar={ajustarEstoque} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lista.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado com esses filtros.
          </p>
        )}
      </SectionCard>
    </AppShell>
  );
}

function ControleEstoque({
  produto,
  onAjustar,
}: {
  produto: { id: string; estoque: number; estoqueMinimo: number };
  onAjustar: (id: string, delta: number) => void;
}) {
  const baixo = produto.estoque <= produto.estoqueMinimo;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Baixar uma unidade"
        onClick={() => onAjustar(produto.id, -1)}
        className="grid size-8 place-items-center rounded-lg border border-border bg-card transition-colors hover:bg-secondary"
      >
        <Minus className="size-3.5" />
      </button>
      <span
        className={`min-w-10 rounded-lg px-2 py-1 text-center text-sm font-semibold tabular-nums ${
          baixo ? "bg-warning/20 text-warning-foreground" : "bg-secondary"
        }`}
      >
        {produto.estoque}
      </span>
      <button
        type="button"
        aria-label="Adicionar uma unidade"
        onClick={() => onAjustar(produto.id, 1)}
        className="grid size-8 place-items-center rounded-lg border border-border bg-card transition-colors hover:bg-secondary"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function NovoProduto({
  onSalvar,
}: {
  onSalvar: (p: {
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
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    codigo: "",
    nome: "",
    categoria: "Camisetas" as Categoria,
    tamanho: "",
    cor: "",
    custo: "",
    preco: "",
    estoque: "",
    estoqueMinimo: "",
    loja: "outlet" as Loja,
  });

  const salvar = () => {
    if (!f.codigo.trim() || !f.nome.trim()) {
      toast.error("Informe o código e o nome do produto.");
      return;
    }
    onSalvar({
      codigo: f.codigo.trim().toUpperCase(),
      nome: f.nome.trim(),
      categoria: f.categoria,
      tamanho: f.tamanho.trim() || "Único",
      cor: f.cor.trim() || "—",
      custo: Number(f.custo) || 0,
      preco: Number(f.preco) || 0,
      estoque: Number(f.estoque) || 0,
      estoqueMinimo: Number(f.estoqueMinimo) || 0,
      loja: f.loja,
    });
    toast.success("Produto cadastrado no estoque.");
    setOpen(false);
    setF({ ...f, codigo: "", nome: "", tamanho: "", cor: "", custo: "", preco: "", estoque: "", estoqueMinimo: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        <Plus className="size-4" /> Novo produto
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar produto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código">
            <input
              className={fieldCls}
              value={f.codigo}
              onChange={(e) => setF({ ...f, codigo: e.target.value })}
              placeholder="OUT-1010"
            />
          </Field>
          <Field label="Loja">
            <select
              className={fieldCls}
              value={f.loja}
              onChange={(e) => setF({ ...f, loja: e.target.value as Loja })}
            >
              {LOJAS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome" className="sm:col-span-2">
            <input
              className={fieldCls}
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              placeholder="Camiseta básica algodão"
            />
          </Field>
          <Field label="Categoria">
            <select
              className={fieldCls}
              value={f.categoria}
              onChange={(e) => setF({ ...f, categoria: e.target.value as Categoria })}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tamanho">
            <input
              className={fieldCls}
              value={f.tamanho}
              onChange={(e) => setF({ ...f, tamanho: e.target.value })}
              placeholder="M / 42 / 6 anos"
            />
          </Field>
          <Field label="Cor">
            <input
              className={fieldCls}
              value={f.cor}
              onChange={(e) => setF({ ...f, cor: e.target.value })}
            />
          </Field>
          <Field label="Custo (R$)">
            <input
              type="number"
              className={fieldCls}
              value={f.custo}
              onChange={(e) => setF({ ...f, custo: e.target.value })}
            />
          </Field>
          <Field label="Preço de venda (R$)">
            <input
              type="number"
              className={fieldCls}
              value={f.preco}
              onChange={(e) => setF({ ...f, preco: e.target.value })}
            />
          </Field>
          <Field label="Quantidade">
            <input
              type="number"
              className={fieldCls}
              value={f.estoque}
              onChange={(e) => setF({ ...f, estoque: e.target.value })}
            />
          </Field>
          <Field label="Estoque mínimo">
            <input
              type="number"
              className={fieldCls}
              value={f.estoqueMinimo}
              onChange={(e) => setF({ ...f, estoqueMinimo: e.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Salvar produto
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
