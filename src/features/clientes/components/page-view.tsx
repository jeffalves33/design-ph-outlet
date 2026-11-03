"use client";

import { Cake, Heart, LoaderCircle, Search, Star, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Loja = { id: string; nome: string };
type VendaCliente = { id: string; totalCentavos: string; realizadaEm: string;
  lojaNome: string; itens: string };
type Cliente = {
  id: string; nome: string; whatsappDigitos: string; dataNascimento: string | null;
  cidade: string | null; lojaPreferidaId: string | null; lojaPreferidaNome: string | null;
  observacao: string | null; criadaEm: string; vendas: VendaCliente[];
  quantidadeCompras: number; totalCentavos: string;
};

function dinheiro(centavos: string | bigint) {
  const valor = typeof centavos === "bigint" ? centavos : BigInt(centavos || "0");
  return `R$ ${(valor / 100n).toLocaleString("pt-BR")},${(valor % 100n).toString().padStart(2, "0")}`;
}
function dataCurta(valor: string) { return valor.slice(0, 10).split("-").reverse().join("/"); }
function diasParaAniversario(nascimento: string | null) {
  if (!nascimento) return null;
  const hojeTexto = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const hoje = new Date(`${hojeTexto}T00:00:00Z`);
  const [, mes, dia] = nascimento.split("-").map(Number);
  let proximo = new Date(Date.UTC(hoje.getUTCFullYear(), (mes ?? 1) - 1, dia ?? 1));
  if (proximo < hoje) proximo = new Date(Date.UTC(hoje.getUTCFullYear() + 1, (mes ?? 1) - 1, dia ?? 1));
  return Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
}

export default function CRM() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const resposta = await fetch("/api/clientes", { cache: "no-store", credentials: "same-origin" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar os clientes.");
      setClientes(dados.clientes ?? []); setLojas(dados.lojas ?? []);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Falha ao carregar clientes."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((cliente) => !termo || cliente.nome.toLowerCase().includes(termo) ||
      cliente.whatsappDigitos.includes(termo.replace(/\D/g, "")) ||
      (cliente.cidade ?? "").toLowerCase().includes(termo));
  }, [busca, clientes]);
  const aniversariantes = clientes.map((cliente) => ({ cliente, dias: diasParaAniversario(cliente.dataNascimento) }))
    .filter((item): item is { cliente: Cliente; dias: number } => item.dias !== null && item.dias <= 30)
    .sort((a, b) => a.dias - b.dias);
  const melhores = [...clientes].sort((a, b) => Number(BigInt(b.totalCentavos) - BigInt(a.totalCentavos))).slice(0, 5);
  const receita = clientes.reduce((soma, cliente) => soma + BigInt(cliente.totalCentavos), 0n);
  const compras = clientes.reduce((soma, cliente) => soma + cliente.quantidadeCompras, 0);
  const detalhe = clientes.find((cliente) => cliente.id === selecionado) ?? null;

  return <AppShell title="CRM de clientes" subtitle="Histórico de consumo, aniversários e oportunidades de contato"
    actions={<NovoCliente lojas={lojas} aoSalvar={carregar} />}>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Clientes cadastrados" value={String(clientes.length)} icon={Users} tone="brand" />
      <StatCard label="Receita identificada" value={dinheiro(receita)} hint="Vendas vinculadas a clientes" icon={Heart} tone="success" />
      <StatCard label="Ticket médio" value={dinheiro(compras ? receita / BigInt(compras) : 0n)} icon={Star} />
      <StatCard label="Aniversários em 30 dias" value={String(aniversariantes.length)} icon={Cake} tone="warning" />
    </div>

    <Tabs defaultValue="carteira">
      <TabsList className="w-full sm:w-auto"><TabsTrigger value="carteira" className="flex-1 sm:flex-none">Carteira</TabsTrigger>
        <TabsTrigger value="oportunidades" className="flex-1 sm:flex-none">Oportunidades</TabsTrigger></TabsList>
      <TabsContent value="carteira" className="mt-4">
        <SectionCard title="Carteira de clientes" description={`${lista.length} clientes`} padded={false}>
          <div className="border-b border-border p-4 sm:px-5"><div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, WhatsApp ou cidade" className={`${fieldCls} pl-9`} />
          </div></div>
          {carregando && <p className="p-5 text-sm text-muted-foreground">Carregando clientes…</p>}
          {erro && <p role="alert" className="p-5 text-sm text-destructive">{erro}</p>}
          {!carregando && !erro && <ul className="divide-y divide-border">{lista.map((cliente) => <li key={cliente.id}>
            <button type="button" onClick={() => setSelecionado(cliente.id)} className="w-full px-4 py-3.5 text-left transition-colors hover:bg-secondary/60 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0">
                <p className="truncate text-sm font-medium">{cliente.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{cliente.whatsappDigitos}{cliente.cidade ? ` · ${cliente.cidade}` : ""}{cliente.lojaPreferidaNome ? ` · ${cliente.lojaPreferidaNome}` : ""}</p>
              </div><div className="flex items-center gap-2"><Chip tone="muted">{cliente.quantidadeCompras} compras</Chip>
                <span className="text-sm font-semibold tabular-nums">{dinheiro(cliente.totalCentavos)}</span></div></div>
            </button></li>)}
            {!lista.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</li>}
          </ul>}
        </SectionCard>
      </TabsContent>
      <TabsContent value="oportunidades" className="mt-4"><div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Aniversários próximos" description="Próximos 30 dias" padded={false}>
          <ul className="divide-y divide-border">{aniversariantes.map(({ cliente, dias }) => <li key={cliente.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Cake className="size-4 text-brand" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{cliente.nome}</p>
              <p className="text-xs text-muted-foreground">{cliente.dataNascimento ? dataCurta(cliente.dataNascimento) : "—"} · {cliente.whatsappDigitos}</p></div>
            <Chip tone={dias <= 7 ? "brand" : "muted"}>{dias === 0 ? "hoje" : `em ${dias} dias`}</Chip></li>)}
            {!aniversariantes.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum aniversário nos próximos 30 dias.</li>}
          </ul></SectionCard>
        <SectionCard title="Melhores clientes" description="Maior valor acumulado"><ul className="space-y-3">{melhores.map((cliente, indice) => <li key={cliente.id} className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-xs font-semibold">{indice + 1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{cliente.nome}</span><span className="text-xs text-muted-foreground">{cliente.quantidadeCompras} compras</span></span>
          <span className="text-sm font-semibold tabular-nums">{dinheiro(cliente.totalCentavos)}</span></li>)}</ul></SectionCard>
      </div></TabsContent>
    </Tabs>

    <Dialog open={detalhe !== null} onOpenChange={(aberto) => !aberto && setSelecionado(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">{detalhe && <><DialogHeader><DialogTitle>{detalhe.nome}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-secondary p-3"><p className="eyebrow">Total consumido</p><p className="mt-1 font-semibold">{dinheiro(detalhe.totalCentavos)}</p></div>
          <div className="rounded-xl bg-secondary p-3"><p className="eyebrow">Compras</p><p className="mt-1 font-semibold">{detalhe.quantidadeCompras}</p></div></div>
        <p className="text-xs text-muted-foreground">{detalhe.whatsappDigitos}{detalhe.cidade ? ` · ${detalhe.cidade}` : ""}{detalhe.observacao ? ` · ${detalhe.observacao}` : ""}</p>
        <div><p className="eyebrow mb-2">Histórico de consumo</p><ul className="divide-y divide-border rounded-xl border border-border">
          {detalhe.vendas.map((venda) => <li key={venda.id} className="p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{new Date(venda.realizadaEm).toLocaleString("pt-BR")}</p><p className="truncate text-xs text-muted-foreground">{venda.lojaNome} · {venda.itens}</p></div><p className="text-sm font-semibold">{dinheiro(venda.totalCentavos)}</p></div></li>)}
          {!detalhe.vendas.length && <li className="p-4 text-center text-sm text-muted-foreground">Ainda sem compras vinculadas.</li>}
        </ul></div></>}
      </DialogContent>
    </Dialog>
  </AppShell>;
}

function NovoCliente({ lojas, aoSalvar }: { lojas: Loja[]; aoSalvar: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [id, setId] = useState("");
  const [formulario, setFormulario] = useState({ nome: "", whatsapp: "", dataNascimento: "",
    cidade: "", lojaPreferidaId: "", observacao: "" });
  const abrir = (aberto: boolean) => { setOpen(aberto); if (aberto && !id) setId(crypto.randomUUID()); };
  const salvar = async () => {
    try {
      setSalvando(true);
      const resposta = await fetch("/api/clientes", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...formulario }) });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível cadastrar o cliente.");
      toast.success("Cliente cadastrado."); setOpen(false); setId("");
      setFormulario({ nome: "", whatsapp: "", dataNascimento: "", cidade: "", lojaPreferidaId: "", observacao: "" });
      await aoSalvar();
    } catch (falha) { toast.error(falha instanceof Error ? falha.message : "Falha ao cadastrar."); }
    finally { setSalvando(false); }
  };
  return <Dialog open={open} onOpenChange={abrir}><DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
    <UserPlus className="size-4" /> Novo cliente</DialogTrigger><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" className="sm:col-span-2"><input className={fieldCls} maxLength={160} value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} /></Field>
        <Field label="WhatsApp"><input className={fieldCls} inputMode="tel" value={formulario.whatsapp} onChange={(e) => setFormulario({ ...formulario, whatsapp: e.target.value })} /></Field>
        <Field label="Nascimento (opcional)"><input type="date" className={fieldCls} value={formulario.dataNascimento} onChange={(e) => setFormulario({ ...formulario, dataNascimento: e.target.value })} /></Field>
        <Field label="Cidade (opcional)"><input className={fieldCls} maxLength={120} value={formulario.cidade} onChange={(e) => setFormulario({ ...formulario, cidade: e.target.value })} /></Field>
        <Field label="Loja preferida (opcional)"><select className={fieldCls} value={formulario.lojaPreferidaId} onChange={(e) => setFormulario({ ...formulario, lojaPreferidaId: e.target.value })}><option value="">Nenhuma</option>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}</select></Field>
        <Field label="Observação (opcional)" className="sm:col-span-2"><textarea className={`${fieldCls} min-h-20 py-2`} maxLength={1000} value={formulario.observacao} onChange={(e) => setFormulario({ ...formulario, observacao: e.target.value })} /></Field></div>
      <DialogFooter><button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {salvando && <LoaderCircle className="size-4 animate-spin" />}{salvando ? "Salvando…" : "Cadastrar"}</button></DialogFooter>
    </DialogContent></Dialog>;
}
