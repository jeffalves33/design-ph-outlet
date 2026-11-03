"use client";

import {
  AlertTriangle, Barcode, Check, LoaderCircle, Minus, PackageCheck, Plus, ReceiptText,
  ScanLine, ShoppingBag, Trash2, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, SectionCard, fieldCls } from "@/components/form-bits";
import { ComprovanteDialog, type ComprovanteVenda } from "./comprovante-dialog";
import {
  adicionarNaSacola, definirQuantidade, ErroSacola, normalizarCodigoVenda,
  quantidadePecas, totalSacolaCentavos, type ItemSacola, type ProdutoVenda,
} from "../dominio/sacola";
import {
  CHAVE_VENDA_PENDENTE, itensDaSacola, lerVendaPendente, type VendaPendente,
} from "../dominio/venda";

type RespostaProduto = { produto?: ProdutoVenda; erro?: string };
type RespostaVenda = { venda?: { id: string; totalCentavos: string; repetida?: boolean }; erro?: string };
type VendaRecente = { id: string; totalCentavos: string; realizadaEm: string; responsavelNome: string };
type RespostaComprovante = { comprovante?: ComprovanteVenda; vendas?: VendaRecente[]; erro?: string };
type LojaVenda = Readonly<{ id: string; nome: string }>;
type VendedorVenda = Readonly<{ id: string; nome: string; lojaId: string }>;
type ClienteVenda = Readonly<{ id: string; nome: string; whatsappDigitos: string }>;

function brlCentavos(valor: bigint) {
  const negativo = valor < 0n;
  const absoluto = negativo ? -valor : valor;
  const reais = absoluto / 100n;
  const centavos = String(absoluto % 100n).padStart(2, "0");
  return `${negativo ? "− " : ""}R$ ${reais.toLocaleString("pt-BR")},${centavos}`;
}

function dataHoraCurta(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.valueOf()) ? "Data indisponível" : data.toLocaleString("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  });
}

