"use client";

import Link from "next/link";
import { AlertTriangle, Cake, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Chip, SectionCard } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { useWorkspace } from "@/features/workspace/contexto";

type Venda = { id: string; lojaId: string; lojaNome: string; totalCentavos: string;
  realizadaEm: string; clienteNome: string | null };
type Despesa = { id: string; lojaId: string; valorCentavos: string; dataDespesa: string };
type Categoria = { id: string; loja_id: string; loja_nome: string; codigo: number; nome: string;
  tamanho: string; quantidade: string };
type Cliente = { id: string; nome: string; dataNascimento: string | null };

function hojeCivil() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()); }
function dinheiro(valor: bigint | string) {
  const centavos = typeof valor === "bigint" ? valor : BigInt(valor || "0");
  const negativo = centavos < 0n; const absoluto = negativo ? -centavos : centavos;
  return `${negativo ? "− " : ""}R$ ${(absoluto / 100n).toLocaleString("pt-BR")},${(absoluto % 100n).toString().padStart(2, "0")}`;
}
function diasParaAniversario(nascimento: string) {
  const hoje = new Date(`${hojeCivil()}T00:00:00Z`); const [, mes, dia] = nascimento.split("-").map(Number);
  let proximo = new Date(Date.UTC(hoje.getUTCFullYear(), (mes ?? 1) - 1, dia ?? 1));
  if (proximo < hoje) proximo = new Date(Date.UTC(hoje.getUTCFullYear() + 1, (mes ?? 1) - 1, dia ?? 1));
  return Math.round((proximo.getTime() - hoje.getTime()) / 86_400_000);
}
function inicioJanela() {
  const [ano, mes] = hojeCivil().slice(0, 7).split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 3, 1));
  return data.toISOString().slice(0, 10);
}
const rotuloMes = (mes: string) => `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;

export default function Painel() {
  const { escopo, lojas } = useWorkspace();
  const [vendas, setVendas] = useState<Venda[]>([]); const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]); const [clientes, setClientes] = useState<Cliente[]>([]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let ativo = true; const parametros = new URLSearchParams({ inicio: inicioJanela(), fim: hojeCivil() });
    Promise.all([
      fetch(`/api/financeiro?${parametros}`, { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/catalogo", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/clientes", { cache: "no-store", credentials: "same-origin" }),
    ]).then(async ([financeiro, catalogo, crm]) => {
      if (!financeiro.ok || !catalogo.ok || !crm.ok) throw new Error();
      const [dadosFinanceiro, dadosCatalogo, dadosCrm] = await Promise.all([financeiro.json(), catalogo.json(), crm.json()]);
      if (!ativo) return;
      setVendas(dadosFinanceiro.vendas ?? []); setDespesas(dadosFinanceiro.despesas ?? []);
      setCategorias(dadosCatalogo.categorias ?? []); setClientes(dadosCrm.clientes ?? []); setErro("");
    }).catch(() => { if (ativo) setErro("Não foi possível carregar todos os indicadores."); });
    return () => { ativo = false; };
  }, []);

  const filtrarLoja = <T extends { lojaId: string }>(itens: T[]) => escopo === "todas" ? itens : itens.filter((item) => item.lojaId === escopo);
  const vendasVisiveis = filtrarLoja(vendas); const despesasVisiveis = filtrarLoja(despesas);
  const categoriasVisiveis = escopo === "todas" ? categorias : categorias.filter((item) => item.loja_id === escopo);
  const mesAtual = hojeCivil().slice(0, 7);
  const vendasMes = vendasVisiveis.filter((item) => item.realizadaEm.slice(0, 7) === mesAtual);
  const despesasMes = despesasVisiveis.filter((item) => item.dataDespesa.slice(0, 7) === mesAtual);
  const receita = vendasMes.reduce((soma, item) => soma + BigInt(item.totalCentavos), 0n);
  const custos = despesasMes.reduce((soma, item) => soma + BigInt(item.valorCentavos), 0n);
  const ticket = vendasMes.length ? receita / BigInt(vendasMes.length) : 0n;
  const semEstoque = categoriasVisiveis.filter((item) => BigInt(item.quantidade) === 0n);
  const meses = [...new Set(vendasVisiveis.map((item) => item.realizadaEm.slice(0, 7)))].sort();
  const porMes = meses.map((mes) => ({ mes, valor: vendasVisiveis.filter((item) => item.realizadaEm.slice(0, 7) === mes)
    .reduce((soma, item) => soma + BigInt(item.totalCentavos), 0n) }));
  const maxMes = porMes.reduce((maximo, item) => item.valor > maximo ? item.valor : maximo, 1n);
  const porLoja = lojas.map((loja) => ({ ...loja, receita: vendas.filter((item) => item.lojaId === loja.id && item.realizadaEm.slice(0, 7) === mesAtual)
    .reduce((soma, item) => soma + BigInt(item.totalCentavos), 0n) }));
  const maxLoja = porLoja.reduce((maximo, item) => item.receita > maximo ? item.receita : maximo, 1n);
  const aniversariantes = useMemo(() => clientes.filter((cliente) => cliente.dataNascimento)
    .map((cliente) => ({ cliente, dias: diasParaAniversario(cliente.dataNascimento!) }))
    .filter((item) => item.dias <= 30).sort((a, b) => a.dias - b.dias).slice(0, 4), [clientes]);
  const nomeEscopo = escopo === "todas" ? "Visão consolidada da PH Outlet e da PH Outlet Kids"
    : `Visão da loja ${lojas.find((loja) => loja.id === escopo)?.nome ?? "selecionada"}`;

  return <AppShell title="Painel de gestão" subtitle={nomeEscopo} actions={<><Link href="/vendas" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><ShoppingBag className="size-4" /> Nova venda</Link>
    <Link href="/financeiro" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium"><Receipt className="size-4" /> Relatório</Link></>}>
    {erro && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Faturamento do mês" value={dinheiro(receita)} hint={`${vendasMes.length} vendas registradas`} icon={Wallet} tone="brand" />
      <StatCard label="Resultado do mês" value={dinheiro(receita - custos)} hint={`Despesas ${dinheiro(custos)}`} icon={TrendingUp} tone={receita >= custos ? "success" : "danger"} />
      <StatCard label="Ticket médio" value={dinheiro(ticket)} icon={Receipt} />
      <StatCard label="Estoques zerados" value={String(semEstoque.length)} hint="Combinações sem peças" icon={AlertTriangle} tone={semEstoque.length ? "warning" : "success"} />
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SectionCard title="Faturamento por mês" description="Vendas realizadas no período"><div className="space-y-3">{porMes.map((item) => <div key={item.mes} className="grid grid-cols-[3.2rem_minmax(0,1fr)_6rem] items-center gap-3"><span className="text-xs text-muted-foreground">{rotuloMes(item.mes)}</span><span className="h-2.5 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-primary" style={{ width: `${Number((item.valor * 100n) / maxMes)}%` }} /></span><span className="text-right text-xs font-medium">{dinheiro(item.valor)}</span></div>)}
        {!porMes.length && <p className="py-8 text-sm text-muted-foreground">Nenhuma venda no período.</p>}</div></SectionCard>
      <SectionCard title="Desempenho por loja" description="Faturamento do mês corrente"><div className="space-y-4">{porLoja.map((loja) => <div key={loja.id}><div className="flex justify-between gap-2"><p className="truncate text-sm font-medium">{loja.nome}</p><p className="text-sm font-semibold">{dinheiro(loja.receita)}</p></div><span className="mt-2 block h-2.5 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-brand" style={{ width: `${Number((loja.receita * 100n) / maxLoja)}%` }} /></span></div>)}</div></SectionCard>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SectionCard title="Últimas vendas" description="Histórico persistido" padded={false}><ul className="divide-y divide-border">{vendasVisiveis.slice(0, 6).map((venda) => <li key={venda.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{venda.clienteNome ?? "Venda sem identificação"}</p><p className="text-xs text-muted-foreground">{new Date(venda.realizadaEm).toLocaleString("pt-BR")} · {venda.lojaNome}</p></div><p className="text-sm font-semibold">{dinheiro(venda.totalCentavos)}</p></li>)}{!vendasVisiveis.length && <li className="px-5 py-8 text-sm text-muted-foreground">Nenhuma venda no período.</li>}</ul></SectionCard>
      <div className="space-y-4"><SectionCard title="Estoque zerado" description="Combinações que precisam de atenção"><ul className="space-y-3">{semEstoque.slice(0, 5).map((item) => <li key={item.id} className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-secondary text-xs font-semibold">0</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.nome} · {item.tamanho}</span><span className="text-xs text-muted-foreground">{String(item.codigo).padStart(5, "0")} · {item.loja_nome}</span></span></li>)}{!semEstoque.length && <li className="text-sm text-muted-foreground">Nenhum estoque zerado.</li>}</ul></SectionCard>
        <SectionCard title="Relacionamento" description="Aniversários próximos" actions={<Link href="/clientes" className="text-xs font-medium text-brand hover:underline">Ver CRM</Link>}><ul className="space-y-3">{aniversariantes.map(({ cliente, dias }) => <li key={cliente.id} className="flex items-center gap-3"><Cake className="size-4 text-brand" /><span className="min-w-0 flex-1 truncate text-sm">{cliente.nome}</span><Chip tone={dias <= 7 ? "brand" : "muted"}>{dias === 0 ? "hoje" : `${dias} dias`}</Chip></li>)}{!aniversariantes.length && <li className="text-sm text-muted-foreground">Nenhum aniversário nos próximos 30 dias.</li>}</ul></SectionCard></div>
    </div>
  </AppShell>;
}
