import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Check,
  Layers3,
  Minus,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LOJAS, brl, nomeLoja, type Categoria, type Loja, type Produto } from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

const categorias: Categoria[] = [
  "Camisetas",
  "Calças",
  "Vestidos",
  "Conjuntos",
  "Bermudas",
  "Jaquetas",
  "Calçados",
  "Acessórios",
];

type NovoModelo = Omit<Produto, "id">;
type ProdutoEtiqueta = Pick<
  Produto,
  "codigo" | "nome" | "categoria" | "tamanho" | "cor" | "preco" | "loja"
>;
type LoteEtiquetas = { produto: ProdutoEtiqueta; quantidade: number };

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque e etiquetas · PH Outlet" },
      {
        name: "description",
        content:
          "Controle de estoque por modelo com entrada de mercadorias e impressão de etiquetas em lote.",
      },
      { property: "og:title", content: "Estoque e etiquetas · PH Outlet" },
      {
        property: "og:description",
        content:
          "Cadastre modelos, registre novas entradas e prepare etiquetas na quantidade recebida.",
      },
    ],
  }),
  component: Estoque,
});

function Estoque() {
  const { produtos, escopo, ajustarEstoque, addProduto } = useStore();
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<"todas" | Categoria>("todas");
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [entrada, setEntrada] = useState<Produto | null>(null);
  const [loteEtiquetas, setLoteEtiquetas] = useState<LoteEtiquetas | null>(null);

  const base = porEscopo(produtos, escopo);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return base.filter(
      (produto) =>
        (cat === "todas" || produto.categoria === cat) &&
        (!somenteAlerta || produto.estoque <= produto.estoqueMinimo) &&
        (termo === "" ||
          produto.codigo.toLowerCase().includes(termo) ||
          produto.nome.toLowerCase().includes(termo) ||
          produto.cor.toLowerCase().includes(termo)),
    );
  }, [base, busca, cat, somenteAlerta]);

  const unidades = base.reduce((total, produto) => total + produto.estoque, 0);
  const imobilizado = base.reduce((total, produto) => total + produto.estoque * produto.custo, 0);
  const alertas = base.filter((produto) => produto.estoque <= produto.estoqueMinimo);

  const prepararEtiquetas = (produto: ProdutoEtiqueta, quantidade: number) => {
    setLoteEtiquetas({ produto, quantidade: Math.max(1, quantidade) });
  };

  const salvarNovoModelo = (produto: NovoModelo, imprimir: boolean) => {
    addProduto(produto);
    toast.success("Modelo cadastrado no estoque.");
    if (imprimir && produto.estoque > 0) prepararEtiquetas(produto, produto.estoque);
  };

  return (
    <AppShell
      title="Estoque"
      subtitle={
        escopo === "todas"
          ? "Produtos agrupados por modelo — visão das duas lojas"
          : `Produtos agrupados por modelo — ${nomeLoja(escopo)}`
      }
      actions={<NovoProduto onSalvar={salvarNovoModelo} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Unidades em estoque" value={String(unidades)} icon={Boxes} tone="brand" />
        <StatCard
          label="Modelos cadastrados"
          value={String(base.length)}
          hint="Cada modelo reúne várias unidades"
          icon={Layers3}
        />
        <StatCard label="Custo imobilizado" value={brl(imobilizado)} icon={Tag} />
        <StatCard
          label="Reposição necessária"
          value={String(alertas.length)}
          hint="Modelos no estoque mínimo"
          icon={AlertTriangle}
          tone={alertas.length ? "warning" : "success"}
        />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Printer className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Etiquetas acompanham cada entrada</p>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Ao receber 10 unidades de um modelo, registre +10 e prepare as 10 etiquetas em uma
              única operação.
            </p>
          </div>
        </div>
        <span className="mt-3 inline-flex rounded-full border border-primary/15 bg-card px-3 py-1.5 text-xs font-medium text-primary sm:mt-0">
          Uma etiqueta por peça
        </span>
      </div>

      <SectionCard
        title="Catálogo de estoque"
        description={`${lista.length} ${lista.length === 1 ? "modelo encontrado" : "modelos encontrados"}`}
        padded={false}
      >
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar modelo, código ou cor"
              className={`${fieldCls} pl-9`}
            />
          </div>
          <select
            value={cat}
            onChange={(event) => setCat(event.target.value as "todas" | Categoria)}
            className={`${fieldCls} sm:w-44`}
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSomenteAlerta((ativo) => !ativo)}
            className={`h-10 rounded-xl border px-4 text-sm font-medium transition-colors ${
              somenteAlerta
                ? "border-warning bg-warning/15 text-warning-foreground"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            Só reposição
          </button>
        </div>

        <div className="divide-y divide-border">
          {lista.map((produto) => (
            <ProdutoEstoque
              key={produto.id}
              produto={produto}
              onEntrada={() => setEntrada(produto)}
              onEtiquetas={() => prepararEtiquetas(produto, 1)}
            />
          ))}
        </div>

        {lista.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Boxes className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Nenhum modelo encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajuste os filtros ou cadastre um novo modelo.
            </p>
          </div>
        )}
      </SectionCard>

      {entrada && (
        <EntradaEstoque
          key={entrada.id}
          produto={entrada}
          onClose={() => setEntrada(null)}
          onConfirmar={(quantidade, gerarEtiquetas) => {
            ajustarEstoque(entrada.id, quantidade);
            toast.success(
              `${quantidade} ${quantidade === 1 ? "unidade adicionada" : "unidades adicionadas"} ao estoque.`,
            );
            const produto = entrada;
            setEntrada(null);
            if (gerarEtiquetas) prepararEtiquetas(produto, quantidade);
          }}
        />
      )}

      {loteEtiquetas && (
        <EtiquetasDialog
          key={`${loteEtiquetas.produto.codigo}-${loteEtiquetas.quantidade}`}
          lote={loteEtiquetas}
          onClose={() => setLoteEtiquetas(null)}
        />
      )}
    </AppShell>
  );
}

function ProdutoEstoque({
  produto,
  onEntrada,
  onEtiquetas,
}: {
  produto: Produto;
  onEntrada: () => void;
  onEtiquetas: () => void;
}) {
  const baixo = produto.estoque <= produto.estoqueMinimo;

  return (
    <article className="p-4 transition-colors hover:bg-secondary/35 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(180px,.7fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={produto.loja === "kids" ? "brand" : "muted"}>
              {produto.loja === "kids" ? "Kids" : "Outlet"}
            </Chip>
            <Chip>{produto.categoria}</Chip>
            {baixo && (
              <Chip tone="warning">
                <AlertTriangle className="size-3" /> Repor
              </Chip>
            )}
          </div>
          <h3 className="mt-2 truncate font-display text-base font-semibold sm:text-lg">
            {produto.nome}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-mono text-foreground/80">{produto.codigo}</span>
            <span aria-hidden="true">•</span>
            <span>{produto.tamanho}</span>
            <span aria-hidden="true">•</span>
            <span>{produto.cor}</span>
            <span aria-hidden="true">•</span>
            <span>{brl(produto.preco)}</span>
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 lg:block lg:border-0 lg:bg-transparent lg:p-0">
          <div>
            <p className="eyebrow">Disponível</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${baixo ? "text-warning-foreground" : ""}`}
            >
              {produto.estoque}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">unidades</span>
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground lg:mt-1 lg:text-left">
            Mínimo: {produto.estoqueMinimo}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={onEntrada}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PackagePlus className="size-4" /> Dar entrada
          </button>
          <button
            type="button"
            onClick={onEtiquetas}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Printer className="size-4" /> Etiquetas
          </button>
        </div>
      </div>
    </article>
  );
}

