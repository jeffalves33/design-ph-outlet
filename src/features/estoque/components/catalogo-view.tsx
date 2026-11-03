"use client";

import { useEffect, useRef, useState } from "react";
import { Boxes, Layers3, PackagePlus, Printer, Search, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import { EtiquetasDialog, type CategoriaEtiqueta } from "@/features/etiquetas/components/etiquetas-dialog";
import { centavosDoTexto, codigoExibido } from "../dominio/categoria";
import { CHAVE_OPERACAO_PENDENTE, lerOperacaoPendente, type OperacaoPendente } from "../dominio/operacao-pendente";

type Loja = { id: string; nome: string };
type Categoria = {
  id: string; loja_id: string; loja_nome: string; codigo: number; nome: string; tamanho: string;
  preco_centavos: string; quantidade: string; arquivada_em: string | null;
};
type Movimento = {
  id: string; tipo: "entrada" | "ajuste"; variacao_quantidade: string;
  saldo_apos: string; motivo: string; criado_em: string; autor: string;
};

const moeda = (centavos: string) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(Number(centavos) / 100);

export default function CatalogoView() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lojaId, setLojaId] = useState("");
  const [nome, setNome] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [preco, setPreco] = useState("");
  const [buscaNome, setBuscaNome] = useState("");
  const [menorSaldoPrimeiro, setMenorSaldoPrimeiro] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [movimentando, setMovimentando] = useState<string | null>(null);
  const [tipoMovimento, setTipoMovimento] = useState<"entrada" | "ajuste">("entrada");
  const [variacaoTexto, setVariacaoTexto] = useState("");
  const [motivoMovimento, setMotivoMovimento] = useState("");
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [erroMovimento, setErroMovimento] = useState("");
  const [salvandoMovimento, setSalvandoMovimento] = useState(false);
  const [reconciliacaoPendente, setReconciliacaoPendente] = useState(false);
  const [verificacaoFeita, setVerificacaoFeita] = useState(false);
  const [etiquetando, setEtiquetando] = useState<CategoriaEtiqueta | null>(null);
  const [carregandoEtiqueta, setCarregandoEtiqueta] = useState<string | null>(null);
  const [erroEtiqueta, setErroEtiqueta] = useState("");
  const chavePendente = useRef<{ assinatura: string; chave: string } | null>(null);
  const usuarioId = useRef("");

  const esquecerOperacao = () => {
    const chave = chavePendente.current?.chave;
    chavePendente.current = null;
    try {
      const guardada = lerOperacaoPendente(
        window.localStorage.getItem(CHAVE_OPERACAO_PENDENTE), usuarioId.current);
      if (chave && guardada?.chave === chave)
        window.localStorage.removeItem(CHAVE_OPERACAO_PENDENTE);
    } catch { /* já confirmada; próxima leitura valida a chave */ }
  };

  const carregar = async () => {
    const res = await fetch("/api/catalogo", { cache: "no-store", credentials: "same-origin" });
    const dados = await res.json() as { lojas?: Loja[]; categorias?: Categoria[]; erro?: string };
    if (!res.ok) throw new Error(dados.erro ?? "Não foi possível consultar o catálogo.");
    setLojas(dados.lojas ?? []);
    setCategorias(dados.categorias ?? []);
    setLojaId((atual) => atual || dados.lojas?.[0]?.id || "");
  };

  useEffect(() => {
    let ativo = true;
    Promise.all([
      fetch("/api/catalogo", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/acesso", { cache: "no-store", credentials: "same-origin" }),
    ]).then(async ([res, acesso]) => {
        const dados = await res.json() as { lojas?: Loja[]; categorias?: Categoria[]; erro?: string };
        if (!res.ok) throw new Error(dados.erro ?? "Não foi possível consultar o catálogo.");
        if (!acesso.ok) throw new Error("Não foi possível verificar a sessão.");
        const sessao = await acesso.json() as { perfil?: { id: string } };
        if (!sessao.perfil?.id) throw new Error("Sessão indisponível.");
        if (ativo) {
          usuarioId.current = sessao.perfil.id;
          setLojas(dados.lojas ?? []);
          setCategorias(dados.categorias ?? []);
          const guardada = lerOperacaoPendente(
            window.localStorage.getItem(CHAVE_OPERACAO_PENDENTE), sessao.perfil.id);
          const autorizada = guardada && dados.lojas?.some((loja) => loja.id === guardada.lojaId) &&
            dados.categorias?.some((categoria) => categoria.id === guardada.categoriaId &&
              categoria.loja_id === guardada.lojaId);
          if (guardada && autorizada) {
            const assinatura = JSON.stringify({ lojaId: guardada.lojaId,
              categoriaId: guardada.categoriaId, tipo: guardada.tipo,
              variacao: guardada.variacao, motivo: guardada.motivo.trim() });
            chavePendente.current = { assinatura, chave: guardada.chave };
            setLojaId(guardada.lojaId); setMovimentando(guardada.categoriaId);
            setTipoMovimento(guardada.tipo); setVariacaoTexto(String(guardada.variacao));
            setMotivoMovimento(guardada.motivo); setReconciliacaoPendente(true);
            setMensagem("Há uma movimentação com resposta incerta. Verifique antes de reenviar.");
          } else setLojaId(dados.lojas?.[0]?.id ?? "");
        }
      })
      .catch((falha) => { if (ativo) setErro(falha instanceof Error ? falha.message : "Consulta indisponível."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!movimentando || !lojaId) { setMovimentos([]); return; }
    let ativo = true;
    const parametros = new URLSearchParams({ lojaId, categoriaId: movimentando });
    fetch(`/api/estoque/movimentos?${parametros}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        const dados = await res.json() as { movimentos?: Movimento[]; erro?: string };
        if (!res.ok) throw new Error(dados.erro ?? "Histórico indisponível.");
        if (ativo) setMovimentos(dados.movimentos ?? []);
      })
      .catch(() => { if (ativo) setErroMovimento("Não foi possível consultar o histórico."); });
    return () => { ativo = false; };
  }, [movimentando, lojaId]);

  const salvar = async (arquivar = false) => {
    setErro(""); setMensagem("");
    try {
      if (!lojaId) throw new Error("Escolha uma loja vinculada.");
      const precoCentavos = centavosDoTexto(preco);
      setSalvando(true);
      const res = await fetch("/api/catalogo", {
        method: editando ? "PATCH" : "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editando, lojaId, nome, tamanho, precoCentavos, arquivar }),
      });
      const dados = await res.json() as { erro?: string };
      if (!res.ok) throw new Error(dados.erro ?? "Não foi possível salvar.");
      await carregar();
      setNome(""); setTamanho(""); setPreco(""); setEditando(null);
      if (arquivar) { setMovimentando(null); esquecerOperacao(); }
      setMensagem(arquivar ? "Categoria arquivada sem apagar o histórico." : "Categoria salva.");
    } catch (falha) { setErro(falha instanceof Error ? falha.message : "Operação indisponível."); }
    finally { setSalvando(false); }
  };

  const editar = (categoria: Categoria) => {
    setEditando(categoria.id); setLojaId(categoria.loja_id);
    setNome(categoria.nome); setTamanho(categoria.tamanho);
    setPreco((Number(categoria.preco_centavos) / 100).toFixed(2));
    setErro(""); setMensagem("");
  };

  const registrarMovimento = async () => {
    setErroMovimento(""); setMensagem("");
    let statusResposta: number | null = null;
    let enviada = false;
    try {
      if (!lojaId || !movimentando) throw new Error("Selecione uma categoria da loja.");
      const variacao = Number(variacaoTexto);
      if (!Number.isSafeInteger(variacao) || variacao === 0 ||
          (tipoMovimento === "entrada" && variacao < 0))
        throw new Error("Informe uma quantidade inteira válida.");
      const assinatura = JSON.stringify({ lojaId, categoriaId: movimentando,
        tipo: tipoMovimento, variacao, motivo: motivoMovimento.trim() });
      if (!usuarioId.current) throw new Error("Sessão não verificada.");
      const outra = lerOperacaoPendente(
        window.localStorage.getItem(CHAVE_OPERACAO_PENDENTE), usuarioId.current);
      if (outra && outra.chave !== chavePendente.current?.chave)
        throw new Error("Há outra movimentação pendente neste navegador. Recarregue e verifique antes de registrar.");
      if (chavePendente.current?.assinatura !== assinatura)
        chavePendente.current = { assinatura, chave: crypto.randomUUID() };
      const pendente: OperacaoPendente = { usuarioId: usuarioId.current,
        lojaId, categoriaId: movimentando, tipo: tipoMovimento,
        variacao, motivo: motivoMovimento, chave: chavePendente.current.chave };
      window.localStorage.setItem(CHAVE_OPERACAO_PENDENTE, JSON.stringify(pendente));
      setSalvandoMovimento(true);
      enviada = true;
      const res = await fetch("/api/estoque/movimentos", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lojaId, categoriaId: movimentando, tipo: tipoMovimento,
          variacao, motivo: motivoMovimento, chaveIdempotencia: chavePendente.current.chave }),
      });
      statusResposta = res.status;
      const dados = await res.json() as { movimento?: { saldoApos: string }; erro?: string };
      if (!res.ok) throw new Error(dados.erro ?? "Não foi possível registrar a movimentação.");
      esquecerOperacao();
      setReconciliacaoPendente(false); setVerificacaoFeita(false);
      setVariacaoTexto(""); setMotivoMovimento("");
      setMensagem(`Movimentação registrada. Saldo após: ${dados.movimento?.saldoApos ?? "—"}.`);
      try {
        await carregar();
        const parametros = new URLSearchParams({ lojaId, categoriaId: movimentando });
        const historico = await fetch(`/api/estoque/movimentos?${parametros}`, {
          cache: "no-store", credentials: "same-origin",
        });
        if (historico.ok) {
          const atual = await historico.json() as { movimentos?: Movimento[] };
          setMovimentos(atual.movimentos ?? []);
        }
      } catch { setMensagem("Movimentação registrada; atualize a página para consultar o saldo."); }
    } catch (falha) {
      if (enviada && (statusResposta === null || statusResposta >= 500)) {
        setReconciliacaoPendente(true); setVerificacaoFeita(false);
      } else {
        esquecerOperacao();
      }
      setErroMovimento(falha instanceof Error ? falha.message : "Movimentação indisponível.");
    } finally { setSalvandoMovimento(false); }
  };

  const verificarOperacao = async () => {
    const pendente = chavePendente.current;
    if (!pendente || !lojaId) return;
    setErroMovimento(""); setMensagem("");
    try {
      const parametros = new URLSearchParams({ lojaId, chaveIdempotencia: pendente.chave });
      const res = await fetch(`/api/estoque/movimentos?${parametros}`, {
        cache: "no-store", credentials: "same-origin",
      });
      if (res.status === 404) {
        setVerificacaoFeita(true);
        setMensagem("Operação ainda não localizada. Se reenviar, mantenha os mesmos dados e a mesma chave.");
        return;
      }
      const dados = await res.json() as { operacao?: { categoriaId: string; saldoApos: string;
        nome: string; tamanho: string }; erro?: string };
      if (!res.ok || !dados.operacao) throw new Error(dados.erro ?? "Verificação indisponível.");
      if (dados.operacao.categoriaId !== movimentando)
        throw new Error("A chave pertence a outra categoria; solicite conferência.");
      esquecerOperacao();
      setReconciliacaoPendente(false); setVerificacaoFeita(false);
      setVariacaoTexto(""); setMotivoMovimento("");
      setMensagem(`Operação confirmada: ${dados.operacao.nome} · ${dados.operacao.tamanho}. Saldo após: ${dados.operacao.saldoApos}.`);
      try { await carregar(); } catch { /* confirmação já foi obtida; atualização visual pode ser repetida */ }
    } catch (falha) {
      setErroMovimento(falha instanceof Error ? falha.message : "Verificação indisponível.");
    }
  };

  const prepararEtiquetas = async (categoria: Categoria) => {
    setErroEtiqueta(""); setCarregandoEtiqueta(categoria.id);
    try {
      const parametros = new URLSearchParams({ lojaId: categoria.loja_id, categoriaId: categoria.id });
      const res = await fetch(`/api/etiquetas?${parametros}`, { cache: "no-store", credentials: "same-origin" });
      const dados = await res.json() as { categoria?: CategoriaEtiqueta; erro?: string };
      if (!res.ok || !dados.categoria) throw new Error(dados.erro ?? "Não foi possível preparar as etiquetas.");
      setEtiquetando(dados.categoria);
    } catch (falha) {
      setErroEtiqueta(falha instanceof Error ? falha.message : "Etiquetas indisponíveis.");
    } finally { setCarregandoEtiqueta(null); }
  };
  const visiveis = categorias.filter((categoria) => categoria.loja_id === lojaId);
  const ativas = visiveis.filter((categoria) => !categoria.arquivada_em);
  const saldo = ativas.reduce((total, categoria) => total + BigInt(categoria.quantidade), 0n);
  const filtradas = visiveis.filter((categoria) => categoria.nome.toLocaleLowerCase("pt-BR")
    .includes(buscaNome.trim().toLocaleLowerCase("pt-BR")));
  if (menorSaldoPrimeiro) filtradas.sort((a, b) => {
    if (Boolean(a.arquivada_em) !== Boolean(b.arquivada_em)) return a.arquivada_em ? 1 : -1;
    const diferenca = BigInt(a.quantidade) - BigInt(b.quantidade);
    return diferenca < 0n ? -1 : diferenca > 0n ? 1 : a.nome.localeCompare(b.nome, "pt-BR");
  });

  return (
    <AppShell title="Estoque" subtitle="Nome e tamanho com código, preço e saldo próprios por loja">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Categorias ativas" value={String(ativas.length)} icon={Layers3} tone="brand" />
        <StatCard label="Peças em estoque" value={saldo.toString()} icon={Boxes} />
        <StatCard label="Arquivadas" value={String(visiveis.length - ativas.length)} icon={Tag} />
        <StatCard label="Movimentação" value="Ativa" hint="Entradas e ajustes com histórico" icon={PackagePlus} />
      </div>

      <SectionCard title="Catálogo da loja" description="Cada nome e tamanho tem código, preço e saldo próprios nesta loja">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loja autorizada
          <select className={`${fieldCls} mt-2`} value={lojaId} disabled={salvandoMovimento || reconciliacaoPendente} onChange={(evento) => {
            setLojaId(evento.target.value); setEditando(null); setNome(""); setTamanho(""); setPreco("");
            setMovimentando(null); setErroMovimento(""); esquecerOperacao();
          }}>
            {lojas.length === 0 && <option value="">Nenhuma loja vinculada</option>}
            {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}
          </select>
        </label>
        <form className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]" onSubmit={(evento) => { evento.preventDefault(); void salvar(); }}>
          <input className={fieldCls} value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Nome da categoria" maxLength={120} required />
          <input className={fieldCls} value={tamanho} onChange={(evento) => setTamanho(evento.target.value)} placeholder="Tamanho" aria-label="Tamanho" maxLength={40} required />
          <input className={fieldCls} value={preco} onChange={(evento) => setPreco(evento.target.value)} placeholder="Preço, ex.: 79,90" inputMode="decimal" required />
          <button className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={salvando || !lojaId}>
            {editando ? "Salvar alterações" : "Nova categoria"}
          </button>
        </form>
        {editando && <div className="mt-3 flex gap-3 text-sm">
          <button type="button" className="text-destructive" disabled={salvando} onClick={() => {
            if (window.confirm("Arquivar esta categoria? O histórico será preservado.")) void salvar(true);
          }}>Arquivar categoria</button>
          <button type="button" className="text-muted-foreground" onClick={() => { setEditando(null); setNome(""); setTamanho(""); setPreco(""); }}>Cancelar edição</button>
        </div>}
        {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
        {mensagem && <p role="status" className="mt-3 text-sm text-primary">{mensagem}</p>}
      </SectionCard>

      <SectionCard title="Categorias cadastradas" description="Busque pelo nome para comparar os tamanhos e seus saldos" padded={false}>
        <div className="flex flex-wrap gap-3 border-b border-border px-5 py-3">
          <input className={`${fieldCls} min-w-48 flex-1`} value={buscaNome} onChange={(evento) => setBuscaNome(evento.target.value)}
            placeholder="Buscar por nome" aria-label="Buscar por nome" />
          <button type="button" className="rounded-xl border border-border px-4 py-2 text-sm" aria-pressed={menorSaldoPrimeiro}
            onClick={() => setMenorSaldoPrimeiro((atual) => !atual)}>{menorSaldoPrimeiro ? "Ordem por nome" : "Menores saldos primeiro"}</button>
        </div>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)_5rem_7rem_6rem_auto] gap-3 border-b border-border px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span>Código</span><span>Categoria</span><span>Tamanho</span><span>Preço</span><span>Saldo</span><span>Ação</span>
        </div>
        {filtradas.map((categoria) => <div key={categoria.id} className="grid grid-cols-[5rem_minmax(0,1fr)_5rem_7rem_6rem_auto] gap-3 border-b border-border px-5 py-4 text-sm">
          <span className="font-mono">{codigoExibido(categoria.codigo)}</span>
          <span><button type="button" className="text-left font-medium hover:underline disabled:no-underline" disabled={Boolean(categoria.arquivada_em)} onClick={() => editar(categoria)}>{categoria.nome}</button>
            {categoria.arquivada_em && <span className="ml-2 text-xs text-muted-foreground">Arquivada</span>}</span>
          <span>{categoria.tamanho}</span><span>{moeda(categoria.preco_centavos)}</span>
          <span>{categoria.quantidade}{categoria.quantidade === "0" && <span className="block text-xs text-destructive">Sem estoque</span>}</span>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={Boolean(categoria.arquivada_em) || salvandoMovimento || reconciliacaoPendente}
              className="text-brand hover:underline disabled:text-muted-foreground disabled:no-underline"
              onClick={() => { setMovimentando(categoria.id); setErroMovimento(""); }}>
              Movimentar
            </button>
            <button type="button" disabled={Boolean(categoria.arquivada_em) || carregandoEtiqueta === categoria.id}
              className="inline-flex items-center gap-1 text-brand hover:underline disabled:text-muted-foreground disabled:no-underline"
              onClick={() => void prepararEtiquetas(categoria)}>
              <Printer className="size-3.5" /> {carregandoEtiqueta === categoria.id ? "Abrindo…" : "Etiquetas"}
            </button>
          </div>
        </div>)}
        {erroEtiqueta && <p role="alert" className="px-5 py-3 text-sm text-destructive">{erroEtiqueta}</p>}
        {!carregando && filtradas.length === 0 && <div className="px-5 py-12 text-center text-sm text-muted-foreground"><Search className="mx-auto mb-3 size-6" />Nenhuma categoria encontrada nesta busca e loja.</div>}
        {carregando && <p className="px-5 py-8 text-sm text-muted-foreground">Carregando catálogo…</p>}
      </SectionCard>

      {movimentando && <SectionCard title="Movimentar estoque" description="Entrada ou ajuste na loja selecionada; nenhum saldo é transferido entre lojas">
        <p className="mb-4 text-sm text-muted-foreground">{(() => { const categoria = visiveis.find((item) => item.id === movimentando); return categoria ? `${categoria.nome} · ${categoria.tamanho}` : ""; })()}</p>
        <form className="grid gap-3 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto]" onSubmit={(evento) => {
          evento.preventDefault(); void registrarMovimento();
        }}>
          <select className={fieldCls} value={tipoMovimento} onChange={(evento) => setTipoMovimento(evento.target.value as "entrada" | "ajuste")}
            aria-label="Tipo de movimentação" disabled={salvandoMovimento || reconciliacaoPendente}>
            <option value="entrada">Entrada</option><option value="ajuste">Ajuste</option>
          </select>
          <input className={fieldCls} type="number" step="1" value={variacaoTexto}
            onChange={(evento) => setVariacaoTexto(evento.target.value)} placeholder={tipoMovimento === "entrada" ? "+ peças" : "+ ou −"}
            aria-label="Variação de peças" required disabled={salvandoMovimento || reconciliacaoPendente} />
          <input className={fieldCls} value={motivoMovimento} onChange={(evento) => setMotivoMovimento(evento.target.value)}
            placeholder="Motivo obrigatório" aria-label="Motivo" maxLength={500} required disabled={salvandoMovimento || reconciliacaoPendente} />
          <button className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={salvandoMovimento || (reconciliacaoPendente && !verificacaoFeita)}>
            {reconciliacaoPendente ? "Reenviar mesma operação" : "Registrar"}</button>
        </form>
        {reconciliacaoPendente && <button type="button" className="mt-3 rounded-xl border border-border px-4 py-2 text-sm"
          onClick={() => void verificarOperacao()}>Verificar se foi registrada</button>}
        <p className="mt-2 text-xs text-muted-foreground">Ajuste aceita quantidade positiva ou negativa; saldo negativo é recusado. Em caso de falha, revise antes de reenviar.</p>
        {erroMovimento && <p role="alert" className="mt-3 text-sm text-destructive">{erroMovimento}</p>}
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Últimas movimentações</h3>
          {movimentos.map((movimento) => <div key={movimento.id} className="mt-3 grid gap-1 border-b border-border pb-3 text-sm sm:grid-cols-[8rem_6rem_6rem_minmax(0,1fr)]">
            <span>{movimento.tipo === "entrada" ? "Entrada" : "Ajuste"}</span>
            <span>{BigInt(movimento.variacao_quantidade) > 0n ? "+" : ""}{movimento.variacao_quantidade}</span>
            <span>Saldo {movimento.saldo_apos}</span>
            <span>{movimento.motivo} · {movimento.autor} · {new Date(movimento.criado_em).toLocaleString("pt-BR")}</span>
          </div>)}
          {movimentos.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhuma movimentação registrada para esta categoria.</p>}
        </div>
      </SectionCard>}
      {etiquetando && <EtiquetasDialog categoria={etiquetando} onClose={() => setEtiquetando(null)} />}
    </AppShell>
  );
}
