"use client";

import { CalendarDays, History, Pencil, Plus, Target, TrendingUp, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Meta = {
  id: string; lojaId: string; lojaNome: string; vendedorUsuarioId: string;
  vendedorNome: string; nome: string; alvoCentavos: string; realizadoCentavos: string;
  inicioData: string; fimData: string; versao: number; quantidadeVendas: number;
};
type Responsavel = { id: string; nome: string; perfil: string; lojaId: string; lojaNome: string };
type Revisao = { versao: number; nome: string; alvoCentavos: string; inicioData: string;
  fimData: string; tipoAlteracao: string; alteradaEm: string; autor: string };
type Formulario = { nome: string; alvo: string; inicioData: string; fimData: string;
  responsavelLoja: string };

const vazio: Formulario = { nome: "", alvo: "", inicioData: "", fimData: "", responsavelLoja: "" };

function dinheiro(centavos: string) {
  const valor = BigInt(centavos || "0");
  return `R$ ${(valor / 100n).toLocaleString("pt-BR")},${(valor % 100n).toString().padStart(2, "0")}`;
}
function paraCentavos(valor: string) {
  const normalizado = valor.trim().replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(normalizado)) throw new Error("Informe um alvo monetário válido.");
  const [reais, centavos = ""] = normalizado.split(".");
  return (BigInt(reais!) * 100n + BigInt(centavos.padEnd(2, "0"))).toString();
}
const porcentagem = (meta: Meta) => Number((BigInt(meta.realizadoCentavos) * 100n) / BigInt(meta.alvoCentavos));

