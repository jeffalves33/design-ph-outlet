import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Cake,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip, SectionCard } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import {
  brl,
  dataCurta,
  diasParaAniversario,
  LOJAS,
  mesRotulo,
  nomeLoja,
  type Loja,
} from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PH Outlet" },
      {
        name: "description",
        content:
          "Painel de gestão PH Outlet e PH Outlet Kids: vendas do mês, resultado financeiro, alertas de estoque e oportunidades de relacionamento.",
      },
      { property: "og:title", content: "PH Outlet — gestão das duas lojas" },
      {
        property: "og:description",
        content:
          "Acompanhe vendas, caixa, estoque e clientes das lojas PH Outlet e PH Outlet Kids em um só lugar.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { vendas, despesas, produtos, clientes, escopo, nomeCliente } = useStore();

  const v = porEscopo(vendas, escopo);
  const d = porEscopo(despesas, escopo);
  const p = porEscopo(produtos, escopo);

  const mesAtual = "2026-09";
  const vendasMes = v.filter((x) => x.data.startsWith(mesAtual));
  const despesasMes = d.filter((x) => x.data.startsWith(mesAtual));

  const receita = vendasMes.reduce((s, x) => s + x.total, 0);
  const custos = despesasMes.reduce((s, x) => s + x.valor, 0);
  const pecas = vendasMes.reduce(
    (s, x) => s + x.itens.reduce((t, i) => t + i.qtd, 0),
    0,
  );
  const ticket = vendasMes.length ? receita / vendasMes.length : 0;
  const alertas = p.filter((x) => x.estoque <= x.estoqueMinimo);

  // Faturamento por mês (últimos meses presentes nos dados)
  const meses = Array.from(new Set(v.map((x) => x.data.slice(0, 7)))).sort();
  const porMes = meses.map((m) => ({
    mes: m,
    valor: v.filter((x) => x.data.startsWith(m)).reduce((s, x) => s + x.total, 0),
  }));
  const maxMes = Math.max(1, ...porMes.map((x) => x.valor));

  const porLoja = LOJAS.map((l) => ({
    loja: l.id as Loja,
    nome: l.nome,
    receita: vendas
      .filter((x) => x.loja === l.id && x.data.startsWith(mesAtual))
      .reduce((s, x) => s + x.total, 0),
  }));
  const maxLoja = Math.max(1, ...porLoja.map((x) => x.receita));

  const maisVendidos = Object.values(
    v
      .flatMap((x) => x.itens)
      .reduce<Record<string, { nome: string; codigo: string; qtd: number; valor: number }>>(
        (acc, i) => {
          const cur = acc[i.produtoId] ?? {
            nome: i.nome,
            codigo: i.codigo,
            qtd: 0,
            valor: 0,
          };
          cur.qtd += i.qtd;
          cur.valor += i.qtd * i.precoUnit;
          acc[i.produtoId] = cur;
          return acc;
        },
        {},
      ),
  )
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 5);

  const aniversariantes = clientes
    .map((c) => ({ c, dias: diasParaAniversario(c.nascimento) }))
    .filter((x) => x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 4);

  return (
    <AppShell
      title="Painel de gestão"
      subtitle={
        escopo === "todas"
          ? "Visão consolidada da PH Outlet e da PH Outlet Kids"
          : `Visão da loja ${nomeLoja(escopo)}`
      }
      actions={
        <>
          <Link
            to="/vendas"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ShoppingBag className="size-4" /> Nova venda
          </Link>
          <Link
            to="/financeiro"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Receipt className="size-4" /> Relatório
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Faturamento do mês"
          value={brl(receita)}
          hint={`${vendasMes.length} vendas registradas`}
          icon={Wallet}
          tone="brand"
        />
        <StatCard
          label="Resultado do mês"
          value={brl(receita - custos)}
          hint={`Despesas ${brl(custos)}`}
          icon={TrendingUp}
          tone={receita - custos >= 0 ? "success" : "danger"}
        />
        <StatCard
          label="Ticket médio"
          value={brl(ticket)}
          hint={`${pecas} peças vendidas`}
          icon={Receipt}
        />
        <StatCard
          label="Alertas de estoque"
          value={String(alertas.length)}
          hint="Itens no mínimo ou abaixo"
          icon={AlertTriangle}
          tone={alertas.length ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard title="Faturamento por mês" description="Vendas realizadas no período">
          <div className="space-y-3">
            {porMes.map((m) => (
              <div key={m.mes} className="grid grid-cols-[3.2rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                <span className="text-xs text-muted-foreground">{mesRotulo(m.mes)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (m.valor / maxMes) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-xs font-medium tabular-nums">
                  {brl(m.valor)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Desempenho por loja" description="Faturamento do mês corrente">
          <div className="space-y-4">
            {porLoja.map((l) => (
              <div key={l.loja}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{l.nome}</p>
                  <p className="text-sm font-semibold tabular-nums">{brl(l.receita)}</p>
                </div>
                <span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(4, (l.receita / maxLoja) * 100)}%` }}
                  />
                </span>
              </div>
            ))}
            <div className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
              Use o seletor no topo para ver estoque e financeiro de uma loja específica.
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard
          title="Últimas vendas"
          description="Registro em tempo real do balcão"
          padded={false}
        >
          <ul className="divide-y divide-border">
            {v.slice(0, 6).map((venda) => (
              <li key={venda.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {nomeCliente(venda.clienteId, venda.clienteAvulso)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dataCurta(venda.data)} · {nomeLoja(venda.loja)} ·{" "}
                    {venda.itens.reduce((s, i) => s + i.qtd, 0)} peças · {venda.pagamento}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{brl(venda.total)}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-4 sm:space-y-5">
          <SectionCard title="Mais vendidos" description="Ranking por peças">
            <ul className="space-y-3">
              {maisVendidos.map((m) => (
                <li key={m.codigo} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold tabular-nums">
                    {m.qtd}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.nome}</span>
                    <span className="block text-xs text-muted-foreground">{m.codigo}</span>
                  </span>
                  <span className="text-xs font-medium tabular-nums">{brl(m.valor)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Relacionamento"
            description="Aniversários próximos"
            actions={
              <Link to="/clientes" className="text-xs font-medium text-brand hover:underline">
                Ver CRM
              </Link>
            }
          >
            <ul className="space-y-3">
              {aniversariantes.map(({ c, dias }) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Cake className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                  <Chip tone={dias <= 7 ? "brand" : "muted"}>
                    {dias === 0 ? "hoje" : `${dias} dias`}
                  </Chip>
                </li>
              ))}
              {aniversariantes.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhum aniversário nos próximos 30 dias.
                </li>
              )}
            </ul>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
