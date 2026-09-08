import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Percent, Plus, Wallet } from "lucide-react";
import { useState } from "react";
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
import {
  HOJE,
  LOJAS,
  brl,
  dataCurta,
  mesRotulo,
  nomeLoja,
  type Despesa,
  type Loja,
} from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

const categoriasDespesa: Despesa["categoria"][] = [
  "Fornecedores",
  "Aluguel",
  "Folha",
  "Marketing",
  "Operacional",
];

export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Relatório financeiro · PH Outlet" },
      {
        name: "description",
        content:
          "Relatório financeiro completo das lojas PH Outlet e PH Outlet Kids: receitas, despesas, margem, formas de pagamento e comparativo por loja.",
      },
      { property: "og:title", content: "Relatório financeiro · PH Outlet" },
      {
        property: "og:description",
        content:
          "Receitas, despesas, lucro e margem por período e por loja, com lançamento de despesas.",
      },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const { vendas, despesas, escopo, addDespesa, nomeCliente } = useStore();
  const [mes, setMes] = useState("2026-09");

  const v = porEscopo(vendas, escopo);
  const d = porEscopo(despesas, escopo);

  const meses = Array.from(
    new Set([...v.map((x) => x.data.slice(0, 7)), ...d.map((x) => x.data.slice(0, 7))]),
  ).sort((a, b) => b.localeCompare(a));

  const vendasMes = v.filter((x) => x.data.startsWith(mes));
  const despesasMes = d.filter((x) => x.data.startsWith(mes));
  const receita = vendasMes.reduce((s, x) => s + x.total, 0);
  const custo = despesasMes.reduce((s, x) => s + x.valor, 0);
  const lucro = receita - custo;
  const margem = receita ? (lucro / receita) * 100 : 0;

  const porPagamento = ["Pix", "Débito", "Crédito", "Dinheiro"].map((p) => ({
    forma: p,
    valor: vendasMes.filter((x) => x.pagamento === p).reduce((s, x) => s + x.total, 0),
  }));
  const maxPag = Math.max(1, ...porPagamento.map((x) => x.valor));

  const porCategoria = categoriasDespesa
    .map((c) => ({
      categoria: c,
      valor: despesasMes.filter((x) => x.categoria === c).reduce((s, x) => s + x.valor, 0),
    }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const maxCat = Math.max(1, ...porCategoria.map((x) => x.valor));

  const comparativo = LOJAS.map((l) => {
    const rec = vendas
      .filter((x) => x.loja === l.id && x.data.startsWith(mes))
      .reduce((s, x) => s + x.total, 0);
    const des = despesas
      .filter((x) => x.loja === l.id && x.data.startsWith(mes))
      .reduce((s, x) => s + x.valor, 0);
    return { loja: l.id as Loja, nome: l.nome, receita: rec, despesa: des, lucro: rec - des };
  });

  return (
    <AppShell
      title="Relatório financeiro"
      subtitle={
        escopo === "todas"
          ? "Resultado consolidado das duas lojas"
          : `Resultado da loja ${nomeLoja(escopo)}`
      }
      actions={
        <>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={`${fieldCls} w-40`}
            aria-label="Selecionar mês"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesRotulo(m)}
              </option>
            ))}
          </select>
          <NovaDespesa onSalvar={addDespesa} />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Receita do período"
          value={brl(receita)}
          hint={`${vendasMes.length} vendas`}
          icon={ArrowUpRight}
          tone="success"
        />
        <StatCard
          label="Despesas do período"
          value={brl(custo)}
          hint={`${despesasMes.length} lançamentos`}
          icon={ArrowDownRight}
          tone="danger"
        />
        <StatCard
          label="Resultado"
          value={brl(lucro)}
          icon={Wallet}
          tone={lucro >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Margem"
          value={`${margem.toFixed(1)}%`}
          hint="Sobre a receita do período"
          icon={Percent}
          tone="brand"
        />
      </div>

      <SectionCard title="Comparativo por loja" description={`Período ${mesRotulo(mes)}`} padded={false}>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {comparativo.map((c) => (
            <div key={c.loja} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-sm font-semibold">{c.nome}</p>
                <Chip tone={c.lucro >= 0 ? "success" : "danger"}>
                  {c.lucro >= 0 ? "lucro" : "prejuízo"} {brl(Math.abs(c.lucro))}
                </Chip>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Receita</dt>
                  <dd className="font-medium tabular-nums">{brl(c.receita)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Despesas</dt>
                  <dd className="font-medium tabular-nums">{brl(c.despesa)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Margem</dt>
                  <dd className="font-medium tabular-nums">
                    {c.receita ? ((c.lucro / c.receita) * 100).toFixed(1) : "0.0"}%
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <SectionCard title="Recebimentos por forma de pagamento">
          <div className="space-y-3">
            {porPagamento.map((p) => (
              <div key={p.forma} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                <span className="text-xs text-muted-foreground">{p.forma}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(3, (p.valor / maxPag) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-xs font-medium tabular-nums">
                  {brl(p.valor)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Despesas por categoria">
          <div className="space-y-3">
            {porCategoria.map((c) => (
              <div key={c.categoria} className="grid grid-cols-[6rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                <span className="truncate text-xs text-muted-foreground">{c.categoria}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-destructive/70"
                    style={{ width: `${Math.max(3, (c.valor / maxCat) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-xs font-medium tabular-nums">
                  {brl(c.valor)}
                </span>
              </div>
            ))}
            {porCategoria.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem despesas neste período.</p>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
        <SectionCard title="Entradas" description="Vendas do período" padded={false}>
          <ul className="divide-y divide-border">
            {vendasMes.map((venda) => (
              <li key={venda.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {nomeCliente(venda.clienteId, venda.clienteAvulso)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataCurta(venda.data)} · {nomeLoja(venda.loja)} · {venda.pagamento}
                  </p>
                </div>
                <p className="text-sm font-semibold text-success tabular-nums">
                  +{brl(venda.total)}
                </p>
              </li>
            ))}
            {vendasMes.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma venda neste período.
              </li>
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Saídas" description="Despesas lançadas" padded={false}>
          <ul className="divide-y divide-border">
            {despesasMes.map((x) => (
              <li key={x.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{x.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataCurta(x.data)} · {nomeLoja(x.loja)} · {x.categoria}
                  </p>
                </div>
                <p className="text-sm font-semibold text-destructive tabular-nums">
                  −{brl(x.valor)}
                </p>
              </li>
            ))}
            {despesasMes.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma despesa neste período.
              </li>
            )}
          </ul>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function NovaDespesa({ onSalvar }: { onSalvar: (d: Omit<Despesa, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    descricao: "",
    valor: "",
    data: HOJE,
    categoria: "Fornecedores" as Despesa["categoria"],
    loja: "outlet" as Loja,
  });

  const salvar = () => {
    if (!f.descricao.trim() || !Number(f.valor)) {
      toast.error("Descreva a despesa e informe o valor.");
      return;
    }
    onSalvar({
      descricao: f.descricao.trim(),
      valor: Number(f.valor),
      data: f.data,
      categoria: f.categoria,
      loja: f.loja,
    });
    toast.success("Despesa lançada no caixa.");
    setOpen(false);
    setF({ ...f, descricao: "", valor: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        <Plus className="size-4" /> Nova despesa
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar despesa</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Descrição">
            <input
              className={fieldCls}
              value={f.descricao}
              onChange={(e) => setF({ ...f, descricao: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor (R$)">
              <input
                type="number"
                className={fieldCls}
                value={f.valor}
                onChange={(e) => setF({ ...f, valor: e.target.value })}
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                className={fieldCls}
                value={f.data}
                onChange={(e) => setF({ ...f, data: e.target.value })}
              />
            </Field>
            <Field label="Categoria">
              <select
                className={fieldCls}
                value={f.categoria}
                onChange={(e) =>
                  setF({ ...f, categoria: e.target.value as Despesa["categoria"] })
                }
              >
                {categoriasDespesa.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Lançar despesa
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
