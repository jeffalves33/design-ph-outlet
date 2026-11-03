"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [modo, setModo] = useState<"entrar" | "desafio" | "recuperar" | "confirmar-recuperacao">("entrar");
  const [desafio, setDesafio] = useState("");
  const [segredoTotp, setSegredoTotp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  const entrar = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");
    setMensagem("");
    setOcupado(true);
    try {
      const resposta = await fetch("/api/acesso", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ acao: modo, email, senha, codigo, resposta: codigo || senha }),
      });
      const dados = await resposta.json() as { estado?: string; desafio?: string; segredoTotp?: string; erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível concluir.");
      if (dados.estado === "autenticado") { router.replace("/"); router.refresh(); return; }
      if (dados.estado === "desafio") { setDesafio(dados.desafio ?? ""); setSegredoTotp(dados.segredoTotp ?? ""); setModo("desafio"); setSenha(""); setCodigo(""); return; }
      if (dados.estado === "solicitado") {
        setMensagem("Se o e-mail estiver cadastrado, você receberá um código de recuperação.");
        setModo("confirmar-recuperacao");
      }
      if (dados.estado === "concluido") {
        setMensagem("Senha atualizada. Entre com a nova senha."); setModo("entrar"); setSenha(""); setCodigo("");
      }
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
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
          <h1 className="mt-6 font-display text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            PH Outlet
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-sidebar-foreground/60">
            by Prodexy Labs.
          </p>
        </div>

        <p className="relative text-xs text-sidebar-foreground/35">
          PH Outlet · Gestão de lojas
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
            <h2 className="mt-2 font-display text-3xl font-semibold">
              {modo === "entrar" ? "Acesse sua conta" : modo === "desafio" ? "Confirme seu acesso" : "Recupere seu acesso"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {modo === "entrar"
                ? "Use o e-mail e a senha cadastrados pelo administrador."
                : modo === "desafio"
                  ? "Conclua a verificação solicitada para acessar sua conta."
                  : modo === "recuperar"
                    ? "Informe seu e-mail para receber o código de recuperação."
                    : "Informe o código recebido e escolha sua nova senha."}
            </p>
          </div>

          <form onSubmit={entrar} className="mt-8 space-y-4">
            {modo === "desafio" && <p className="text-sm text-muted-foreground">
              {desafio === "NEW_PASSWORD_REQUIRED" ? "Defina uma nova senha." : desafio === "MFA_SETUP" ? "Cadastre esta chave no seu aplicativo autenticador e informe o código gerado." : "Informe o código solicitado pelo Cognito."}
            </p>}
            {modo === "desafio" && segredoTotp && <p className="break-all rounded-xl border border-border bg-card p-3 font-mono text-sm" aria-label="Chave do autenticador">{segredoTotp}</p>}
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
                  disabled={modo === "desafio" || ocupado}
                />
              </span>
            </label>

            {(modo === "entrar" || modo === "desafio" || modo === "confirmar-recuperacao") && <label className="block">
              <span className="eyebrow mb-2 block">Senha</span>
              <span className="relative block">
                <LockKeyhole className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-card pr-11 pl-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40"
                  placeholder={modo === "desafio" && desafio !== "NEW_PASSWORD_REQUIRED" ? "Não necessário" : "Digite sua senha"}
                  disabled={ocupado || (modo === "desafio" && desafio !== "NEW_PASSWORD_REQUIRED")}
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
            </label>}

            {(modo === "desafio" && desafio !== "NEW_PASSWORD_REQUIRED" || modo === "confirmar-recuperacao") && <label className="block">
              <span className="eyebrow mb-2 block">Código</span>
              <input value={codigo} onChange={(event) => setCodigo(event.target.value)} autoComplete="one-time-code"
                className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                disabled={ocupado} />
            </label>}

            {erro && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
              >
                {erro}
              </div>
            )}
            {mensagem && <p role="status" className="text-sm text-brand">{mensagem}</p>}

            <button
              type="submit"
              disabled={ocupado}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {ocupado ? "Aguarde…" : modo === "entrar" ? "Entrar" : modo === "desafio" ? "Confirmar" : modo === "recuperar" ? "Enviar código" : "Atualizar senha"} <ArrowRight className="size-4" />
            </button>
          </form>

          <div className="mt-7 border-t border-border pt-6">
            <button type="button" onClick={() => { setModo(modo === "entrar" ? "recuperar" : "entrar"); setErro(""); setMensagem(""); }}
              className="text-sm text-brand">{modo === "entrar" ? "Esqueci minha senha" : "Voltar ao login"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
