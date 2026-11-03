"use client";

import { ArrowDownRight, ArrowUpRight, LoaderCircle, Percent, Plus, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger } from "@/components/ui/dialog";
import { useWorkspace } from "@/features/workspace/contexto";

type Loja = { id: string; nome: string };
type Venda = { id: string; lojaId: string; lojaNome: string; totalCentavos: string;
  realizadaEm: string; clienteNome: string | null };
type Despesa = { id: string; lojaId: string; lojaNome: string; descricao: string;
  categoria: Categoria; valorCentavos: string; dataDespesa: string; criadaEm: string };
type Categoria = "fornecedores" | "aluguel" | "folha" | "marketing" | "operacional";
const CATEGORIAS: { id: Categoria; nome: string }[] = [
  { id: "fornecedores", nome: "Fornecedores" }, { id: "aluguel", nome: "Aluguel" },
  { id: "folha", nome: "Folha" }, { id: "marketing", nome: "Marketing" },
  { id: "operacional", nome: "Operacional" },
];
function dinheiro(valor: bigint | string) {
  const centavos = typeof valor === "bigint" ? valor : BigInt(valor || "0");
  const negativo = centavos < 0n; const absoluto = negativo ? -centavos : centavos;
  return `${negativo ? "− " : ""}R$ ${(absoluto / 100n).toLocaleString("pt-BR")},${(absoluto % 100n).toString().padStart(2, "0")}`;
}
function hojeCivil() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()); }
function periodoMes(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano!, numero!, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}
function rotuloCategoria(categoria: Categoria) { return CATEGORIAS.find((item) => item.id === categoria)?.nome ?? categoria; }

