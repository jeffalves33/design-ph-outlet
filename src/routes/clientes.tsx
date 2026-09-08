import { createFileRoute } from "@tanstack/react-router";
import {
  Cake,
  Clock,
  Heart,
  MessageCircle,
  Repeat,
  Search,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HOJE,
  LOJAS,
  brl,
  dataCurta,
  diasEntre,
  diasParaAniversario,
  idade,
  nomeLoja,
  type Cliente,
  type Loja,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "CRM de clientes · PH Outlet" },
      {
        name: "description",
        content:
          "CRM das lojas PH Outlet e PH Outlet Kids: histórico de consumo, aniversários, frequência de compra e oportunidades de contato.",
      },
      { property: "og:title", content: "CRM de clientes · PH Outlet" },
      {
        property: "og:description",
        content:
          "Relacionamento e remarketing: histórico de cada cliente, aniversários próximos e clientes prontos para uma nova compra.",
      },
    ],
  }),
  component: CRM,
});

function CRM() {
  const { clientes, vendas, addCliente } = useStore();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const perfil = useMemo(
    () =>
      clientes.map((c) => {
        const compras = vendas
          .filter((v) => v.clienteId === c.id)
          .sort((a, b) => b.data.localeCompare(a.data));
        const total = compras.reduce((s, v) => s + v.total, 0);
        const ticket = compras.length ? total / compras.length : 0;
        const ultima = compras[0]?.data ?? null;
        const diasSemComprar = ultima ? diasEntre(ultima, HOJE) : null;
        // periodicidade média entre compras
        const intervalos = compras
          .slice(0, -1)
          .map((v, i) => diasEntre(compras[i + 1]!.data, v.data));
        const periodicidade = intervalos.length
          ? Math.round(intervalos.reduce((s, x) => s + x, 0) / intervalos.length)
          : null;
        return {
          cliente: c,
          compras,
          total,
          ticket,
          ultima,
          diasSemComprar,
          periodicidade,
          aniversario: diasParaAniversario(c.nascimento),
        };
      }),
    [clientes, vendas],
  );

  const lista = perfil.filter((p) => {
    const t = busca.trim().toLowerCase();
    return (
      t === "" ||
      p.cliente.nome.toLowerCase().includes(t) ||
      p.cliente.telefone.includes(t) ||
      p.cliente.cidade.toLowerCase().includes(t)
    );
  });

  const aniversariantes = perfil
    .filter((p) => p.aniversario <= 30)
    .sort((a, b) => a.aniversario - b.aniversario);

  const paraReativar = perfil
    .filter(
      (p) =>
        p.periodicidade !== null &&
        p.diasSemComprar !== null &&
        p.diasSemComprar > p.periodicidade,
    )
    .sort((a, b) => (b.diasSemComprar ?? 0) - (a.diasSemComprar ?? 0));

  const melhores = [...perfil].sort((a, b) => b.total - a.total).slice(0, 5);

  const receitaIdentificada = perfil.reduce((s, p) => s + p.total, 0);
  const ticketGeral = (() => {
    const identificadas = vendas.filter((v) => v.clienteId);
    return identificadas.length
      ? identificadas.reduce((s, v) => s + v.total, 0) / identificadas.length
      : 0;
  })();

  const detalhe = perfil.find((p) => p.cliente.id === selecionado) ?? null;

  return (
    <AppShell
      title="CRM de clientes"
      subtitle="Histórico de consumo, aniversários e oportunidades de contato"
      actions={<NovoCliente onSalvar={addCliente} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Clientes cadastrados" value={String(clientes.length)} icon={Users} tone="brand" />
        <StatCard
          label="Receita identificada"
          value={brl(receitaIdentificada)}
          hint="Vendas vinculadas a clientes"
          icon={Heart}
          tone="success"
        />
        <StatCard label="Ticket médio" value={brl(ticketGeral)} icon={Star} />
        <StatCard
          label="Aniversários em 30 dias"
          value={String(aniversariantes.length)}
          icon={Cake}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="carteira">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="carteira" className="flex-1 sm:flex-none">
            Carteira
          </TabsTrigger>
          <TabsTrigger value="oportunidades" className="flex-1 sm:flex-none">
            Oportunidades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="mt-4 space-y-4 sm:space-y-5">
          <SectionCard
            title="Carteira de clientes"
            description={`${lista.length} clientes`}
            padded={false}
          >
            <div className="border-b border-border p-4 sm:px-5">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, telefone ou cidade"
                  className={`${fieldCls} pl-9`}
                />
              </div>
            </div>
            <ul className="divide-y divide-border">
              {lista.map((p) => (
                <li key={p.cliente.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(p.cliente.id)}
                    className="w-full px-4 py-3.5 text-left transition-colors hover:bg-secondary/60 sm:px-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.cliente.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.cliente.telefone} · {p.cliente.cidade} ·{" "}
                          {nomeLoja(p.cliente.lojaPreferida)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.aniversario <= 15 && (
                          <Chip tone="brand">
                            <Cake className="size-3" />
                            {p.aniversario === 0 ? "hoje" : `${p.aniversario}d`}
                          </Chip>
                        )}
                        <Chip tone="muted">{p.compras.length} compras</Chip>
                        <span className="text-sm font-semibold tabular-nums">
                          {brl(p.total)}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
              {lista.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </li>
              )}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="oportunidades" className="mt-4 space-y-4 sm:space-y-5">
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <SectionCard
              title="Aniversários próximos"
              description="Momento ideal para uma mensagem com oferta"
              padded={false}
            >
              <ul className="divide-y divide-border">
                {aniversariantes.map((p) => (
                  <li key={p.cliente.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Cake className="size-4 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {dataCurta(p.cliente.nascimento)} · faz{" "}
                        {idade(p.cliente.nascimento) + (p.aniversario > 0 ? 1 : 0)} anos ·{" "}
                        {p.cliente.telefone}
                      </p>
                    </div>
                    <Chip tone={p.aniversario <= 7 ? "brand" : "muted"}>
                      {p.aniversario === 0 ? "hoje" : `em ${p.aniversario} dias`}
                    </Chip>
                  </li>
                ))}
                {aniversariantes.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nenhum aniversário nos próximos 30 dias.
                  </li>
                )}
              </ul>
            </SectionCard>

            <SectionCard
              title="Hora de reativar"
              description="Passaram do intervalo habitual entre compras"
              padded={false}
            >
              <ul className="divide-y divide-border">
                {paraReativar.map((p) => (
                  <li key={p.cliente.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Clock className="size-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Compra a cada ~{p.periodicidade} dias · última há {p.diasSemComprar}{" "}
                        dias
                      </p>
                    </div>
                    <Chip tone="warning">
                      <MessageCircle className="size-3" /> contatar
                    </Chip>
                  </li>
                ))}
                {paraReativar.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Todos os clientes estão dentro do ritmo de compra.
                  </li>
                )}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <SectionCard title="Melhores clientes" description="Maior valor acumulado">
              <ul className="space-y-3">
                {melhores.map((p, i) => (
                  <li key={p.cliente.id} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.cliente.nome}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        ticket médio {brl(p.ticket)} · {p.compras.length} compras
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{brl(p.total)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Padrões de compra" description="Leituras rápidas da carteira">
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Repeat className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    Intervalo médio entre compras:{" "}
                    <strong className="tabular-nums">
                      {(() => {
                        const p = perfil
                          .map((x) => x.periodicidade)
                          .filter((x): x is number => x !== null);
                        return p.length
                          ? `${Math.round(p.reduce((s, x) => s + x, 0) / p.length)} dias`
                          : "—";
                      })()}
                    </strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    {perfil.filter((p) => p.compras.length > 1).length} clientes já voltaram a
                    comprar — base fiel para lançamentos.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    {LOJAS.map(
                      (l) =>
                        `${clientes.filter((c) => c.lojaPreferida === l.id).length} preferem a ${l.nome}`,
                    ).join(" · ")}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Star className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span>
                    Vendas sem identificação:{" "}
                    <strong>{vendas.filter((v) => !v.clienteId).length}</strong> — pedir o
                    contato no caixa aumenta a base do CRM.
                  </span>
                </li>
              </ul>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setSelecionado(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>{detalhe.cliente.nome}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="eyebrow">Total consumido</p>
                  <p className="mt-1 font-semibold tabular-nums">{brl(detalhe.total)}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="eyebrow">Ticket médio</p>
                  <p className="mt-1 font-semibold tabular-nums">{brl(detalhe.ticket)}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="eyebrow">Aniversário</p>
                  <p className="mt-1 font-semibold">
                    {dataCurta(detalhe.cliente.nascimento)}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="eyebrow">Frequência</p>
                  <p className="mt-1 font-semibold">
                    {detalhe.periodicidade ? `~${detalhe.periodicidade} dias` : "—"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {detalhe.cliente.telefone} · {detalhe.cliente.cidade} · cliente desde{" "}
                {dataCurta(detalhe.cliente.desde)}
                {detalhe.cliente.observacao ? ` · ${detalhe.cliente.observacao}` : ""}
              </p>
              <div>
                <p className="eyebrow mb-2">Histórico de consumo</p>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {detalhe.compras.map((v) => (
                    <li key={v.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{dataCurta(v.data)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {nomeLoja(v.loja)} · {v.pagamento} ·{" "}
                            {v.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">{brl(v.total)}</p>
                      </div>
                    </li>
                  ))}
                  {detalhe.compras.length === 0 && (
                    <li className="p-4 text-center text-sm text-muted-foreground">
                      Ainda sem compras registradas.
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function NovoCliente({
  onSalvar,
}: {
  onSalvar: (c: Omit<Cliente, "id" | "desde">) => string;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    nome: "",
    telefone: "",
    nascimento: "",
    cidade: "",
    lojaPreferida: "outlet" as Loja,
    observacao: "",
  });

  const salvar = () => {
    if (!f.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    onSalvar({
      nome: f.nome.trim(),
      telefone: f.telefone.trim() || "—",
      nascimento: f.nascimento || "1990-01-01",
      cidade: f.cidade.trim() || "—",
      lojaPreferida: f.lojaPreferida,
      observacao: f.observacao.trim() || undefined,
    });
    toast.success("Cliente cadastrado no CRM.");
    setOpen(false);
    setF({ ...f, nome: "", telefone: "", nascimento: "", cidade: "", observacao: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        <UserPlus className="size-4" /> Novo cliente
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar cliente</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <input
              className={fieldCls}
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
            />
          </Field>
          <Field label="WhatsApp">
            <input
              className={fieldCls}
              value={f.telefone}
              onChange={(e) => setF({ ...f, telefone: e.target.value })}
            />
          </Field>
          <Field label="Aniversário">
            <input
              type="date"
              className={fieldCls}
              value={f.nascimento}
              onChange={(e) => setF({ ...f, nascimento: e.target.value })}
            />
          </Field>
          <Field label="Cidade">
            <input
              className={fieldCls}
              value={f.cidade}
              onChange={(e) => setF({ ...f, cidade: e.target.value })}
            />
          </Field>
          <Field label="Loja preferida">
            <select
              className={fieldCls}
              value={f.lojaPreferida}
              onChange={(e) => setF({ ...f, lojaPreferida: e.target.value as Loja })}
            >
              {LOJAS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <input
              className={fieldCls}
              value={f.observacao}
              onChange={(e) => setF({ ...f, observacao: e.target.value })}
              placeholder="Preferências, tamanhos, filhos..."
            />
          </Field>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Salvar cliente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
