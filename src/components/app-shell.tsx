"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Boxes,
  Cake,
  Check,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Target,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { useEffect, useState, type ReactNode } from "react";
const logoOutlet = "/ph_outlet.png";
const logoKids = "/ph_kids.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWorkspaceOpcional, type EscopoWorkspace, type LojaWorkspace } from "@/features/workspace/contexto";
import { podeAcessar, type Acao, type PerfilAutorizado } from "@/features/acesso/politica";

type NavItem = {
  to:
    | "/"
    | "/vendas"
    | "/estoque"
    | "/financeiro"
    | "/clientes"
    | "/colaboradores"
    | "/meu-desempenho";
  label: string;
  short: string;
  icon: LucideIcon;
  acao: Acao;
  exact?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Painel", short: "Painel", icon: LayoutDashboard, acao: "painel.consultar", exact: true },
  { to: "/vendas", label: "Vendas", short: "Vendas", icon: ShoppingBag, acao: "vendas.consultar" },
  { to: "/estoque", label: "Estoque", short: "Estoque", icon: Boxes, acao: "estoque.consultar" },
  { to: "/financeiro", label: "Financeiro", short: "Caixa", icon: Wallet, acao: "financeiro.consultar" },
  { to: "/clientes", label: "CRM", short: "CRM", icon: Users, acao: "clientes.consultar" },
  { to: "/colaboradores", label: "Funcionários", short: "Equipe", icon: UsersRound, acao: "equipe.consultar" },
];

const navFuncionario: NavItem[] = [
  {
    to: "/meu-desempenho",
    label: "Meu desempenho",
    short: "Minha meta",
    icon: Target,
    acao: "metas.proprias.consultar",
  },
];

const logoDe = (nome: string) => /kids/i.test(nome) ? logoKids : logoOutlet;

