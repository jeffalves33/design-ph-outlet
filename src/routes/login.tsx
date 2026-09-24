import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Target } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · PH Outlet" },
      {
        name: "description",
        content: "Acesso administrativo e acompanhamento de metas da equipe PH Outlet.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const { autenticar, sessaoAtiva, usuario } = useStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");

  if (sessaoAtiva) {
    return <Navigate to={usuario.cargo === "Administrador" ? "/" : "/meu-desempenho"} replace />;
  }

  const entrar = (event: FormEvent) => {
    event.preventDefault();
    const resultado = autenticar(email, senha);
    if (resultado === "invalido") {
      setErro("E-mail ou senha incorretos. Confira os dados e tente novamente.");
      return;
    }
    if (resultado === "bloqueado") {
      setErro("Este acesso está bloqueado. Fale com o administrador da loja.");
      return;
    }
    setErro("");
  };

  const preencher = (tipo: "admin" | "vendedor") => {
    if (tipo === "admin") {
      setEmail("paulo@phoutlet.com");
      setSenha("ph-admin-2026");
    } else {
      setEmail("rafael@phoutlet.com");
      setSenha("rafael2026");
    }
    setErro("");
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex lg:flex-col">
        <div className="absolute -top-32 -left-24 size-96 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 size-80 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex items-center">
            <img
              src="/ph_outlet.png"
              alt="Logo PH Outlet"
              className="size-11 rounded-xl bg-white object-contain ring-1 ring-white/15"
            />
            <img
              src="/ph_kids.png"
              alt="Logo PH Outlet Kids"
              className="-ml-3 size-11 rounded-xl bg-white object-contain ring-1 ring-white/15"
            />
          </span>
          <span>
            <span className="block font-display text-sm font-semibold">PH Outlet · Kids</span>
            <span className="block text-[10px] tracking-[0.18em] text-sidebar-foreground/50 uppercase">
              Gestão de lojas
            </span>
          </span>
        </div>

        <div className="relative my-auto max-w-lg py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-xs text-sidebar-foreground/75">
            <ShieldCheck className="size-3.5 text-brand" /> Área segura da equipe
          </span>
          <h1 className="mt-6 font-display text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            Cada venda conta.
            <br />
            Cada meta aproxima.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-sidebar-foreground/60">
            A equipe acompanha seus resultados com clareza, enquanto a administração mantém acessos
            e metas organizados em um só lugar.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
              <Target className="size-5 text-brand" />
              <p className="mt-4 text-sm font-medium">Meta sempre visível</p>
              <p className="mt-1 text-xs leading-5 text-sidebar-foreground/50">
                Progresso atualizado pelas vendas vinculadas.
              </p>
            </div>
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
              <LockKeyhole className="size-5 text-brand" />
              <p className="mt-4 text-sm font-medium">Acesso por perfil</p>
              <p className="mt-1 text-xs leading-5 text-sidebar-foreground/50">
                Cada pessoa vê somente o que precisa.
              </p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-sidebar-foreground/35">
          PH Outlet · Ambiente de demonstração
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/ph_outlet.png"
              alt="PH Outlet"
              className="size-10 rounded-xl bg-white object-contain ring-1 ring-border"
            />
            <div>
              <p className="font-display text-sm font-semibold">PH Outlet · Kids</p>
              <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                Gestão de lojas
              </p>
            </div>
          </div>

          <div>
            <p className="eyebrow text-brand">Bem-vindo</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Acesse sua conta</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use o e-mail e a senha cadastrados pelo administrador.
            </p>
          </div>

          <form onSubmit={entrar} className="mt-8 space-y-4">
            <label className="block">
              <span className="eyebrow mb-2 block">E-mail</span>
              <span className="relative block">
                <Mail className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-card pr-4 pl-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40"
                  placeholder="seuemail@phoutlet.com"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="eyebrow mb-2 block">Senha</span>
              <span className="relative block">
                <LockKeyhole className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-card pr-11 pl-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40"
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((atual) => !atual)}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            {erro && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
              >
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Entrar <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="mt-7 border-t border-border pt-6">
            <p className="text-xs font-medium text-muted-foreground">
              Preencher acesso de demonstração
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => preencher("admin")}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="block text-xs font-semibold">Administrador</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Gestão completa
                </span>
              </button>
              <button
                type="button"
                onClick={() => preencher("vendedor")}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="block text-xs font-semibold">Vendedor</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Somente leitura
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