export default function Vendas({ lojas, vendedores, usuarioId }: {
  lojas: readonly LojaVenda[];
  vendedores: readonly VendedorVenda[];
  usuarioId: string;
}) {
  const [lojaId, setLojaId] = useState(lojas[0]?.id ?? "");
  const [vendedorId, setVendedorId] = useState(
    vendedores.find((vendedor) => vendedor.lojaId === lojas[0]?.id)?.id ?? "",
  );
  const [clientes, setClientes] = useState<ClienteVenda[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [itens, setItens] = useState<ItemSacola[]>([]);
  const [ultimaLeitura, setUltimaLeitura] = useState<ProdutoVenda | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, setPendente] = useState<VendaPendente | null>(null);
  const [verificacaoFeita, setVerificacaoFeita] = useState(false);
  const [mensagemVenda, setMensagemVenda] = useState("");
  const [erroVenda, setErroVenda] = useState("");
  const [vendasRecentes, setVendasRecentes] = useState<VendaRecente[]>([]);
  const [revisaoRecentes, setRevisaoRecentes] = useState(0);
  const [comprovante, setComprovante] = useState<ComprovanteVenda | null>(null);
  const [carregandoComprovante, setCarregandoComprovante] = useState<string | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  const totalPecas = quantidadePecas(itens);
  const totalCentavos = useMemo(() => totalSacolaCentavos(itens), [itens]);
  const lojaSelecionada = lojas.find((loja) => loja.id === lojaId);
  const vendedoresDaLoja = vendedores.filter((vendedor) => vendedor.lojaId === lojaId);
  const edicaoBloqueada = confirmando || Boolean(pendente);
  const focarLeitor = () => requestAnimationFrame(() => codigoRef.current?.focus());

  useEffect(() => {
    let recuperada: VendaPendente | null = null;
    try {
      recuperada = lerVendaPendente(
        window.localStorage.getItem(CHAVE_VENDA_PENDENTE), usuarioId,
      );
    } catch {
      setErroVenda("O navegador não permitiu verificar uma venda pendente.");
    }
    if (!recuperada || !lojas.some((loja) => loja.id === recuperada.lojaId) ||
        !vendedores.some((vendedor) => vendedor.id === recuperada.vendedorUsuarioId &&
          vendedor.lojaId === recuperada.lojaId)) return;
    setLojaId(recuperada.lojaId);
    setVendedorId(recuperada.vendedorUsuarioId);
    setClienteId(recuperada.clienteId ?? "");
    setItens([...recuperada.itensExibicao]);
    setPendente(recuperada);
    setErroVenda("Há uma confirmação pendente. Verifique o resultado antes de reenviar.");
  }, [lojas, usuarioId, vendedores]);

  useEffect(() => {
    let ativo = true;
    void fetch("/api/clientes", { cache: "no-store", credentials: "same-origin" })
      .then(async (resposta) => {
        const dados = await resposta.json();
        if (ativo && resposta.ok) setClientes((dados.clientes ?? []).map((cliente: ClienteVenda) => ({
          id: cliente.id, nome: cliente.nome, whatsappDigitos: cliente.whatsappDigitos,
        })));
      }).catch(() => { if (ativo) setClientes([]); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!lojaId) { setVendasRecentes([]); return; }
    let ativo = true;
    const parametros = new URLSearchParams({ lojaId });
    void fetch(`/api/comprovantes?${parametros}`, {
      method: "GET", cache: "no-store", credentials: "same-origin",
    }).then(async (resposta) => {
      const dados = await resposta.json() as RespostaComprovante;
      if (ativo && resposta.ok) setVendasRecentes(dados.vendas ?? []);
    }).catch(() => { if (ativo) setVendasRecentes([]); });
    return () => { ativo = false; };
  }, [lojaId, revisaoRecentes]);

  function esquecerPendente() {
    try { window.localStorage.removeItem(CHAVE_VENDA_PENDENTE); } catch { /* estado em memória ainda é limpo */ }
    setPendente(null);
    setVerificacaoFeita(false);
  }

  function concluirVenda(venda: NonNullable<RespostaVenda["venda"]>) {
    esquecerPendente();
    setItens([]);
    setUltimaLeitura(null);
    setErroVenda("");
    setMensagemVenda(`Venda confirmada: ${venda.id.slice(0, 8)} · ${brlCentavos(BigInt(venda.totalCentavos))}.`);
    setRevisaoRecentes((atual) => atual + 1);
    toast.success("Venda confirmada e estoque atualizado.");
  }

  async function adicionar() {
    if (consultando || pendente) return;
    try {
      const codigoValido = normalizarCodigoVenda(codigo);
      const quantidadeValida = Number(quantidade);
      if (!Number.isSafeInteger(quantidadeValida) || quantidadeValida < 1) {
        throw new ErroSacola("Informe uma quantidade inteira positiva.");
      }
      if (!lojaId) throw new ErroSacola("Nenhuma loja está disponível para a venda.");
      setConsultando(true);
      const parametros = new URLSearchParams({ lojaId, codigo: codigoValido });
      const resposta = await fetch(`/api/vendas/catalogo?${parametros}`, {
        method: "GET", cache: "no-store", headers: { Accept: "application/json" },
      });
      const dados = await resposta.json() as RespostaProduto;
      if (!resposta.ok || !dados.produto) {
        throw new ErroSacola(dados.erro ?? "Código indisponível nesta loja.");
      }
      const proximaSacola = adicionarNaSacola(itens, dados.produto, quantidadeValida);
      setItens(proximaSacola);
      setUltimaLeitura(dados.produto);
      setCodigo("");
      setQuantidade("1");
      toast.success(`${dados.produto.nome} · ${dados.produto.tamanho} adicionado.`);
    } catch (erro) {
      toast.error(erro instanceof ErroSacola ? erro.message : "Não foi possível consultar o código.");
    } finally {
      setConsultando(false);
      focarLeitor();
    }
  }

  function alterarQuantidade(item: ItemSacola, delta: number) {
    if (pendente) return;
    try {
      setItens(definirQuantidade(itens, item.id, item.quantidade + delta));
    } catch (erro) {
      toast.error(erro instanceof ErroSacola ? erro.message : "Não foi possível alterar a quantidade.");
    }
  }

  function trocarLoja(novaLojaId: string) {
    if (pendente) return;
    if (itens.length) toast.info("A sacola foi limpa ao trocar de loja.");
    setLojaId(novaLojaId);
    setVendedorId(vendedores.find((vendedor) => vendedor.lojaId === novaLojaId)?.id ?? "");
    setItens([]);
    setUltimaLeitura(null);
    setCodigo("");
    setMensagemVenda("");
    setErroVenda("");
    focarLeitor();
  }

  async function confirmar() {
    if (!itens.length || !lojaId || !vendedorId || confirmando) return;
    setErroVenda("");
    setMensagemVenda("");
    let operacao = pendente;
    if (!operacao) {
      operacao = {
        usuarioId,
        lojaId,
        vendedorUsuarioId: vendedorId,
        clienteId: clienteId || null,
        itens: itensDaSacola(itens),
        itensExibicao: itens,
        chave: crypto.randomUUID(),
      };
      try {
        window.localStorage.setItem(CHAVE_VENDA_PENDENTE, JSON.stringify(operacao));
      } catch {
        setErroVenda("Não foi possível proteger a operação neste navegador. A venda não foi enviada.");
        return;
      }
      setPendente(operacao);
    }
    setConfirmando(true);
    try {
      const resposta = await fetch("/api/vendas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lojaId: operacao.lojaId,
          vendedorUsuarioId: operacao.vendedorUsuarioId,
          clienteId: operacao.clienteId,
          itens: operacao.itens,
          chaveIdempotencia: operacao.chave,
        }),
      });
      const dados = await resposta.json() as RespostaVenda;
      if (!resposta.ok || !dados.venda) {
        if (resposta.status >= 400 && resposta.status < 500) esquecerPendente();
        throw new Error(dados.erro ?? "Não foi possível confirmar a venda.");
      }
      concluirVenda(dados.venda);
    } catch (erro) {
      setErroVenda(erro instanceof Error ? erro.message : "Resultado da venda desconhecido.");
    } finally {
      setConfirmando(false);
    }
  }

  async function verificarVenda() {
    if (!pendente || confirmando) return;
    setConfirmando(true);
    setErroVenda("");
    try {
      const parametros = new URLSearchParams({
        lojaId: pendente.lojaId, chaveIdempotencia: pendente.chave,
      });
      const resposta = await fetch(`/api/vendas?${parametros}`, {
        method: "GET", cache: "no-store", credentials: "same-origin",
      });
      const dados = await resposta.json() as RespostaVenda;
      if (resposta.status === 404) {
        setVerificacaoFeita(true);
        setErroVenda("Venda ainda não localizada. Você pode reenviar exatamente a mesma confirmação.");
        return;
      }
      if (!resposta.ok || !dados.venda) throw new Error(dados.erro ?? "Não foi possível verificar a venda.");
      concluirVenda(dados.venda);
    } catch (erro) {
      setErroVenda(erro instanceof Error ? erro.message : "Não foi possível verificar a venda.");
    } finally {
      setConfirmando(false);
    }
  }

  async function abrirComprovante(vendaId: string) {
    if (!lojaId || carregandoComprovante) return;
    setCarregandoComprovante(vendaId);
    setErroVenda("");
    try {
      const parametros = new URLSearchParams({ lojaId, vendaId });
      const resposta = await fetch(`/api/comprovantes?${parametros}`, {
        method: "GET", cache: "no-store", credentials: "same-origin",
      });
      const dados = await resposta.json() as RespostaComprovante;
      if (!resposta.ok || !dados.comprovante) throw new Error(dados.erro ?? "Comprovante indisponível.");
      setComprovante(dados.comprovante);
    } catch (erro) {
      setErroVenda(erro instanceof Error ? erro.message : "Não foi possível preparar o comprovante.");
    } finally {
      setCarregandoComprovante(null);
    }
  }

  return (
    <AppShell
      title="Frente de caixa"
      subtitle="Leia as peças e confira a sacola antes de confirmar"
      actions={
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs">
          <span className="size-2 rounded-full bg-success shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-success)_15%,transparent)]" />
          Leitura conectada ao catálogo
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <ResumoRapido icon={ShoppingBag} label="Vendas de hoje" value="—" />
        <ResumoRapido icon={ReceiptText} label="Faturado hoje" value="—" />
        <ResumoRapido icon={PackageCheck} label="Sacola atual" value={`${totalPecas} ${totalPecas === 1 ? "peça" : "peças"}`} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-4">
          <section className="card-surface overflow-hidden border-brand/25">
            <div className="flex flex-col gap-3 border-b border-border bg-accent/35 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <ScanLine className="size-4 text-brand" />
                  <h2 className="font-display text-base font-semibold">Leitor de produtos</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cada Enter ou clique é uma leitura intencional; códigos repetidos somam na sacola.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Loja:</span>
                <select
                  value={lojaId}
                  disabled={!lojas.length || consultando || edicaoBloqueada}
                  onChange={(evento) => trocarLoja(evento.target.value)}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
                >
                  {!lojas.length && <option value="">Nenhuma loja disponível</option>}
                  {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}
                </select>
              </label>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_auto]">
                <label className="relative block">
                  <Barcode className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={codigoRef}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    value={codigo}
                    disabled={!lojaId || consultando || edicaoBloqueada}
                    onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, "").slice(0, 5))}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter") { evento.preventDefault(); void adicionar(); }
                    }}
                    className="h-14 w-full rounded-2xl border-2 border-brand/35 bg-card pr-4 pl-12 font-mono text-base font-medium tracking-wide outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/65 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-60"
                    placeholder="00001"
                    aria-label="Código de cinco dígitos"
                  />
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quantidade}
                  disabled={!lojaId || consultando || edicaoBloqueada}
                  onChange={(evento) => setQuantidade(evento.target.value)}
                  className="h-14 rounded-2xl border border-input bg-card px-3 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
                  aria-label="Quantidade da leitura"
                />
                <button
                  type="button"
                  disabled={!lojaId || consultando || edicaoBloqueada}
                  onClick={() => void adicionar()}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {consultando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Adicionar
                </button>
              </div>

              <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2">
                {ultimaLeitura ? (
                  <>
                    <Chip tone="success"><Check className="size-3" /> Lido com sucesso</Chip>
                    <p className="truncate text-xs text-muted-foreground">
                      {ultimaLeitura.codigo} · {ultimaLeitura.nome} · {ultimaLeitura.tamanho} · {brlCentavos(BigInt(ultimaLeitura.precoCentavos))}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Digite os cinco dígitos, inclusive zeros iniciais, ou use o leitor e pressione Enter.
                  </p>
                )}
              </div>
            </div>
          </section>

          <SectionCard
            title="Sacola da venda"
            description={itens.length
              ? `${itens.length} ${itens.length === 1 ? "produto" : "produtos"} · ${totalPecas} ${totalPecas === 1 ? "peça" : "peças"}`
              : "Os produtos lidos aparecem aqui"}
            actions={itens.length ? (
              <button
                type="button"
                disabled={edicaoBloqueada}
                onClick={() => { setItens([]); setUltimaLeitura(null); focarLeitor(); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3.5" /> Limpar sacola
              </button>
            ) : null}
            padded={false}
          >
            {itens.length ? (
              <div className="divide-y divide-border">
                {itens.map((item, indice) => (
                  <article key={item.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
                    <span className="hidden font-display text-xs font-semibold text-muted-foreground sm:block">{String(indice + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.nome} · {item.tamanho}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {item.codigo} · {brlCentavos(BigInt(item.precoCentavos))} cada · {item.estoque} em estoque
                      </p>
                    </div>
                    <div className="flex h-9 items-center rounded-xl border border-border bg-card">
                      <button type="button" disabled={edicaoBloqueada} onClick={() => alterarQuantidade(item, -1)} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={`Diminuir quantidade de ${item.nome} ${item.tamanho}`}><Minus className="size-3.5" /></button>
                      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{item.quantidade}</span>
                      <button type="button" disabled={edicaoBloqueada} onClick={() => alterarQuantidade(item, 1)} className="grid size-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={`Aumentar quantidade de ${item.nome} ${item.tamanho}`}><Plus className="size-3.5" /></button>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:min-w-32 sm:justify-end">
                      <p className="text-sm font-semibold tabular-nums">{brlCentavos(BigInt(item.precoCentavos) * BigInt(item.quantidade))}</p>
                      <button
                        type="button"
                        disabled={edicaoBloqueada}
                        onClick={() => setItens((atuais) => atuais.filter((atual) => atual.id !== item.id))}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        aria-label={`Remover ${item.nome} ${item.tamanho}`}
                      ><Trash2 className="size-3.5" /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center px-4 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"><ShoppingBag className="size-6" /></span>
                  <p className="mt-4 text-sm font-medium">A sacola está vazia</p>
                  <p className="mt-1 text-xs text-muted-foreground">Comece lendo o código de uma peça acima.</p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Vendas recentes"
            description="Comprovantes disponíveis somente para vendas persistidas nesta loja"
            padded={false}
          >
            {vendasRecentes.length ? (
              <div className="divide-y divide-border">
                {vendasRecentes.map((venda) => (
                  <div key={venda.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{venda.responsavelNome}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{dataHoraCurta(venda.realizadaEm)} · {brlCentavos(BigInt(venda.totalCentavos))}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(carregandoComprovante)}
                      onClick={() => void abrirComprovante(venda.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-medium disabled:opacity-50"
                    >
                      {carregandoComprovante === venda.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <ReceiptText className="size-3.5" />}
                      Comprovante
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma venda persistida nesta loja.</p>
            )}
          </SectionCard>
        </div>

        <aside className="card-surface overflow-hidden xl:sticky xl:top-[5.25rem]">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">Resumo da venda</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Confira antes de finalizar</p>
              </div>
              <Chip tone={itens.length ? "brand" : "muted"}>{totalPecas} {totalPecas === 1 ? "peça" : "peças"}</Chip>
            </div>
          </div>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="rounded-xl bg-secondary/55 px-3 py-2.5">
              <p className="eyebrow">Loja da venda</p>
              <p className="mt-1 text-sm font-semibold">{lojaSelecionada?.nome ?? "Nenhuma loja disponível"}</p>
            </div>
            <label className="block">
                <span className="eyebrow">Responsável pela venda</span>
              <select
                className={`${fieldCls} mt-2`}
                value={vendedorId}
                disabled={edicaoBloqueada || !vendedoresDaLoja.length}
                onChange={(evento) => { setVendedorId(evento.target.value); setMensagemVenda(""); setErroVenda(""); }}
              >
                {!vendedoresDaLoja.length && <option value="">Nenhum responsável ativo nesta loja</option>}
                {vendedoresDaLoja.map((vendedor) => <option key={vendedor.id} value={vendedor.id}>{vendedor.nome}</option>)}
              </select>
            </label>
            {!vendedoresDaLoja.length && (
              <p className="text-xs leading-5 text-muted-foreground">
                A confirmação exige um usuário ativo e vinculado à loja.
              </p>
            )}
            <label className="block">
              <span className="eyebrow">Cliente (opcional)</span>
              <select
                className={`${fieldCls} mt-2`}
                value={clienteId}
                disabled={edicaoBloqueada}
                onChange={(evento) => { setClienteId(evento.target.value); setMensagemVenda(""); setErroVenda(""); }}
              >
                <option value="">Venda sem identificação</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome} · {cliente.whatsappDigitos}</option>)}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">O vínculo é definido na confirmação e não pode ser alterado depois.</span>
            </label>
            {pendente && (
              <div className="rounded-xl border border-warning/35 bg-warning/10 p-3 text-xs leading-5">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Resultado pendente</p>
                <p className="mt-1 text-muted-foreground">Consulte a mesma chave antes de reenviar. A sacola fica bloqueada para não mudar o payload.</p>
                <button
                  type="button"
                  disabled={confirmando}
                  onClick={() => void verificarVenda()}
                  className="mt-2 rounded-lg border border-border bg-card px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  Verificar venda
                </button>
              </div>
            )}
            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <LinhaTotal label="Subtotal" value={brlCentavos(totalCentavos)} />
              <div className="flex items-end justify-between gap-4 pt-2">
                <div>
                  <p className="eyebrow">Total da sacola</p>
                  <p className="mt-1 text-xs text-muted-foreground">Preço atual do catálogo</p>
                </div>
                <p className="font-display text-2xl font-semibold tabular-nums">{brlCentavos(totalCentavos)}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!itens.length || !vendedorId || confirmando || (Boolean(pendente) && !verificacaoFeita)}
              onClick={() => void confirmar()}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmando ? <LoaderCircle className="size-4 animate-spin" /> : <ReceiptText className="size-4" />}
              {pendente ? "Reenviar mesma venda" : "Confirmar venda"} · {brlCentavos(totalCentavos)}
            </button>
            <p className="text-center text-[11px] leading-4 text-muted-foreground">
              O servidor recalcula preços e total; venda e baixa são confirmadas juntas ou recusadas juntas.
            </p>
            {mensagemVenda && <p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">{mensagemVenda}</p>}
            {erroVenda && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{erroVenda}</p>}
          </div>
        </aside>
      </div>
      {comprovante && <ComprovanteDialog comprovante={comprovante} onClose={() => setComprovante(null)} />}
    </AppShell>
  );
}

function ResumoRapido({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return (
    <div className="card-surface flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-display text-base font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function LinhaTotal({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>;
}
