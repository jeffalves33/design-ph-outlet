"use client";

import { ChevronLeft, ChevronRight, Printer, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { fieldCls } from "@/components/form-bits";
import { barrasCode128B, codigoEtiqueta, normalizarMargemMm,
  normalizarQuantidadeEtiquetas, paginarEtiquetas, type FormatoEtiqueta } from "../dominio/etiqueta";

export type CategoriaEtiqueta = {
  id: string; loja_id: string; loja_nome: string; codigo: number;
  nome: string; tamanho: string; preco_centavos: string;
};

const dinheiro = (centavos: string) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(Number(centavos) / 100);

function CodigoBarras({ codigo }: { codigo: string }) {
  const desenho = useMemo(() => barrasCode128B(codigo), [codigo]);
  return <svg viewBox={`0 0 ${desenho.larguraTotal} 42`} role="img"
    aria-label={`Código de barras ${codigo}`} preserveAspectRatio="none" className="h-9 w-full">
    <rect width={desenho.larguraTotal} height="42" fill="white" />
    {desenho.barras.map((barra, indice) =>
      <rect key={`${barra.x}-${indice}`} x={barra.x} y="1" width={barra.largura} height="40" fill="black" />)}
  </svg>;
}

function Etiqueta({ categoria, numero }: { categoria: CategoriaEtiqueta; numero: number }) {
  const codigo = codigoEtiqueta(categoria.codigo);
  return <article className="etiqueta-fisica bg-white p-[2mm] text-black">
    <div className="flex items-start justify-between gap-2">
      <strong className="text-[8pt] tracking-[0.12em]">{categoria.loja_nome.toLocaleUpperCase("pt-BR")}</strong>
      <span className="text-[6pt] text-slate-500">#{numero}</span>
    </div>
    <p className="mt-[1mm] truncate text-[8pt] font-semibold">{categoria.nome} · {categoria.tamanho}</p>
    <CodigoBarras codigo={codigo} />
    <div className="flex items-end justify-between gap-2">
      <span className="font-mono text-[8pt] tracking-[0.16em]">{codigo}</span>
      <strong className="text-[10pt]">{dinheiro(categoria.preco_centavos)}</strong>
    </div>
  </article>;
}

export function EtiquetasDialog({ categoria, onClose }: {
  categoria: CategoriaEtiqueta; onClose: () => void;
}) {
  const [quantidadeTexto, setQuantidadeTexto] = useState("1");
  const [margemTexto, setMargemTexto] = useState("2");
  const [formato, setFormato] = useState<FormatoEtiqueta>("termica");
  const [pagina, setPagina] = useState(0);
  const [erro, setErro] = useState("");
  const quantidade = Number(quantidadeTexto);
  const margem = Number(margemTexto.replace(",", "."));
  let paginas: number[][] = [];
  try {
    paginas = paginarEtiquetas(quantidade, formato);
    normalizarMargemMm(margem);
  } catch { /* validação apresentada ao imprimir */ }
  const paginaAtual = Math.min(pagina, Math.max(0, paginas.length - 1));

  useEffect(() => { setPagina(0); }, [formato, quantidadeTexto]);

  const imprimir = () => {
    try {
      normalizarQuantidadeEtiquetas(quantidade);
      normalizarMargemMm(margem);
      setErro("");
      window.print();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível preparar a impressão.");
    }
  };
  const estilo = { "--margem-etiquetas": `${Number.isFinite(margem) ? margem : 0}mm` } as CSSProperties;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-3" role="dialog" aria-modal="true"
    aria-labelledby="titulo-etiquetas">
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="titulo-etiquetas" className="text-xl font-semibold">Preparar etiquetas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reimprimir não altera entrada, estoque ou histórico.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar etiquetas"
          className="grid size-9 place-items-center rounded-xl border border-border"><X className="size-4" /></button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="eyebrow">Categoria selecionada</p>
            <p className="mt-2 font-semibold">{categoria.nome} · {categoria.tamanho}</p>
            <p className="mt-1 text-sm text-muted-foreground">{categoria.loja_nome} · {codigoEtiqueta(categoria.codigo)}</p>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantidade
            <input className={`${fieldCls} mt-2`} type="number" min="1" max="500" step="1"
              value={quantidadeTexto} onChange={(evento) => setQuantidadeTexto(evento.target.value)} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formato
            <select className={`${fieldCls} mt-2`} value={formato}
              onChange={(evento) => setFormato(evento.target.value as FormatoEtiqueta)}>
              <option value="termica">Térmica · 50 × 30 mm</option>
              <option value="a4">A4 · 3 colunas</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margem (mm)
            <input className={`${fieldCls} mt-2`} type="number" min="0" max="5" step="0.5"
              value={margemTexto} onChange={(evento) => setMargemTexto(evento.target.value)} />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">O navegador abrirá a janela de impressão. A abertura dessa janela não confirma impressão física.</p>
        </div>

        <div className="rounded-xl border border-border bg-secondary/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">Pré-visualização paginada</p>
              <p className="text-xs text-muted-foreground">{paginas.length || 0} página(s) · {quantidade || 0} etiqueta(s)</p></div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" disabled={paginaAtual === 0}
                onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
                className="grid size-9 place-items-center rounded-xl border border-border disabled:opacity-40"><ChevronLeft className="size-4" /></button>
              <span className="min-w-16 text-center text-sm">{paginas.length ? paginaAtual + 1 : 0}/{paginas.length}</span>
              <button type="button" aria-label="Próxima página" disabled={paginaAtual >= paginas.length - 1}
                onClick={() => setPagina((atual) => Math.min(paginas.length - 1, atual + 1))}
                className="grid size-9 place-items-center rounded-xl border border-border disabled:opacity-40"><ChevronRight className="size-4" /></button>
            </div>
          </div>
          <div className={`mt-4 grid gap-2 ${formato === "a4" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
            {(paginas[paginaAtual] ?? []).slice(0, formato === "a4" ? 6 : 1).map((numero) =>
              <Etiqueta key={numero} categoria={categoria} numero={numero} />)}
          </div>
          {formato === "a4" && (paginas[paginaAtual]?.length ?? 0) > 6 &&
            <p className="mt-3 text-center text-xs text-muted-foreground">+ {(paginas[paginaAtual]?.length ?? 0) - 6} etiquetas nesta página</p>}
        </div>
      </div>
      {erro && <p role="alert" className="mt-4 text-sm text-destructive">{erro}</p>}
      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" onClick={onClose} className="h-10 rounded-xl border border-border px-4 text-sm">Voltar</button>
        <button type="button" onClick={imprimir}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">
          <Printer className="size-4" /> Imprimir {quantidade || 0}
        </button>
      </div>
    </div>

    <div className={`area-impressao formato-${formato}`} style={estilo} aria-hidden="true">
      {paginas.map((itens, indicePagina) => <section className="pagina-etiquetas" key={indicePagina}>
        {itens.map((numero) => <Etiqueta key={numero} categoria={categoria} numero={numero} />)}
      </section>)}
    </div>
  </div>;
}
