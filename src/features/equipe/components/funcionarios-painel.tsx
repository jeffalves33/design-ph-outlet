"use client";

import { KeyRound, Pencil, Plus, ShieldCheck, Store, UserCheck, UserRound, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Loja = { id: string; nome: string };
type Funcionario = {
  id: string; nome: string; email: string; perfil: "administrador" | "vendedor"; ativo: boolean;
  lojas: { id: string; nome: string; ativo: boolean }[];
};
type Formulario = { nome: string; email: string; lojas: string[] };
const vazio: Formulario = { nome: "", email: "", lojas: [] };

export default function FuncionariosPainel() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Funcionario | "novo" | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(vazio);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const resposta = await fetch("/api/funcionarios", { cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar os funcionários.");
      setFuncionarios(dados.funcionarios ?? []); setLojas(dados.lojas ?? []);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Falha ao carregar."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrirNovo = () => { setFormulario({ ...vazio, lojas: lojas.map((loja) => loja.id) }); setEditando("novo"); };
  const abrirEdicao = (funcionario: Funcionario) => {
    setFormulario({ nome: funcionario.nome, email: funcionario.email,
      lojas: funcionario.lojas.filter((loja) => loja.ativo).map((loja) => loja.id) });
    setEditando(funcionario);
  };
  const alternarLoja = (id: string) => setFormulario((atual) => ({ ...atual,
    lojas: atual.lojas.includes(id) ? atual.lojas.filter((item) => item !== id) : [...atual.lojas, id] }));

  const salvar = async () => {
    setSalvando(true);
    try {
      const novo = editando === "novo";
      const resposta = await fetch("/api/funcionarios", { method: novo ? "POST" : "PATCH",
        credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo ? formulario : { ...formulario, id: editando?.id, acao: "editar" }) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível salvar o funcionário.");
      toast.success(novo ? "Funcionário criado e convite enviado." : "Funcionário atualizado.");
      setEditando(null); await carregar();
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha ao salvar."); }
    finally { setSalvando(false); }
  };

  const executar = async (funcionario: Funcionario, acao: "ativar" | "bloquear" | "reenviar_convite") => {
    if (acao === "bloquear" && !window.confirm(`Bloquear ${funcionario.nome} e revogar suas sessões?`)) return;
    setSalvando(true);
    try {
      const resposta = await fetch("/api/funcionarios", { method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: funcionario.id, acao }) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível concluir a ação.");
      toast.success(acao === "bloquear" ? "Funcionário bloqueado e sessões revogadas."
        : acao === "ativar" ? "Funcionário ativado." : "Convite reenviado.");
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha na operação."); }
    finally { setSalvando(false); await carregar(); }
  };

  const vendedores = funcionarios.filter((item) => item.perfil === "vendedor");
  const ativos = vendedores.filter((item) => item.ativo).length;
  const ambas = vendedores.filter((item) => item.lojas.filter((loja) => loja.ativo).length > 1).length;
  const totalVinculos = useMemo(() => vendedores.reduce((total, item) =>
    total + item.lojas.filter((loja) => loja.ativo).length, 0), [vendedores]);

  return <>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-display text-xl font-semibold">Gestão de funcionários</h2>
        <p className="mt-1 text-sm text-muted-foreground">Contas Cognito, acesso às lojas e situação da equipe</p></div>
      <button type="button" onClick={abrirNovo} disabled={!lojas.length || salvando}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Plus className="size-4" /> Novo funcionário</button>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Funcionários" value={String(vendedores.length)} icon={UserRound} tone="brand" />
      <StatCard label="Acessos ativos" value={String(ativos)} icon={UserCheck} tone="success" />
      <StatCard label="Acesso às duas lojas" value={String(ambas)} icon={Store} />
      <StatCard label="Vínculos ativos" value={String(totalVinculos)} icon={ShieldCheck} />
    </div>

    <SectionCard title="Equipe cadastrada" description="Login, situação e lojas liberadas" padded={false}>
      {carregando && <p className="p-5 text-sm text-muted-foreground">Carregando funcionários…</p>}
      {erro && <p role="alert" className="p-5 text-sm text-destructive">{erro}</p>}
      {!carregando && !erro && funcionarios.length === 0 && <div className="px-5 py-12 text-center">
        <UserRound className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nenhum funcionário cadastrado</p></div>}
      <div className="divide-y divide-border">{funcionarios.map((funcionario) => (
        <article key={funcionario.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{funcionario.nome}</h3>
              <Chip tone={funcionario.ativo ? "success" : "warning"}>{funcionario.ativo ? "ativo" : "bloqueado"}</Chip>
              {funcionario.perfil === "administrador" && <Chip tone="muted">administrador protegido</Chip>}</div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{funcionario.email || "E-mail não registrado"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{funcionario.lojas.filter((loja) => loja.ativo).map((loja) =>
              <Chip key={loja.id} tone="brand">{loja.nome}</Chip>)}</div>
          </div>
          {funcionario.perfil === "vendedor" && <div className="flex flex-wrap gap-2">
            <button type="button" disabled={salvando} onClick={() => abrirEdicao(funcionario)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-50">
              <Pencil className="size-3.5" /> Editar</button>
            <button type="button" disabled={salvando} onClick={() => void executar(funcionario, "reenviar_convite")}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-50">
              <KeyRound className="size-3.5" /> Reenviar convite</button>
            <button type="button" disabled={salvando} onClick={() => void executar(funcionario, funcionario.ativo ? "bloquear" : "ativar")}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-50">
              {funcionario.ativo ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
              {funcionario.ativo ? "Bloquear" : "Ativar"}</button>
          </div>}
        </article>
      ))}</div>
    </SectionCard>

    <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>
        {editando === "novo" ? "Novo funcionário" : "Editar funcionário"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <Field label="Nome"><input className={fieldCls} maxLength={120} autoComplete="off"
            value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} /></Field>
          <Field label="E-mail"><input className={fieldCls} type="email" maxLength={254} autoComplete="off"
            value={formulario.email} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} /></Field>
          <fieldset><legend className="eyebrow mb-2">Lojas liberadas</legend>
            <div className="grid gap-2 sm:grid-cols-2">{lojas.map((loja) => <label key={loja.id}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
              <input type="checkbox" checked={formulario.lojas.includes(loja.id)} onChange={() => alternarLoja(loja.id)} />
              {loja.nome}</label>)}</div></fieldset>
          {editando === "novo" && <p className="text-xs text-muted-foreground">
            O Cognito enviará o convite e a senha temporária diretamente ao e-mail. Nenhuma senha é armazenada no PH.</p>}
        </div><DialogFooter><button type="button" className="h-10 rounded-xl border border-border px-4 text-sm"
          onClick={() => setEditando(null)}>Cancelar</button>
          <button type="button" disabled={salvando || !formulario.nome.trim() || !formulario.email.trim() || !formulario.lojas.length}
            onClick={() => void salvar()} className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {salvando ? "Salvando…" : editando === "novo" ? "Criar e enviar convite" : "Salvar alterações"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