function EntradaEstoque({
  produto,
  onClose,
  onConfirmar,
}: {
  produto: Produto;
  onClose: () => void;
  onConfirmar: (quantidade: number, gerarEtiquetas: boolean) => void;
}) {
  const [quantidade, setQuantidade] = useState(10);
  const [gerarEtiquetas, setGerarEtiquetas] = useState(true);
  const quantidadeValida = Math.max(1, Math.floor(quantidade || 1));

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar entrada</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Some novas unidades ao modelo e prepare as etiquetas do lote.
          </p>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-secondary/45 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{produto.nome}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {produto.codigo} · {produto.tamanho} · {produto.cor}
              </p>
            </div>
            <Chip>{produto.categoria}</Chip>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
          <div>
            <span className="eyebrow mb-1.5 block">Quantidade recebida</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade((valor) => Math.max(1, valor - 1))}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-secondary"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min="1"
                value={quantidade}
                onChange={(event) => setQuantidade(Number(event.target.value))}
                className={`${fieldCls} text-center text-base font-semibold tabular-nums`}
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade((valor) => valor + 1)}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-secondary"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-primary/15 bg-primary/[0.045] px-4 py-3">
            <p className="eyebrow">Estoque após entrada</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {produto.estoque}
              <span className="mx-1.5 text-sm font-normal text-muted-foreground">+</span>
              {quantidadeValida}
              <span className="mx-1.5 text-sm font-normal text-muted-foreground">=</span>
              <span className="text-primary">{produto.estoque + quantidadeValida}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={gerarEtiquetas}
          onClick={() => setGerarEtiquetas((ativo) => !ativo)}
          className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
            gerarEtiquetas
              ? "border-primary/30 bg-primary/[0.045]"
              : "border-border bg-card hover:bg-secondary/60"
          }`}
        >
          <span
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
              gerarEtiquetas
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card"
            }`}
          >
            {gerarEtiquetas && <Check className="size-3.5" />}
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Preparar {quantidadeValida} {quantidadeValida === 1 ? "etiqueta" : "etiquetas"}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              A quantidade de etiquetas acompanha automaticamente as unidades recebidas.
            </span>
          </span>
        </button>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(quantidadeValida, gerarEtiquetas)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <PackagePlus className="size-4" />
            {gerarEtiquetas ? "Confirmar e preparar etiquetas" : "Confirmar entrada"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EtiquetasDialog({ lote, onClose }: { lote: LoteEtiquetas; onClose: () => void }) {
  const [quantidade, setQuantidade] = useState(lote.quantidade);
  const [formato, setFormato] = useState("termica");
  const quantidadeValida = Math.max(1, Math.floor(quantidade || 1));
  const quantidadePreview = Math.min(quantidadeValida, 6);

  const imprimir = () => {
    toast.success(
      `${quantidadeValida} ${quantidadeValida === 1 ? "etiqueta preparada" : "etiquetas preparadas"} para impressão.`,
    );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preparar etiquetas</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Confira o lote e ajuste a quantidade antes de enviar para impressão.
          </p>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-secondary/45 p-4">
              <p className="eyebrow">Modelo selecionado</p>
              <p className="mt-2 text-sm font-semibold">{lote.produto.nome}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{lote.produto.codigo}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>{lote.produto.tamanho}</Chip>
                <Chip>{lote.produto.cor}</Chip>
              </div>
            </div>

            <Field label="Quantidade de etiquetas">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Diminuir quantidade de etiquetas"
                  onClick={() => setQuantidade((valor) => Math.max(1, valor - 1))}
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-secondary"
                >
                  <Minus className="size-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(event) => setQuantidade(Number(event.target.value))}
                  className={`${fieldCls} text-center font-semibold tabular-nums`}
                />
                <button
                  type="button"
                  aria-label="Aumentar quantidade de etiquetas"
                  onClick={() => setQuantidade((valor) => valor + 1)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-secondary"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </Field>

            <Field label="Formato de impressão">
              <select
                value={formato}
                onChange={(event) => setFormato(event.target.value)}
                className={fieldCls}
              >
                <option value="termica">Rolo térmico · 50 × 30 mm</option>
                <option value="a4">Folha A4 · 3 colunas</option>
              </select>
            </Field>

            <div className="flex items-start gap-2 rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">
              <Barcode className="mt-0.5 size-4 shrink-0 text-foreground" />O mesmo código do modelo
              será repetido nas {quantidadeValida} peças deste lote.
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/55 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Pré-visualização</p>
                <p className="text-xs text-muted-foreground">
                  {formato === "termica" ? "Rolo térmico 50 × 30 mm" : "Folha A4 em 3 colunas"}
                </p>
              </div>
              <Chip tone="brand">{quantidadeValida} no lote</Chip>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: quantidadePreview }).map((_, indice) => (
                <Etiqueta key={indice} produto={lote.produto} indice={indice + 1} />
              ))}
            </div>
            {quantidadeValida > quantidadePreview && (
              <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
                + {quantidadeValida - quantidadePreview} etiquetas iguais na sequência
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Printer className="size-4" /> Imprimir {quantidadeValida}{" "}
            {quantidadeValida === 1 ? "etiqueta" : "etiquetas"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Etiqueta({ produto, indice }: { produto: ProdutoEtiqueta; indice: number }) {
  return (
    <div className="aspect-[5/3] overflow-hidden rounded-md border border-dashed border-foreground/25 bg-white p-2 text-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[7px] font-black tracking-[0.16em]">
          {produto.loja === "kids" ? "PH KIDS" : "PH OUTLET"}
        </span>
        <span className="text-[6px] text-slate-500">#{indice}</span>
      </div>
      <p className="mt-1 truncate text-[7px] font-semibold">{produto.nome}</p>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-[6px] text-slate-600">
        <span>{produto.tamanho}</span>
        <span>{produto.cor}</span>
      </div>
      <div
        aria-label={`Código de barras ${produto.codigo}`}
        className="mt-1.5 h-4 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg,#0f172a 0 1px,transparent 1px 3px,#0f172a 3px 5px,transparent 5px 7px,#0f172a 7px 8px,transparent 8px 11px)",
        }}
      />
      <div className="mt-0.5 flex items-end justify-between gap-1">
        <span className="font-mono text-[6px] tracking-wide">{produto.codigo}</span>
        <span className="text-[8px] font-black">{brl(produto.preco)}</span>
      </div>
    </div>
  );
}

function NovoProduto({ onSalvar }: { onSalvar: (produto: NovoModelo, imprimir: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [imprimir, setImprimir] = useState(true);
  const [formulario, setFormulario] = useState({
    nome: "",
    categoria: "Camisetas" as Categoria,
    tamanho: "",
    cor: "",
    custo: "",
    preco: "",
    estoque: "",
    estoqueMinimo: "",
    loja: "outlet" as Loja,
  });

  const salvar = () => {
    if (!formulario.nome.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }

    const quantidade = Math.max(0, Math.floor(Number(formulario.estoque) || 0));
    const produto: NovoModelo = {
      codigo: `NOV-${String(Date.now()).slice(-5)}`,
      nome: formulario.nome.trim(),
      categoria: formulario.categoria,
      tamanho: formulario.tamanho.trim() || "Único",
      cor: formulario.cor.trim() || "—",
      custo: Number(formulario.custo) || 0,
      preco: Number(formulario.preco) || 0,
      estoque: quantidade,
      estoqueMinimo: Math.max(0, Math.floor(Number(formulario.estoqueMinimo) || 0)),
      loja: formulario.loja,
    };

    onSalvar(produto, imprimir);
    setOpen(false);
    setFormulario((atual) => ({
      ...atual,
      nome: "",
      tamanho: "",
      cor: "",
      custo: "",
      preco: "",
      estoque: "",
      estoqueMinimo: "",
    }));
  };

  const quantidadeInicial = Math.max(0, Math.floor(Number(formulario.estoque) || 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
        <Plus className="size-4" /> Novo modelo
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar modelo no estoque</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Um único cadastro reúne todas as unidades iguais recebidas pela loja.
          </p>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Loja">
            <select
              className={fieldCls}
              value={formulario.loja}
              onChange={(event) =>
                setFormulario({ ...formulario, loja: event.target.value as Loja })
              }
            >
              {LOJAS.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoria">
            <select
              className={fieldCls}
              value={formulario.categoria}
              onChange={(event) =>
                setFormulario({ ...formulario, categoria: event.target.value as Categoria })
              }
            >
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nome do modelo" className="sm:col-span-2">
            <input
              className={fieldCls}
              value={formulario.nome}
              onChange={(event) => setFormulario({ ...formulario, nome: event.target.value })}
              placeholder="Ex.: Bermuda tactel"
            />
          </Field>
          <Field label="Tamanho / variação">
            <input
              className={fieldCls}
              value={formulario.tamanho}
              onChange={(event) => setFormulario({ ...formulario, tamanho: event.target.value })}
              placeholder="M / 42 / 6 anos"
            />
          </Field>
          <Field label="Cor">
            <input
              className={fieldCls}
              value={formulario.cor}
              onChange={(event) => setFormulario({ ...formulario, cor: event.target.value })}
              placeholder="Ex.: Azul marinho"
            />
          </Field>
          <Field label="Custo unitário (R$)">
            <input
              type="number"
              min="0"
              className={fieldCls}
              value={formulario.custo}
              onChange={(event) => setFormulario({ ...formulario, custo: event.target.value })}
            />
          </Field>
          <Field label="Preço de venda (R$)">
            <input
              type="number"
              min="0"
              className={fieldCls}
              value={formulario.preco}
              onChange={(event) => setFormulario({ ...formulario, preco: event.target.value })}
            />
          </Field>
          <Field label="Quantidade inicial">
            <input
              type="number"
              min="0"
              className={fieldCls}
              value={formulario.estoque}
              onChange={(event) => setFormulario({ ...formulario, estoque: event.target.value })}
              placeholder="Ex.: 40"
            />
          </Field>
          <Field label="Estoque mínimo">
            <input
              type="number"
              min="0"
              className={fieldCls}
              value={formulario.estoqueMinimo}
              onChange={(event) =>
                setFormulario({ ...formulario, estoqueMinimo: event.target.value })
              }
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-secondary/45 px-4 py-3">
          <div className="flex items-center gap-2">
            <Barcode className="size-4 text-primary" />
            <p className="text-sm font-medium">Código do modelo</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Será associado automaticamente ao cadastro e repetido em todas as peças iguais.
          </p>
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={imprimir}
          onClick={() => setImprimir((ativo) => !ativo)}
          className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${
            imprimir ? "border-primary/30 bg-primary/[0.045]" : "border-border"
          }`}
        >
          <span
            className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
              imprimir
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card"
            }`}
          >
            {imprimir && <Check className="size-3.5" />}
          </span>
          <span>
            <span className="block text-sm font-semibold">Preparar etiquetas após cadastrar</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {quantidadeInicial > 0
                ? `${quantidadeInicial} etiquetas serão abertas para conferência.`
                : "A quantidade seguirá o estoque inicial informado."}
            </span>
          </span>
        </button>

        <DialogFooter>
          <button
            type="button"
            onClick={salvar}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" /> Cadastrar modelo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