export default function MetasEquipe() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Meta | "nova" | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(vazio);
  const [idCriacao, setIdCriacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<{ meta: Meta; revisoes: Revisao[] } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const resposta = await fetch("/api/metas", { cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar as metas.");
      setMetas(dados.metas ?? []); setResponsaveis(dados.responsaveis ?? []);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Falha ao carregar."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrirNova = () => {
    setFormulario({ ...vazio, responsavelLoja: responsaveis[0]
      ? `${responsaveis[0].id}|${responsaveis[0].lojaId}` : "" });
    setIdCriacao(crypto.randomUUID()); setEditando("nova");
  };
  const abrirEdicao = (meta: Meta) => {
    setFormulario({ nome: meta.nome,
      alvo: `${BigInt(meta.alvoCentavos) / 100n}.${(BigInt(meta.alvoCentavos) % 100n).toString().padStart(2, "0")}`,
      inicioData: meta.inicioData, fimData: meta.fimData,
      responsavelLoja: `${meta.vendedorUsuarioId}|${meta.lojaId}` });
    setEditando(meta);
  };
  const salvar = async () => {
    try {
      setSalvando(true);
      const [vendedorUsuarioId, lojaId] = formulario.responsavelLoja.split("|");
      const nova = editando === "nova";
      const body = nova
        ? { id: idCriacao, vendedorUsuarioId, lojaId, nome: formulario.nome,
          alvoCentavos: paraCentavos(formulario.alvo), inicioData: formulario.inicioData, fimData: formulario.fimData }
        : { id: editando?.id, versaoEsperada: editando?.versao, nome: formulario.nome,
          alvoCentavos: paraCentavos(formulario.alvo), inicioData: formulario.inicioData, fimData: formulario.fimData };
      const resposta = await fetch("/api/metas", { method: nova ? "POST" : "PATCH",
        credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível salvar a meta.");
      toast.success(nova ? "Meta criada." : "Meta atualizada.");
      setEditando(null); await carregar();
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha ao salvar."); }
    finally { setSalvando(false); }
  };
  const abrirHistorico = async (meta: Meta) => {
    try {
      const resposta = await fetch(`/api/metas?historicoMetaId=${encodeURIComponent(meta.id)}`,
        { cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar o histórico.");
      setHistorico({ meta, revisoes: dados.historico ?? [] });
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha ao carregar."); }
  };

  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const ativas = metas.filter((meta) => meta.inicioData <= hoje && meta.fimData >= hoje).length;
  const atingidas = metas.filter((meta) => porcentagem(meta) >= 100).length;
  const pessoas = useMemo(() => new Set(metas.map((meta) => meta.vendedorUsuarioId)).size, [metas]);

  return (
    <AppShell title="Metas da equipe" subtitle="Crie metas por responsável e loja, com períodos livres e histórico"
      actions={<button type="button" onClick={abrirNova} disabled={!responsaveis.length}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Plus className="size-4" /> Nova meta</button>}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Metas cadastradas" value={String(metas.length)} icon={Target} tone="brand" />
        <StatCard label="Em andamento" value={String(ativas)} icon={CalendarDays} />
        <StatCard label="Alcançadas" value={String(atingidas)} icon={TrendingUp} tone="success" />
        <StatCard label="Responsáveis com meta" value={String(pessoas)} icon={Users} />
      </div>
      <SectionCard title="Metas cadastradas" description="Metas sobrepostas são acompanhadas de forma independente" padded={false}>
        {carregando && <p className="p-5 text-sm text-muted-foreground">Carregando metas…</p>}
        {erro && <p role="alert" className="p-5 text-sm text-destructive">{erro}</p>}
        {!carregando && !erro && metas.length === 0 && <div className="px-5 py-12 text-center">
          <Target className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Nenhuma meta cadastrada</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie a primeira meta para um responsável ativo.</p></div>}
        <div className="divide-y divide-border">{metas.map((meta) => {
          const progresso = porcentagem(meta);
          return <article key={meta.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{meta.nome}</h2>
              <Chip tone="muted">{meta.lojaNome}</Chip><Chip tone={progresso >= 100 ? "success" : "brand"}>{progresso}%</Chip></div>
              <p className="mt-1 text-xs text-muted-foreground">{meta.vendedorNome} · {meta.inicioData.split("-").reverse().join("/")} a {meta.fimData.split("-").reverse().join("/")}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${progresso >= 100 ? "bg-success" : "bg-brand"}`}
                style={{ width: `${Math.min(100, progresso)}%` }} /></div>
              <p className="mt-2 text-xs"><strong>{dinheiro(meta.realizadoCentavos)}</strong> de {dinheiro(meta.alvoCentavos)} · {meta.quantidadeVendas} vendas</p>
            </div><div className="flex gap-2"><button type="button" onClick={() => void abrirHistorico(meta)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium"><History className="size-3.5" /> Histórico</button>
              <button type="button" onClick={() => abrirEdicao(meta)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium">
                <Pencil className="size-3.5" /> Editar</button></div></div></article>;
        })}</div>
      </SectionCard>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editando === "nova" ? "Nova meta" : "Editar meta"}</DialogTitle></DialogHeader>
          <div className="grid gap-4"><Field label="Responsável e loja"><select className={fieldCls} disabled={editando !== "nova"}
            value={formulario.responsavelLoja} onChange={(e) => setFormulario({ ...formulario, responsavelLoja: e.target.value })}>
            {responsaveis.map((item) => <option key={`${item.id}|${item.lojaId}`} value={`${item.id}|${item.lojaId}`}>{item.nome} · {item.lojaNome}</option>)}</select></Field>
            <Field label="Nome da meta"><input className={fieldCls} maxLength={120} value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} /></Field>
            <Field label="Alvo (R$)"><input className={fieldCls} inputMode="decimal" placeholder="10000,00" value={formulario.alvo} onChange={(e) => setFormulario({ ...formulario, alvo: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Início"><input type="date" className={fieldCls} value={formulario.inicioData} onChange={(e) => setFormulario({ ...formulario, inicioData: e.target.value })} /></Field>
              <Field label="Fim"><input type="date" className={fieldCls} value={formulario.fimData} onChange={(e) => setFormulario({ ...formulario, fimData: e.target.value })} /></Field></div>
          </div><DialogFooter><button type="button" className="h-10 rounded-xl border border-border px-4 text-sm" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="button" disabled={salvando || !formulario.responsavelLoja} onClick={() => void salvar()}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{salvando ? "Salvando…" : "Salvar meta"}</button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historico !== null} onOpenChange={(aberto) => !aberto && setHistorico(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Histórico da meta</DialogTitle></DialogHeader>
          <div className="divide-y divide-border">{historico?.revisoes.map((revisao) => <article key={revisao.versao} className="py-3">
            <div className="flex justify-between gap-3"><p className="text-sm font-semibold">Versão {revisao.versao} · {revisao.nome}</p><Chip tone="muted">{revisao.tipoAlteracao}</Chip></div>
            <p className="mt-1 text-xs text-muted-foreground">{dinheiro(revisao.alvoCentavos)} · {revisao.inicioData.split("-").reverse().join("/")} a {revisao.fimData.split("-").reverse().join("/")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{revisao.autor} · {new Date(revisao.alteradaEm).toLocaleString("pt-BR")}</p>
          </article>)}</div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
