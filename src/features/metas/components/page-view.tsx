"use client";

import { CalendarDays, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Chip, SectionCard } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";

type Meta = {
  id: string; lojaNome: string; nome: string; alvoCentavos: string;
  realizadoCentavos: string; inicioData: string; fimData: string;
  quantidadeVendas: number;
};

function dinheiro(centavos: string) {
  const valor = BigInt(centavos || "0");
  const reais = valor / 100n;
  const resto = (valor % 100n).toString().padStart(2, "0");
  return `R$ ${reais.toLocaleString("pt-BR")},${resto}`;
}

function percentual(meta: Meta) {
  const alvo = BigInt(meta.alvoCentavos);
  return alvo > 0n ? Number((BigInt(meta.realizadoCentavos) * 100n) / alvo) : 0;
}

export default function MeuDesempenho() {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/metas", { cache: "no-store", credentials: "same-origin" })
      .then(async (resposta) => {
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível carregar suas metas.");
        setMetas(dados.metas ?? []);
      })
      .catch((falha) => setErro(falha instanceof Error ? falha.message : "Falha ao carregar."))
      .finally(() => setCarregando(false));
  }, []);

  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const ativas = metas.filter((meta) => meta.inicioData <= hoje && meta.fimData >= hoje);
  const atingidas = metas.filter((meta) => percentual(meta) >= 100);
  const encerradas = metas.filter((meta) => meta.fimData < hoje);

  return (
    <AppShell title="Meu desempenho" subtitle="Acompanhe suas metas e vendas atribuídas em cada loja">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Metas cadastradas" value={String(metas.length)} icon={Target} tone="brand" />
        <StatCard label="Metas em andamento" value={String(ativas.length)} icon={CalendarDays} />
        <StatCard label="Metas alcançadas" value={String(atingidas.length)} icon={TrendingUp} tone="success" />
        <StatCard label="Períodos encerrados" value={String(encerradas.length)} icon={CalendarDays} />
      </div>

      <SectionCard title="Minhas metas" description="Cada meta usa somente suas vendas na loja e no período indicados" padded={false}>
        {carregando && <p className="p-5 text-sm text-muted-foreground">Carregando metas…</p>}
        {erro && <p role="alert" className="p-5 text-sm text-destructive">{erro}</p>}
        {!carregando && !erro && metas.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Target className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma meta atribuída</p>
            <p className="mt-1 text-xs text-muted-foreground">O administrador ainda não definiu uma meta para você.</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {metas.map((meta) => {
            const progresso = percentual(meta);
            return (
              <article key={meta.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{meta.nome}</h2>
                      <Chip tone="muted">{meta.lojaNome}</Chip>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meta.inicioData.split("-").reverse().join("/")} a {meta.fimData.split("-").reverse().join("/")} · {meta.quantidadeVendas} vendas
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold tabular-nums">{progresso}%</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${progresso >= 100 ? "bg-success" : "bg-brand"}`}
                    style={{ width: `${Math.min(100, progresso)}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-medium">{dinheiro(meta.realizadoCentavos)} realizados</span>
                  <span className="text-muted-foreground">Alvo {dinheiro(meta.alvoCentavos)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </AppShell>
  );
}