function MarcaEscopo({ escopo, nome, size = 36 }: {
  escopo: EscopoWorkspace; nome?: string | undefined; size?: number;
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
      src={logoDe(nome ?? "")}
      alt={`Logo ${nome ?? "da loja"}`}
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
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [sessao, setSessao] = useState<(PerfilAutorizado & { nome: string }) | null>(null);
  const { escopo, setEscopo, lojas, setLojas } = useWorkspaceOpcional();
  useEffect(() => {
    let ativa = true;
    const conferir = async () => {
      try {
        const resposta = await fetch("/api/acesso", { cache: "no-store", credentials: "same-origin" });
        const dados = resposta.ok ? await resposta.json() : null;
        if (!ativa) return;
        const perfil = dados?.perfil ?? null;
        setSessao(perfil);
        if (perfil?.perfil === "administrador") {
          const catalogo = await fetch("/api/catalogo", { cache: "no-store", credentials: "same-origin" });
          const dadosCatalogo = catalogo.ok ? await catalogo.json() : null;
          if (ativa && dadosCatalogo?.lojas) setLojas(dadosCatalogo.lojas);
        } else setLojas([]);
      } catch { if (ativa) { setSessao(null); setLojas([]); } }
    };
    const conferirAoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    conferir();
    const intervalo = window.setInterval(conferir, 12 * 60 * 60 * 1000);
    document.addEventListener("visibilitychange", conferirAoVoltar);
    return () => { ativa = false; window.clearInterval(intervalo); document.removeEventListener("visibilitychange", conferirAoVoltar); };
  }, [setLojas]);
  const sair = async () => {
    try {
      const resposta = await fetch("/api/acesso", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "sair" }) });
      if (!resposta.ok) window.alert("Sessão local encerrada, mas a revogação remota não foi confirmada.");
      router.replace("/login");
      router.refresh();
    } catch {
      window.alert("Não foi possível confirmar a saída. A sessão pode continuar ativa; tente novamente quando houver conexão.");
    }
  };
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const lojaAtual = escopo === "todas" ? null : lojas.find((loja) => loja.id === escopo) ?? null;
  const marcaNome = escopo === "todas" ? "PH Outlet · Kids" : lojaAtual?.nome ?? "PH Outlet";

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {[...nav, ...navFuncionario].filter((item) => podeAcessar(
        sessao, item.acao, item.acao === "metas.proprias.consultar" || item.acao === "equipe.consultar"
          ? {} : { todas: true },
      )).map((item) => {
        const active = isActive(item.to, item.exact);
        return (
          <Link
            key={item.to}
            href={item.to}
            onClick={() => onNavigate?.()}
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
      <MarcaEscopo escopo={escopo} nome={lojaAtual?.nome} size={40} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-sm font-semibold tracking-tight">
          {marcaNome}
        </span>
        <span className="eyebrow block truncate text-sidebar-foreground/50">Gestão de lojas</span>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
        <Link href="/" className="px-1.5">
          <Marca />
        </Link>
        <div className="mt-6 mb-4 rule-brand" />
        <NavLinks />
        <div className="mt-auto rounded-2xl bg-sidebar-accent p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow text-sidebar-foreground/50">Sessão</p>
              <p className="mt-1 truncate text-sm font-medium">{sessao?.nome ?? "Carregando sessão"}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{sessao?.perfil ?? "Verificando acesso"}</p>
            </div>
            <button
              type="button"
              onClick={sair}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar/60 hover:text-sidebar-foreground"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
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
              {sessao?.perfil === "administrador" && <SeletorLoja escopo={escopo} lojas={lojas} onChange={setEscopo} />}
            </div>

            <Notificacoes ativo={sessao?.perfil === "administrador"} />

            <span className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-brand" />
              {sessao?.nome ?? "Verificando acesso"}
            </span>

            <button
              type="button"
              onClick={sair}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
              aria-label="Sair"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-14">
          <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:py-8">
            <div className="min-w-0">
              <h1 className="font-display text-[1.4rem] leading-tight font-semibold sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-sm text-muted-foreground sm:text-[0.95rem]">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6">
            {children}
            {!new Set(["/catalogo", "/estoque", "/vendas", "/colaboradores", "/meu-desempenho", "/clientes", "/financeiro"]).has(pathname) && <p role="status" className="text-xs text-muted-foreground">
              Interface preservada. Dados e gravações indisponíveis até a integração segura.
            </p>}
          </div>
        </main>
      </div>
    </div>
  );
}

function SeletorLoja({ escopo, lojas, onChange }: {
  escopo: EscopoWorkspace; lojas: readonly LojaWorkspace[];
  onChange: (e: EscopoWorkspace) => void;
}) {
  const [open, setOpen] = useState(false);
  const escopos = [{ id: "todas", nome: "Todas as lojas" } as LojaWorkspace, ...lojas];
  const atual = escopos.find((item) => item.id === escopo) ?? escopos[0]!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex w-full max-w-[15rem] items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 text-left transition-colors hover:bg-secondary sm:max-w-[17rem]"
        aria-label="Selecionar loja"
      >
        <MarcaEscopo escopo={escopo} nome={atual.nome} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium leading-tight">
            {atual.nome}
          </span>
          <span className="hidden text-[10px] tracking-wide text-muted-foreground uppercase sm:block">
            Loja em exibição
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[16rem] p-1.5">
        {escopos.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onChange(item.id);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
              escopo === item.id ? "bg-secondary" : "hover:bg-secondary/70"
            }`}
          >
            <MarcaEscopo escopo={item.id} nome={item.nome} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm">{item.nome}</span>
            {escopo === item.id && <Check className="size-4 shrink-0 text-brand" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function diasParaAniversario(nascimento: string) {
  const hojeTexto = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const hoje = new Date(`${hojeTexto}T00:00:00Z`);
  const [, mes, dia] = nascimento.split("-").map(Number);
  let proximo = new Date(Date.UTC(hoje.getUTCFullYear(), (mes ?? 1) - 1, dia ?? 1));
  if (proximo < hoje) proximo = new Date(Date.UTC(hoje.getUTCFullYear() + 1, (mes ?? 1) - 1, dia ?? 1));
  return Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
}

function Notificacoes({ ativo }: { ativo: boolean }) {
  const { escopo } = useWorkspaceOpcional();
  const [aniversarios, setAniversarios] = useState<{ id: string; nome: string; dias: number }[]>([]);
  const [semEstoque, setSemEstoque] = useState<{
    id: string; lojaId: string; nome: string; tamanho: string; codigo: number;
  }[]>([]);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!ativo) { setAniversarios([]); setSemEstoque([]); setFalhou(false); return; }
    let atual = true;
    Promise.all([
      fetch("/api/clientes", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/catalogo", { cache: "no-store", credentials: "same-origin" }),
    ]).then(async ([clientesResposta, catalogoResposta]) => {
      if (!clientesResposta.ok || !catalogoResposta.ok) throw new Error();
      const clientes = await clientesResposta.json();
      const catalogo = await catalogoResposta.json();
      if (!atual) return;
      setAniversarios((clientes.clientes ?? [])
        .filter((cliente: { dataNascimento: string | null }) => cliente.dataNascimento)
        .map((cliente: { id: string; nome: string; dataNascimento: string }) => ({
          id: cliente.id, nome: cliente.nome, dias: diasParaAniversario(cliente.dataNascimento),
        })).filter((item: { dias: number }) => item.dias <= 15)
        .sort((a: { dias: number }, b: { dias: number }) => a.dias - b.dias));
      setSemEstoque((catalogo.categorias ?? [])
        .filter((categoria: { quantidade: string }) => BigInt(categoria.quantidade) === 0n)
        .map((categoria: { id: string; loja_id: string; nome: string; tamanho: string; codigo: number }) => ({
          id: categoria.id, lojaId: categoria.loja_id, nome: categoria.nome,
          tamanho: categoria.tamanho, codigo: categoria.codigo,
        })));
      setFalhou(false);
    }).catch(() => { if (atual) setFalhou(true); });
    return () => { atual = false; };
  }, [ativo]);

  const estoqueVisivel = escopo === "todas" ? semEstoque : semEstoque.filter((item) => item.lojaId === escopo);
  const total = aniversarios.length + estoqueVisivel.length;

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
            {falhou ? "Alertas indisponíveis." : total === 0 ? "Nenhum alerta ativo." : `${total} alertas ativos`}
          </p>
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {aniversarios.map((item) => (
            <div key={item.id} className="flex gap-3 px-4 py-3">
              <Cake className="mt-0.5 size-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.dias === 0 ? "Faz aniversário hoje" : `Aniversário em ${item.dias} dias`} · contato de
                  relacionamento
                </p>
              </div>
            </div>
          ))}
          {estoqueVisivel.map((item) => (
            <div key={item.id} className="flex gap-3 px-4 py-3">
              <PackageSearch className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.nome} · {item.tamanho}</p>
                <p className="text-xs text-muted-foreground">
                  {String(item.codigo).padStart(5, "0")} · estoque zerado
                </p>
              </div>
            </div>
          ))}
          {total === 0 && (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
              <Sparkles className="size-4" /> {falhou ? "Não foi possível consultar os alertas." : "Nenhum aniversário próximo ou estoque zerado."}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5" /> Dados atuais do catálogo e CRM
        </div>
      </PopoverContent>
    </Popover>
  );
}