export default function Financeiro() {
  const { escopo } = useWorkspace();
  const [mes, setMes] = useState(hojeCivil().slice(0, 7));
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const periodo = periodoMes(mes);
      const parametros = new URLSearchParams(periodo);
      const resposta = await fetch(`/api/financeiro?${parametros}`, { cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar o financeiro.");
      setLojas(dados.lojas ?? []); setVendas(dados.vendas ?? []); setDespesas(dados.despesas ?? []);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Falha ao carregar o financeiro."); }
    finally { setCarregando(false); }
  }, [mes]);
  useEffect(() => { void carregar(); }, [carregar]);

  const lojaEscopo = escopo === "todas" ? null : escopo;
  const lojaSelecionada = lojas.find((loja) => loja.id === lojaEscopo) ?? null;
  const vendasEscopo = lojaEscopo ? vendas.filter((item) => item.lojaId === lojaEscopo) : vendas;
  const despesasEscopo = lojaEscopo ? despesas.filter((item) => item.lojaId === lojaEscopo) : despesas;
  const receita = vendasEscopo.reduce((soma, item) => soma + BigInt(item.totalCentavos), 0n);
  const custo = despesasEscopo.reduce((soma, item) => soma + BigInt(item.valorCentavos), 0n);
  const resultado = receita - custo;
  const margem = receita ? Number((resultado * 1000n) / receita) / 10 : 0;
  const comparativo = lojas.map((loja) => {
    const entrada = vendas.filter((item) => item.lojaId === loja.id).reduce((s, item) => s + BigInt(item.totalCentavos), 0n);
    const saida = despesas.filter((item) => item.lojaId === loja.id).reduce((s, item) => s + BigInt(item.valorCentavos), 0n);
    return { ...loja, receita: entrada, despesas: saida, resultado: entrada - saida };
  });
  const porCategoria = CATEGORIAS.map((categoria) => ({ ...categoria,
    valor: despesasEscopo.filter((item) => item.categoria === categoria.id)
      .reduce((soma, item) => soma + BigInt(item.valorCentavos), 0n) })).filter((item) => item.valor > 0n);
  const maxCategoria = porCategoria.reduce((maximo, item) => item.valor > maximo ? item.valor : maximo, 1n);

  return <AppShell title="Relatório financeiro"
    subtitle={escopo === "todas" ? "Resultado consolidado das duas lojas" : "Resultado da loja selecionada"}
    actions={<><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={`${fieldCls} w-40`} aria-label="Selecionar mês" />
      <NovaDespesa loja={lojaSelecionada} aoSalvar={carregar} /></>}>
    {erro && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>}
    {carregando && <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">Carregando relatório…</p>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Receita do período" value={dinheiro(receita)} hint={`${vendasEscopo.length} vendas`} icon={ArrowUpRight} tone="success" />
      <StatCard label="Despesas do período" value={dinheiro(custo)} hint={`${despesasEscopo.length} lançamentos`} icon={ArrowDownRight} tone="danger" />
      <StatCard label="Resultado gerencial" value={dinheiro(resultado)} icon={Wallet} tone={resultado >= 0n ? "success" : "danger"} />
      <StatCard label="Margem" value={`${margem.toFixed(1)}%`} hint="Resultado sobre a receita" icon={Percent} tone="brand" />
    </div>

    <SectionCard title="Comparativo por loja" description={`Período ${mes.split("-").reverse().join("/")}`} padded={false}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">{comparativo.map((item) => <div key={item.id} className="rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-2"><p className="truncate font-display text-sm font-semibold">{item.nome}</p>
          <Chip tone={item.resultado >= 0n ? "success" : "danger"}>{item.resultado >= 0n ? "resultado" : "déficit"} {dinheiro(item.resultado < 0n ? -item.resultado : item.resultado)}</Chip></div>
        <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">Receita</dt><dd className="font-medium">{dinheiro(item.receita)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Despesas</dt><dd className="font-medium">{dinheiro(item.despesas)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Margem</dt><dd className="font-medium">{item.receita ? (Number((item.resultado * 1000n) / item.receita) / 10).toFixed(1) : "0.0"}%</dd></div></dl>
      </div>)}</div>
    </SectionCard>

    <div className="grid gap-4 lg:grid-cols-2"><SectionCard title="Receita por loja"><div className="space-y-3">{comparativo.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.nome}</span><strong>{dinheiro(item.receita)}</strong></div>)}</div></SectionCard>
      <SectionCard title="Despesas por categoria"><div className="space-y-3">{porCategoria.map((item) => <div key={item.id} className="grid grid-cols-[6rem_minmax(0,1fr)_6rem] items-center gap-3"><span className="truncate text-xs text-muted-foreground">{item.nome}</span>
        <span className="h-2.5 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-destructive/70" style={{ width: `${Math.max(3, Number((item.valor * 100n) / maxCategoria))}%` }} /></span>
        <span className="text-right text-xs font-medium">{dinheiro(item.valor)}</span></div>)}{!porCategoria.length && <p className="text-sm text-muted-foreground">Sem despesas neste período.</p>}</div></SectionCard></div>

    <div className="grid gap-4 lg:grid-cols-2"><SectionCard title="Entradas" description="Vendas do período" padded={false}><ul className="divide-y divide-border">{vendasEscopo.map((venda) => <li key={venda.id} className="flex items-start gap-3 px-4 py-3 sm:px-5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{venda.clienteNome ?? "Venda sem identificação"}</p><p className="text-xs text-muted-foreground">{new Date(venda.realizadaEm).toLocaleString("pt-BR")} · {venda.lojaNome}</p></div><p className="text-sm font-semibold text-success">+{dinheiro(venda.totalCentavos)}</p></li>)}
      {!vendasEscopo.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma venda neste período.</li>}</ul></SectionCard>
      <SectionCard title="Saídas" description="Despesas lançadas" padded={false}><ul className="divide-y divide-border">{despesasEscopo.map((despesa) => <li key={despesa.id} className="flex items-start gap-3 px-4 py-3 sm:px-5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{despesa.descricao}</p><p className="text-xs text-muted-foreground">{despesa.dataDespesa.split("-").reverse().join("/")} · {despesa.lojaNome} · {rotuloCategoria(despesa.categoria)}</p></div><p className="text-sm font-semibold text-destructive">−{dinheiro(despesa.valorCentavos)}</p></li>)}
        {!despesasEscopo.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhuma despesa neste período.</li>}</ul></SectionCard></div>
    <p className="text-xs text-muted-foreground">Relatório gerencial derivado de vendas e despesas registradas; não representa caixa, recebimento ou resultado fiscal.</p>
  </AppShell>;
}

function paraCentavos(valor: string) {
  const normalizado = valor.trim().replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(normalizado)) throw new Error("Informe um valor monetário válido.");
  const [reais, centavos = ""] = normalizado.split(".");
  const total = BigInt(reais!) * 100n + BigInt(centavos.padEnd(2, "0"));
  if (total <= 0n) throw new Error("Informe um valor positivo.");
  return total.toString();
}
function NovaDespesa({ loja, aoSalvar }: { loja: Loja | null; aoSalvar: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [salvando, setSalvando] = useState(false); const [id, setId] = useState("");
  const [formulario, setFormulario] = useState({ descricao: "", valor: "", dataDespesa: hojeCivil(), categoria: "fornecedores" as Categoria });
  const abrir = (aberto: boolean) => { setOpen(aberto); if (aberto && !id) setId(crypto.randomUUID()); };
  const salvar = async () => { try { setSalvando(true); const resposta = await fetch("/api/financeiro", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lojaId: loja?.id, descricao: formulario.descricao, categoria: formulario.categoria, valorCentavos: paraCentavos(formulario.valor), dataDespesa: formulario.dataDespesa }) });
    const dados = await resposta.json(); if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível lançar a despesa.");
    toast.success("Despesa lançada."); setOpen(false); setId(""); setFormulario({ descricao: "", valor: "", dataDespesa: hojeCivil(), categoria: "fornecedores" }); await aoSalvar();
  } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha ao lançar despesa."); } finally { setSalvando(false); } };
  return <Dialog open={open} onOpenChange={abrir}><DialogTrigger disabled={!loja} title={loja ? undefined : "Selecione uma loja no cabeçalho"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> Nova despesa</DialogTrigger>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Lançar despesa</DialogTitle></DialogHeader><div className="grid gap-3"><Field label="Descrição"><input className={fieldCls} maxLength={200} value={formulario.descricao} onChange={(e) => setFormulario({ ...formulario, descricao: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Valor (R$)"><input className={fieldCls} inputMode="decimal" placeholder="0,00" value={formulario.valor} onChange={(e) => setFormulario({ ...formulario, valor: e.target.value })} /></Field>
        <Field label="Data"><input type="date" className={fieldCls} value={formulario.dataDespesa} onChange={(e) => setFormulario({ ...formulario, dataDespesa: e.target.value })} /></Field>
        <Field label="Categoria"><select className={fieldCls} value={formulario.categoria} onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value as Categoria })}>{CATEGORIAS.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Loja"><div className={`${fieldCls} flex items-center bg-secondary/50`}>{loja?.nome ?? "Selecione no cabeçalho"}</div></Field></div></div>
      <DialogFooter><button type="button" disabled={salvando || !loja} onClick={() => void salvar()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{salvando && <LoaderCircle className="size-4 animate-spin" />}{salvando ? "Salvando…" : "Lançar despesa"}</button></DialogFooter>
    </DialogContent></Dialog>;
}
