import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Target,
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
} from "@/components/ui/dialog";
import {
  HOJE,
  LOJAS,
  brl,
  dataCurta,
  nomeLoja,
  type Colaborador,
  type Loja,
} from "@/lib/mock-data";
import { useStore } from "@/lib/store";

const cargos: Colaborador["cargo"][] = ["Administrador", "Gerente", "Vendedor", "Estoquista"];

const mesAtual = HOJE.slice(0, 7);

export const Route = createFileRoute("/colaboradores")({
  head: () => ({
    meta: [
      { title: "Equipe e metas · PH Outlet" },
      {
        name: "description",
        content:
          "Administre contas de funcionários, permissões de loja e metas de vendas da equipe PH Outlet.",
      },
    ],
  }),
  component: Colaboradores,
});

type Rascunho = {
  nome: string;
  login: string;
  senha: string;
  telefone: string;
  cargo: Colaborador["cargo"];
  lojas: Loja[];
  ativo: boolean;
  metaMensal: string;
};

const vazio: Rascunho = {
  nome: "",
  login: "",
  senha: "",
  telefone: "",
  cargo: "Vendedor",
  lojas: ["outlet"],
  ativo: true,
  metaMensal: "8000",
};

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

function Colaboradores() {
  const { colaboradores, vendas, addColaborador, updateColaborador, nomeCliente } = useStore();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [detalhando, setDetalhando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "ativos" | "bloqueados">("todos");
  const [f, setF] = useState<Rascunho>(vazio);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const vendasDoMes = useMemo(() => vendas.filter((v) => v.data.startsWith(mesAtual)), [vendas]);

  const desempenho = (id: string) => {
    const doVendedor = vendasDoMes.filter((v) => v.vendedorId === id);
    return {
      vendas: doVendedor,
      total: doVendedor.reduce((soma, venda) => soma + venda.total, 0),
      pecas: doVendedor.reduce(
        (soma, venda) => soma + venda.itens.reduce((qtd, item) => qtd + item.qtd, 0),
        0,
      ),
    };
  };

  const abrirNovo = () => {
    setF(vazio);
    setMostrarSenha(false);
    setEditando("novo");
  };

  const abrirEdicao = (c: Colaborador) => {
    setF({
      nome: c.nome,
      login: c.login,
      senha: c.senha,
      telefone: c.telefone,
      cargo: c.cargo,
      lojas: c.lojas,
      ativo: c.ativo,
      metaMensal: String(c.metaMensal),
    });
    setMostrarSenha(false);
    setEditando(c.id);
  };

  const salvar = () => {
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.login.trim());
    if (!f.nome.trim() || !emailValido) {
      toast.error("Informe o nome e um e-mail válido.");
      return;
    }
    if (f.senha.trim().length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (f.lojas.length === 0) {
      toast.error("Selecione ao menos uma loja de acesso.");
      return;
    }
    const emailEmUso = colaboradores.some(
      (c) => c.login.toLowerCase() === f.login.trim().toLowerCase() && c.id !== editando,
    );
    if (emailEmUso) {
      toast.error("Este e-mail já pertence a outro funcionário.");
      return;
    }

    const dados = {
      nome: f.nome.trim(),
      login: f.login.trim().toLowerCase(),
      senha: f.senha.trim(),
      telefone: f.telefone.trim() || "Não informado",
      cargo: f.cargo,
      lojas: f.lojas,
      ativo: f.ativo,
      metaMensal: Math.max(0, Number(f.metaMensal) || 0),
    };

    if (editando === "novo") {
      addColaborador(dados);
      toast.success("Funcionário criado e acesso liberado.");
    } else if (editando) {
      updateColaborador(editando, dados);
      toast.success("Perfil e meta atualizados.");
    }
    setEditando(null);
  };

  const alternarLoja = (loja: Loja) =>
    setF((prev) => ({
      ...prev,
      lojas: prev.lojas.includes(loja)
        ? prev.lojas.filter((item) => item !== loja)
        : [...prev.lojas, loja],
    }));

  const filtrados = colaboradores.filter((c) => {
    const termo = busca.trim().toLowerCase();
    const corresponde =
      !termo ||
      c.nome.toLowerCase().includes(termo) ||
      c.login.toLowerCase().includes(termo) ||
      c.cargo.toLowerCase().includes(termo);
    const correspondeStatus = status === "todos" || (status === "ativos" ? c.ativo : !c.ativo);
    return corresponde && correspondeStatus;
  });

  const ativos = colaboradores.filter((c) => c.ativo);
  const vendedores = colaboradores.filter((c) => c.metaMensal > 0);
  const totalVendido = vendasDoMes.reduce((soma, venda) => soma + venda.total, 0);
  const metaEquipe = vendedores.reduce((soma, c) => soma + c.metaMensal, 0);
  const progressoEquipe = metaEquipe ? Math.round((totalVendido / metaEquipe) * 100) : 0;
  const perfil = colaboradores.find((c) => c.id === detalhando) ?? null;
  const desempenhoPerfil = perfil ? desempenho(perfil.id) : null;

  return (
    <AppShell
      title="Funcionários"
      subtitle="Acessos, perfis e acompanhamento de metas da equipe"
      actions={
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <UserPlus className="size-4" /> Novo funcionário
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Equipe ativa"
          value={`${ativos.length} de ${colaboradores.length}`}
          icon={Users}
          tone="brand"
        />
        <StatCard
          label="Vendas no mês"
          value={brl(totalVendido)}
          icon={ShoppingBag}
          tone="success"
        />
        <StatCard label="Meta da equipe" value={brl(metaEquipe)} icon={Target} />
        <StatCard
          label="Meta alcançada"
          value={`${progressoEquipe}%`}
          icon={progressoEquipe >= 100 ? CheckCircle2 : ArrowUpRight}
          tone={progressoEquipe >= 100 ? "success" : "warning"}
        />
      </div>

      <SectionCard
        title="Equipe cadastrada"
        description="Gerencie dados de acesso e acompanhe o resultado individual"
        actions={
          <span className="text-xs text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? "perfil" : "perfis"}
          </span>
        }
        padded={false}
      >
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:px-5">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className={`${fieldCls} pl-9`}
              placeholder="Buscar por nome, e-mail ou cargo"
              aria-label="Buscar funcionários"
            />
          </label>
          <div className="flex rounded-xl bg-secondary p-1">
            {(["todos", "ativos", "bloqueados"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors ${
                  status === item
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtrados.map((c) => {
            const dados = desempenho(c.id);
            const porcentagem = c.metaMensal ? Math.round((dados.total / c.metaMensal) * 100) : 0;
            return (
              <article key={c.id} className="p-4 sm:px-5 sm:py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <button
                    type="button"
                    onClick={() => setDetalhando(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent font-display text-sm font-semibold text-accent-foreground">
                      {iniciais(c.nome)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{c.nome}</span>
                        <Chip tone={c.ativo ? "success" : "danger"}>
                          {c.ativo ? "Ativo" : "Bloqueado"}
                        </Chip>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {c.cargo} · {c.login}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.lojas.map((loja) => (
                          <Chip key={loja} tone={loja === "kids" ? "brand" : "muted"}>
                            {nomeLoja(loja)}
                          </Chip>
                        ))}
                      </span>
                    </span>
                  </button>

                  <div className="grid gap-3 sm:grid-cols-[minmax(13rem,1fr)_auto] xl:w-[31rem]">
                    {c.metaMensal > 0 ? (
                      <button
                        type="button"
                        onClick={() => setDetalhando(c.id)}
                        className="rounded-xl bg-secondary/70 px-3.5 py-3 text-left"
                      >
                        <span className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium">{brl(dados.total)} vendidos</span>
                          <span className="text-muted-foreground">meta {brl(c.metaMensal)}</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-border">
                          <span
                            className={`block h-full rounded-full ${porcentagem >= 100 ? "bg-success" : "bg-brand"}`}
                            style={{ width: `${Math.min(100, porcentagem)}%` }}
                          />
                        </span>
                        <span className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{dados.vendas.length} vendas no mês</span>
                          <span className="font-semibold text-foreground">{porcentagem}%</span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center rounded-xl border border-dashed border-border px-3.5 py-3 text-xs text-muted-foreground">
                        <Target className="mr-2 size-4" /> Sem meta comercial definida
                      </div>
                    )}
                    <div className="flex items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setDetalhando(c.id)}
                        className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        Ver perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(c)}
                        aria-label={`Editar ${c.nome}`}
                        className="grid size-9 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {filtrados.length === 0 && (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nenhum funcionário encontrado</p>
              <p className="mt-1 text-xs text-muted-foreground">Tente outro nome ou filtro.</p>
            </div>
          )}
        </div>
      </SectionCard>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editando === "novo" ? "Cadastrar funcionário" : "Editar funcionário"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {editando === "novo"
                ? "Crie o perfil, as credenciais e a meta inicial."
                : "Atualize dados, acesso às lojas e meta mensal."}
            </p>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome completo" className="sm:col-span-2">
                <input
                  className={fieldCls}
                  value={f.nome}
                  onChange={(e) => setF({ ...f, nome: e.target.value })}
                  placeholder="Nome do funcionário"
                />
              </Field>
              <Field label="E-mail de acesso">
                <input
                  type="email"
                  className={fieldCls}
                  value={f.login}
                  onChange={(e) => setF({ ...f, login: e.target.value })}
                  placeholder="nome@phoutlet.com"
                />
              </Field>
              <Field label="Telefone">
                <input
                  className={fieldCls}
                  value={f.telefone}
                  onChange={(e) => setF({ ...f, telefone: e.target.value })}
                  placeholder="(27) 99999-9999"
                />
              </Field>
              <Field label="Senha de acesso">
                <span className="relative block">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    className={`${fieldCls} pr-10`}
                    value={f.senha}
                    onChange={(e) => setF({ ...f, senha: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((atual) => !atual)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </Field>
              <Field label="Cargo">
                <select
                  className={fieldCls}
                  value={f.cargo}
                  onChange={(e) => setF({ ...f, cargo: e.target.value as Colaborador["cargo"] })}
                >
                  {cargos.map((cargo) => (
                    <option key={cargo}>{cargo}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Target className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Field label="Meta mensal de vendas (R$)">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      className={fieldCls}
                      value={f.metaMensal}
                      onChange={(e) => setF({ ...f, metaMensal: e.target.value })}
                    />
                  </Field>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Use 0 para cargos sem meta comercial. O progresso é calculado pelas vendas
                    vinculadas ao funcionário.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Acesso às lojas</p>
              <div className="grid grid-cols-2 gap-2">
                {LOJAS.map((loja) => {
                  const selecionada = f.lojas.includes(loja.id);
                  return (
                    <button
                      key={loja.id}
                      type="button"
                      onClick={() => alternarLoja(loja.id)}
                      className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-colors ${
                        selecionada
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      <Building2 className="size-4" /> {loja.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3.5">
              <span>
                <span className="block text-sm font-medium">Acesso ao sistema</span>
                <span className="block text-xs text-muted-foreground">
                  Funcionários bloqueados não poderão entrar.
                </span>
              </span>
              <input
                type="checkbox"
                checked={f.ativo}
                onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                className="size-4 rounded border-input"
              />
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {editando === "novo" ? "Criar funcionário" : "Salvar alterações"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perfil !== null} onOpenChange={(aberto) => !aberto && setDetalhando(null)}>
        {perfil && desempenhoPerfil && (
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent font-display text-sm font-semibold text-accent-foreground">
                  {iniciais(perfil.nome)}
                </span>
                <div className="min-w-0">
                  <DialogTitle>{perfil.nome}</DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">{perfil.cargo}</span>
                    <Chip tone={perfil.ativo ? "success" : "danger"}>
                      {perfil.ativo ? "Acesso ativo" : "Acesso bloqueado"}
                    </Chip>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-secondary p-4">
                <p className="eyebrow">Vendido no mês</p>
                <p className="mt-2 font-display text-xl font-semibold">
                  {brl(desempenhoPerfil.total)}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="eyebrow">Vendas realizadas</p>
                <p className="mt-2 font-display text-xl font-semibold">
                  {desempenhoPerfil.vendas.length}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary p-4">
                <p className="eyebrow">Peças vendidas</p>
                <p className="mt-2 font-display text-xl font-semibold">{desempenhoPerfil.pecas}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Meta de setembro</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {perfil.metaMensal > 0
                      ? `${brl(desempenhoPerfil.total)} de ${brl(perfil.metaMensal)}`
                      : "Nenhuma meta comercial definida"}
                  </p>
                </div>
                {perfil.metaMensal > 0 && (
                  <span className="font-display text-xl font-semibold">
                    {Math.round((desempenhoPerfil.total / perfil.metaMensal) * 100)}%
                  </span>
                )}
              </div>
              {perfil.metaMensal > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.min(100, (desempenhoPerfil.total / perfil.metaMensal) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={Mail} label="E-mail de acesso" value={perfil.login} />
              <Info icon={Phone} label="Telefone" value={perfil.telefone} />
              <Info icon={BriefcaseBusiness} label="Cargo" value={perfil.cargo} />
              <Info icon={CalendarDays} label="Na equipe desde" value={dataCurta(perfil.desde)} />
              <Info
                icon={Building2}
                label="Lojas liberadas"
                value={perfil.lojas.map(nomeLoja).join(" · ")}
              />
              <Info
                icon={perfil.ativo ? ShieldCheck : Ban}
                label="Status da conta"
                value={perfil.ativo ? "Acesso liberado" : "Acesso bloqueado"}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold">Vendas recentes</h3>
                  <p className="text-xs text-muted-foreground">
                    Lançamentos vinculados a este funcionário
                  </p>
                </div>
                <BadgeCheck className="size-4 text-brand" />
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {desempenhoPerfil.vendas.slice(0, 5).map((venda) => (
                  <div key={venda.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {nomeCliente(venda.clienteId, venda.clienteAvulso)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dataCurta(venda.data)} · {nomeLoja(venda.loja)} · {venda.itens.length}{" "}
                        {venda.itens.length === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {brl(venda.total)}
                    </p>
                  </div>
                ))}
                {desempenhoPerfil.vendas.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma venda vinculada neste mês.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                onClick={() => {
                  updateColaborador(perfil.id, { ativo: !perfil.ativo });
                  toast.success(perfil.ativo ? "Acesso bloqueado." : "Acesso liberado.");
                }}
                className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
              >
                {perfil.ativo ? "Bloquear acesso" : "Liberar acesso"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetalhando(null);
                  abrirEdicao(perfil);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                <Pencil className="size-3.5" /> Editar perfil e meta
              </button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </AppShell>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof AtSign; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1 truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
