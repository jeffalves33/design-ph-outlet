"use client";

import { Printer, X } from "lucide-react";

export type ComprovanteVenda = Readonly<{
  id: string;
  lojaNome: string;
  responsavelNome: string;
  totalCentavos: string;
  realizadaEm: string;
  itens: readonly Readonly<{
    categoriaId: string;
    codigo: string;
    nome: string;
    tamanho: string;
    precoUnitarioCentavos: string;
    quantidade: number;
    totalLinhaCentavos: string;
  }>[];
}>;

function dinheiro(centavos: string) {
  const valor = BigInt(centavos);
  const reais = valor / 100n;
  return `R$ ${reais.toLocaleString("pt-BR")},${String(valor % 100n).padStart(2, "0")}`;
}

function dataHora(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.valueOf()) ? "Data indisponível" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(data);
}

function Documento({ comprovante }: { comprovante: ComprovanteVenda }) {
  return (
    <article className="comprovante-fisico bg-white p-[4mm] font-mono text-[9pt] text-black">
      <header className="border-b border-dashed border-black pb-[3mm] text-center">
        <h3 className="text-[12pt] font-bold">{comprovante.lojaNome}</h3>
        <p className="mt-[1mm] font-bold">COMPROVANTE NÃO FISCAL</p>
        <p className="mt-[1mm] text-[8pt]">Venda {comprovante.id}</p>
        <p className="text-[8pt]">{dataHora(comprovante.realizadaEm)}</p>
      </header>
      <div className="space-y-[2mm] border-b border-dashed border-black py-[3mm]">
        {comprovante.itens.map((item) => (
          <div key={item.categoriaId} className="break-inside-avoid">
            <div className="flex justify-between gap-[2mm] font-bold">
              <span>{item.codigo} · {item.nome} · {item.tamanho}</span>
              <span>{dinheiro(item.totalLinhaCentavos)}</span>
            </div>
            <p className="text-[8pt]">{item.quantidade} × {dinheiro(item.precoUnitarioCentavos)}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-[3mm] border-b border-dashed border-black py-[3mm] text-[12pt] font-bold">
        <span>TOTAL</span><span>{dinheiro(comprovante.totalCentavos)}</span>
      </div>
      <footer className="pt-[3mm] text-center text-[8pt]">
        <p>Responsável: {comprovante.responsavelNome}</p>
        <p className="mt-[2mm]">Documento sem valor fiscal</p>
      </footer>
    </article>
  );
}

export function ComprovanteDialog({ comprovante, onClose }: {
  comprovante: ComprovanteVenda;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-comprovante">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-comprovante" className="text-xl font-semibold">Comprovante da venda</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reimprimir consulta a venda persistida e não altera estoque, venda ou meta.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar comprovante" className="grid size-9 place-items-center rounded-xl border border-border"><X className="size-4" /></button>
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-secondary/45 p-4">
          <div className="mx-auto w-fit shadow-lg"><Documento comprovante={comprovante} /></div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          O navegador abrirá a janela de impressão. Isso não confirma impressão física; modelo e papel serão homologados no gate final.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-border px-4 text-sm">Voltar</button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">
            <Printer className="size-4" /> Imprimir comprovante
          </button>
        </div>
      </div>
      <div className="area-impressao area-comprovante" aria-hidden="true"><Documento comprovante={comprovante} /></div>
    </div>
  );
}
