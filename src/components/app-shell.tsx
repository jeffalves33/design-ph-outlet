import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  Cake,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  Menu,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useState, type ReactNode } from "react";
const logoOutlet = "/ph_outlet.png";
const logoKids = "/ph_kids.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LOJAS, diasParaAniversario, nomeLoja } from "@/lib/mock-data";
import { porEscopo, useStore, type Escopo } from "@/lib/store";

type NavItem = {
  to: "/" | "/vendas" | "/estoque" | "/financeiro" | "/clientes" | "/colaboradores";
  label: string;
  short: string;
  icon: LucideIcon;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Painel", short: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/vendas", label: "Vendas", short: "Vendas", icon: ShoppingBag },
  { to: "/estoque", label: "Estoque", short: "Estoque", icon: Boxes },
  { to: "/financeiro", label: "Financeiro", short: "Caixa", icon: Wallet },
  { to: "/clientes", label: "CRM", short: "CRM", icon: Users },
  { to: "/colaboradores", label: "Colaboradores", short: "Equipe", icon: UsersRound },
];

const escopos: { id: Escopo; label: string }[] = [
  { id: "todas", label: "Todas as lojas" },
  ...LOJAS.map((l) => ({ id: l.id as Escopo, label: l.nome })),
];

const logoDe = (id: Escopo) => (id === "kids" ? logoKids : logoOutlet);

function MarcaEscopo({
  escopo,
  size = 36,
}: {
  escopo: Escopo;
  size?: number;
}) {
  const cls = "rounded-lg bg-white object-contain ring-1 ring-border/70";
  if (escopo === "todas") {
    return (
      <span className="relative flex shrink-0 items-center" style={{ height: size }}>
        <img
          src={logoOutlet}
          alt="Logo PH Outlet"
          className={cls}
          style={{ width: size, height: size }}
        />
        <img
          src={logoKids}
          alt="Logo PH Outlet Kids"
          className={`${cls} -ml-3`}
          style={{ width: size, height: size }}
        />
      </span>
    );
  }
  return (
    <img
      src={logoDe(escopo)}
      alt={`Logo ${nomeLoja(escopo)}`}
      className={`${cls} shrink-0`}
      style={{ width: size, height: size }}
    />
  );
}


export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);
  const { escopo, setEscopo, usuario } = useStore();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const marcaNome = escopo === "todas" ? "PH Outlet · Kids" : nomeLoja(escopo);


  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(item.to, item.exact);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="size-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const Marca = () => (
    <div className="flex min-w-0 items-center gap-3">
      <MarcaEscopo escopo={escopo} size={40} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-sm font-semibold tracking-tight">
          {marcaNome}
        </span>
        <span className="eyebrow block truncate text-sidebar-foreground/50">
          Gestão de lojas
        </span>
      </span>
    </div>
  );


  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <Link to="/" className="px-1.5">
          <Marca />
        </Link>
        <div className="mt-6 mb-4 rule-brand" />
        <NavLinks />
        <div className="mt-auto rounded-2xl bg-sidebar-accent p-3.5">
          <p className="eyebrow text-sidebar-foreground/50">Sessão</p>
          <p className="mt-1 truncate text-sm font-medium">{usuario.nome}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{usuario.cargo}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Sheet open={aberto} onOpenChange={setAberto}>
              <SheetTrigger
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="size-[18px]" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[272px] bg-sidebar p-4 text-sidebar-foreground"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Marca />
                <div className="my-4 rule-brand" />
                <NavLinks onNavigate={() => setAberto(false)} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <SeletorLoja escopo={escopo} onChange={setEscopo} />
            </div>

            <Notificacoes />

            <span className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-brand" />
              {usuario.nome.split(" ")[0]} · {usuario.cargo.toLowerCase()}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-14">
          <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:py-8">
            <div className="min-w-0">
              <h1 className="font-display text-[1.4rem] leading-tight font-semibold sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-muted-foreground sm:text-[0.95rem]">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );

}

function SeletorLoja({
  escopo,
  onChange,
}: {
  escopo: Escopo;
  onChange: (e: Escopo) => void;
}) {
  const [open, setOpen] = useState(false);
  const atual = escopos.find((e) => e.id === escopo)!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex w-full max-w-[15rem] items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 text-left transition-colors hover:bg-secondary sm:max-w-[17rem]"
        aria-label="Selecionar loja"
      >
        <MarcaEscopo escopo={escopo} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium leading-tight">
            {atual.label}
          </span>
          <span className="hidden text-[10px] tracking-wide text-muted-foreground uppercase sm:block">
            Loja em exibição
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[16rem] p-1.5">
        {escopos.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              onChange(e.id);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
              escopo === e.id ? "bg-secondary" : "hover:bg-secondary/70"
            }`}
          >
            <MarcaEscopo escopo={e.id} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm">{e.label}</span>
            {escopo === e.id && <Check className="size-4 shrink-0 text-brand" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}


function Notificacoes() {
  const { clientes, produtos, escopo } = useStore();

  const aniversarios = clientes
    .map((c) => ({ c, dias: diasParaAniversario(c.nascimento) }))
    .filter((x) => x.dias <= 15)
    .sort((a, b) => a.dias - b.dias);

  const baixoEstoque = porEscopo(produtos, escopo).filter(
    (p) => p.estoque <= p.estoqueMinimo,
  );

  const total = aniversarios.length + baixoEstoque.length;

  return (
    <Popover>
      <PopoverTrigger
        className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary"
        aria-label={`Notificações (${total})`}
      >
        <Bell className="size-[18px]" />
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[19rem] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="eyebrow">Notificações</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total === 0 ? "Nada pendente por aqui." : `${total} alertas ativos`}
          </p>
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {aniversarios.map(({ c, dias }) => (
            <div key={c.id} className="flex gap-3 px-4 py-3">
              <Cake className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {dias === 0 ? "Faz aniversário hoje" : `Aniversário em ${dias} dias`} ·
                  contato de relacionamento
                </p>
              </div>
            </div>
          ))}
          {baixoEstoque.map((p) => (
            <div key={p.id} className="flex gap-3 px-4 py-3">
              <PackageSearch className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {p.codigo} · {p.estoque} un. em estoque (mín. {p.estoqueMinimo})
                </p>
              </div>
            </div>
          ))}
          {total === 0 && (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
              <Sparkles className="size-4" /> Tudo em ordem nas duas lojas.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5" /> Alertas atualizados automaticamente
        </div>
      </PopoverContent>
    </Popover>
  );
}
