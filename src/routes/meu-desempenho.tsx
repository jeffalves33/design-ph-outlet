import { createFileRoute } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Mail,
  PackageCheck,
  Phone,
  ReceiptText,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Chip, SectionCard } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { HOJE, brl, dataCurta, nomeLoja } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/meu-desempenho")({
  head: () => ({
    meta: [
      { title: "Meu desempenho · PH Outlet" },
      {
        name: "description",
        content: "Acompanhamento individual de vendas e meta mensal do funcionário.",
      },
    ],
  }),
  component: MeuDesempenho,
});

const mesAtual = HOJE.slice(0, 7);

function MeuDesempenho() {
  const { usuario, vendas, nomeCliente } = useStore();
  const minhasVendas = vendas.filter(
    (venda) => venda.vendedorId === usuario.id && venda.data.startsWith(mesAtual),
  );
  const vendido = minhasVendas.reduce((soma, venda) => soma + venda.total, 0);
  const pecas = minhasVendas.reduce(
    (soma, venda) => soma + venda.itens.reduce((total, item) => total + item.qtd, 0),
    0,
  );
  const ticketMedio = minhasVendas.length ? vendido / minhasVendas.length : 0;
  const progresso = usuario.metaMensal ? Math.round((vendido / usuario.metaMensal) * 100) : 0;
  const falta = Math.max(0, usuario.metaMensal - vendido);

  return (
    <AppShell
      title={`Olá, ${usuario.nome.split(" ")[0]}`}
      subtitle="Acompanhe seu resultado — seus dados são atualizados pelas vendas registradas"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Vendido no mês" value={brl(vendido)} icon={TrendingUp} tone="success" />
        <StatCard
          label="Minha meta"
          value={usuario.metaMensal ? brl(usuario.metaMensal) : "Sem meta"}
          icon={Target}
          tone="brand"
        />
        <StatCard
          label="Vendas realizadas"
          value={String(minhasVendas.length)}
          icon={ShoppingBag}
        />
        <StatCard label="Ticket médio" value={brl(ticketMedio)} icon={ReceiptText} />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <SectionCard title="Minha meta de setembro" description="Progresso individual do mês atual">
          {usuario.metaMensal > 0 ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Resultado atual</p>
                  <p className="mt-2 font-display text-3xl font-semibold tabular-nums sm:text-4xl">
                    {progresso}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{brl(vendido)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">de {brl(usuario.metaMensal)}</p>
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${progresso >= 100 ? "bg-success" : "bg-brand"}`}
                  style={{ width: `${Math.min(100, progresso)}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <ResumoMeta
                  label="Falta para a meta"
                  value={falta ? brl(falta) : "Meta alcançada"}
                />
                <ResumoMeta label="Peças vendidas" value={String(pecas)} />
                <ResumoMeta label="Média por venda" value={brl(ticketMedio)} />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Target className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nenhuma meta comercial definida</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Seu administrador pode definir uma meta no perfil.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Meu perfil" description="Informações cadastradas pelo administrador">
          <div className="space-y-3">
            <Dado icon={Mail} label="E-mail" value={usuario.login} />
            <Dado icon={Phone} label="Telefone" value={usuario.telefone} />
            <Dado icon={BriefcaseBusiness} label="Cargo" value={usuario.cargo} />
            <Dado icon={Building2} label="Loja" value={usuario.lojas.map(nomeLoja).join(" · ")} />
            <Dado icon={CalendarDays} label="Na equipe desde" value={dataCurta(usuario.desde)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Minhas vendas no mês"
        description="Vendas em que você foi selecionado como responsável"
        actions={<Chip tone="muted">{minhasVendas.length} registros</Chip>}
        padded={false}
      >
        <div className="divide-y divide-border">
          {minhasVendas.map((venda) => {
            const quantidade = venda.itens.reduce((soma, item) => soma + item.qtd, 0);
            return (
              <article
                key={venda.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
                  <PackageCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {nomeCliente(venda.clienteId, venda.clienteAvulso)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {dataCurta(venda.data)} · {nomeLoja(venda.loja)} · {quantidade}{" "}
                    {quantidade === 1 ? "peça" : "peças"} · {venda.pagamento}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums sm:text-right">
                  {brl(venda.total)}
                </p>
              </article>
            );
          })}
          {minhasVendas.length === 0 && (
            <div className="px-4 py-12 text-center">
              <ShoppingBag className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nenhuma venda vinculada neste mês</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assim que uma venda for registrada em seu nome, ela aparecerá aqui.
              </p>
            </div>
          )}
        </div>
      </SectionCard>
    </AppShell>
  );
}

function ResumoMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/70 p-3.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Dado({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
