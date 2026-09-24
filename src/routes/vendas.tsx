import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  Barcode,
  Check,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Trash2,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HOJE,
  LOJAS,
  brl,
  dataCurta,
  nomeLoja,
  type ItemVenda,
  type Loja,
  type Produto,
  type Venda,
} from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

const pagamentos: { id: Venda["pagamento"]; label: string; icon: typeof QrCode }[] = [
  { id: "Pix", label: "Pix", icon: QrCode },
  { id: "Débito", label: "Débito", icon: CreditCard },
  { id: "Crédito", label: "Crédito", icon: WalletCards },
  { id: "Dinheiro", label: "Dinheiro", icon: Banknote },
];

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Frente de caixa · PH Outlet" },
      {
        name: "description",
        content:
          "Frente de caixa para leitura de produtos, montagem da sacola e finalização de vendas.",
      },
    ],
  }),
  component: Vendas,
});

function Vendas() {
  const {
    produtos,
    clientes,
    vendas,
    colaboradores,
    escopo,
    setEscopo,
    registrarVenda,
    addCliente,
    nomeCliente,
  } = useStore();

  const lojaInicial: Loja = escopo === "todas" ? "outlet" : escopo;
  const vendedoresDaLoja = (id: Loja) =>
    colaboradores.filter((c) => c.ativo && c.cargo === "Vendedor" && c.lojas.includes(id));

  const [loja, setLoja] = useState<Loja>(lojaInicial);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [codigo, setCodigo] = useState("");
  const [qtd, setQtd] = useState("1");
  const [clienteId, setClienteId] = useState("");
  const [pagamento, setPagamento] = useState<Venda["pagamento"]>("Pix");
  const [desconto, setDesconto] = useState("");
  const [vendedorId, setVendedorId] = useState(vendedoresDaLoja(lojaInicial)[0]?.id ?? "");
  const [ultimaLeitura, setUltimaLeitura] = useState<Produto | null>(null);
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novo, setNovo] = useState({
    nome: "",
    telefone: "",
    nascimento: "",
    cidade: "",
  });
  const codigoRef = useRef<HTMLInputElement>(null);

  const disponiveis = produtos.filter((p) => p.loja === loja);
  const vendedores = vendedoresDaLoja(loja);
  const subtotal = itens.reduce((soma, item) => soma + item.qtd * item.precoUnit, 0);
  const valorDesconto = Math.min(subtotal, Math.max(0, Number(desconto) || 0));
  const total = subtotal - valorDesconto;
  const totalPecas = itens.reduce((soma, item) => soma + item.qtd, 0);

  const historico = porEscopo(vendas, escopo);
  const hoje = historico.filter((venda) => venda.data === HOJE);
  const receitaHoje = hoje.reduce((soma, venda) => soma + venda.total, 0);
  const sugestoes = useMemo(() => disponiveis.slice(0, 8), [disponiveis]);

  useEffect(() => {
    if (escopo === "todas" || escopo === loja) return;
    setLoja(escopo);
    setItens([]);
    setUltimaLeitura(null);
    const primeiroVendedor = colaboradores.find(
      (c) => c.ativo && c.cargo === "Vendedor" && c.lojas.includes(escopo),
    );
    setVendedorId(primeiroVendedor?.id ?? "");
  }, [colaboradores, escopo, loja]);

  const focarLeitor = () => requestAnimationFrame(() => codigoRef.current?.focus());

  const adicionar = () => {
    const leitura = codigo.trim();
    if (!leitura) return;

    const produto = disponiveis.find((item) => item.codigo.toLowerCase() === leitura.toLowerCase());
    if (!produto) {
      toast.error("Código não encontrado nesta loja.");
      setCodigo("");
      focarLeitor();
      return;
    }

    const quantidade = Math.max(1, Number(qtd) || 1);
    const jaNaSacola = itens.find((item) => item.produtoId === produto.id)?.qtd ?? 0;
    if (jaNaSacola + quantidade > produto.estoque) {
      toast.error(`Estoque disponível: ${produto.estoque} un. de ${produto.codigo}.`);
      setCodigo("");
      focarLeitor();
      return;
    }

    setItens((atuais) => {
      const existente = atuais.find((item) => item.produtoId === produto.id);
      if (existente) {
        return atuais.map((item) =>
          item.produtoId === produto.id ? { ...item, qtd: item.qtd + quantidade } : item,
        );
      }
      return [
        ...atuais,
        {
          produtoId: produto.id,
          codigo: produto.codigo,
          nome: produto.nome,
          qtd: quantidade,
          precoUnit: produto.preco,
        },
      ];
    });
    setUltimaLeitura(produto);
    setCodigo("");
    setQtd("1");
    focarLeitor();
  };

  const alterarQuantidade = (produtoId: string, delta: number) => {
    const item = itens.find((atual) => atual.produtoId === produtoId);
    const produto = produtos.find((atual) => atual.id === produtoId);
    if (!item || !produto) return;
    const proxima = item.qtd + delta;
    if (proxima > produto.estoque) {
      toast.error(`Limite do estoque: ${produto.estoque} unidades.`);
      return;
    }
    if (proxima <= 0) {
      setItens((atuais) => atuais.filter((atual) => atual.produtoId !== produtoId));
      return;
    }
    setItens((atuais) =>
      atuais.map((atual) => (atual.produtoId === produtoId ? { ...atual, qtd: proxima } : atual)),
    );
  };

  const trocarLoja = (novaLoja: Loja) => {
    if (itens.length > 0) {
      toast.info("A sacola foi limpa ao trocar de loja.");
    }
    setLoja(novaLoja);
    setEscopo(novaLoja);
    setItens([]);
    setUltimaLeitura(null);
    setVendedorId(vendedoresDaLoja(novaLoja)[0]?.id ?? "");
    focarLeitor();
  };

  const cadastrarCliente = () => {
    if (!novo.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const id = addCliente({
      nome: novo.nome.trim(),
      telefone: novo.telefone.trim() || "—",
      nascimento: novo.nascimento || "1990-01-01",
      cidade: novo.cidade.trim() || "—",
      lojaPreferida: loja,
    });
    setClienteId(id);
    setNovoClienteAberto(false);
    setNovo({ nome: "", telefone: "", nascimento: "", cidade: "" });
    toast.success("Cliente cadastrado e vinculado à venda.");
  };

  const finalizar = () => {
    if (itens.length === 0) {
      toast.error("Leia pelo menos um produto antes de finalizar.");
      focarLeitor();
      return;
    }
    if (!vendedorId) {
      toast.error("Selecione o vendedor responsável.");
      return;
    }

    registrarVenda({
      loja,
      clienteId: clienteId || null,
      clienteAvulso: clienteId ? undefined : "Cliente não identificado",
      vendedorId,
      itens,
      desconto: valorDesconto,
      pagamento,
    });
    toast.success(`Venda de ${brl(total)} finalizada com sucesso.`);
    setItens([]);
    setDesconto("");
    setClienteId("");
    setUltimaLeitura(null);
    setPagamento("Pix");
    focarLeitor();
  };

  return (
    <AppShell
      title="Frente de caixa"
      subtitle="Leia as peças, confira a sacola e finalize a venda"
      actions={
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs">
          <span className="size-2 rounded-full bg-success shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-success)_15%,transparent)]" />
          Caixa pronto
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <ResumoRapido icon={ShoppingBag} label="Vendas de hoje" value={String(hoje.length)} />
        <ResumoRapido icon={ReceiptText} label="Faturado hoje" value={brl(receitaHoje)} />
        <ResumoRapido
          icon={PackageCheck}
          label="Sacola atual"
          value={`${totalPecas} ${totalPecas === 1 ? "peça" : "peças"}`}
        />
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
                  O campo volta a ficar pronto após cada leitura
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Loja:</span>
                <select
                  value={loja}
                  onChange={(event) => trocarLoja(event.target.value as Loja)}
                  className="h-9 rounded-xl border border-input bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {LOJAS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
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
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        adicionar();
                      }
                    }}
                    className="h-14 w-full rounded-2xl border-2 border-brand/35 bg-card pr-4 pl-12 font-mono text-base font-medium tracking-wide outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/65 focus:border-brand focus:ring-4 focus:ring-brand/10"
                    placeholder="Leia ou digite o código da peça"
                    aria-label="Código do produto"
                  />
                </label>
                <input
                  type="number"
                  min={1}
                  value={qtd}
                  onChange={(event) => setQtd(event.target.value)}
                  className="h-14 rounded-2xl border border-input bg-card px-3 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/40"
                  aria-label="Quantidade"
                  title="Quantidade"
                />
                <button
                  type="button"
                  onClick={adicionar}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="size-4" /> Adicionar
                </button>
              </div>

              <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2">
                {ultimaLeitura ? (
                  <>
                    <Chip tone="success">
                      <Check className="size-3" /> Lido com sucesso
                    </Chip>
                    <p className="truncate text-xs text-muted-foreground">
                      {ultimaLeitura.codigo} · {ultimaLeitura.nome} · {brl(ultimaLeitura.preco)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pressione Enter ao final do código — leitores de código de barras fazem isso
                    automaticamente.
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="mr-1 self-center text-[11px] text-muted-foreground">
                  Testar com:
                </span>
                {sugestoes.map((produto) => (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => {
                      setCodigo(produto.codigo);
                      focarLeitor();
                    }}
                    className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-secondary-foreground transition-colors hover:bg-accent"
                  >
                    {produto.codigo}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <SectionCard
            title="Sacola da venda"
            description={
              itens.length
                ? `${itens.length} ${itens.length === 1 ? "produto" : "produtos"} · ${totalPecas} ${totalPecas === 1 ? "peça" : "peças"}`
                : "Os produtos lidos aparecem aqui"
            }
            actions={
              itens.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setItens([]);
                    setUltimaLeitura(null);
                    focarLeitor();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                >
                  <X className="size-3.5" /> Limpar sacola
                </button>
              ) : null
            }
            padded={false}
          >
            {itens.length > 0 ? (
              <div className="divide-y divide-border">
                {itens.map((item, indice) => {
                  const produto = produtos.find((atual) => atual.id === item.produtoId);
                  return (
                    <article
                      key={item.produtoId}
                      className="grid gap-3 px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"
                    >
                      <span className="hidden font-display text-xs font-semibold text-muted-foreground sm:block">
                        {String(indice + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.nome}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {item.codigo} · {brl(item.precoUnit)} cada · {produto?.estoque ?? 0} em
                          estoque
                        </p>
                      </div>
                      <div className="flex h-9 items-center rounded-xl border border-border bg-card">
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(item.produtoId, -1)}
                          className="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Diminuir quantidade de ${item.nome}`}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
                          {item.qtd}
                        </span>
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(item.produtoId, 1)}
                          className="grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Aumentar quantidade de ${item.nome}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:min-w-28 sm:justify-end">
                        <p className="text-sm font-semibold tabular-nums">
                          {brl(item.qtd * item.precoUnit)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setItens((atuais) =>
                              atuais.filter((atual) => atual.produtoId !== item.produtoId),
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remover ${item.nome}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-56 place-items-center px-4 py-10 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
                    <ShoppingBag className="size-6" />
                  </span>
                  <p className="mt-4 text-sm font-medium">A sacola está vazia</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Comece lendo o código de uma peça acima.
                  </p>
                </div>
              </div>
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
              <Chip tone={itens.length ? "brand" : "muted"}>
                {totalPecas} {totalPecas === 1 ? "peça" : "peças"}
              </Chip>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <Field label="Vendedor responsável">
              <select
                className={fieldCls}
                value={vendedorId}
                onChange={(event) => setVendedorId(event.target.value)}
              >
                {vendedores.length === 0 && <option value="">Nenhum vendedor disponível</option>}
                {vendedores.map((vendedor) => (
                  <option key={vendedor.id} value={vendedor.id}>
                    {vendedor.nome}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="eyebrow">Cliente</p>
                <button
                  type="button"
                  onClick={() => setNovoClienteAberto(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-foreground hover:underline"
                >
                  <UserPlus className="size-3" /> Novo cliente
                </button>
              </div>
              <select
                className={fieldCls}
                value={clienteId}
                onChange={(event) => setClienteId(event.target.value)}
              >
                <option value="">Cliente não identificado</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="eyebrow mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {pagamentos.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPagamento(id)}
                    className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
                      pagamento === id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Desconto (R$)">
              <input
                type="number"
                min={0}
                max={subtotal}
                step="0.01"
                className={fieldCls}
                value={desconto}
                onChange={(event) => setDesconto(event.target.value)}
                placeholder="0,00"
              />
            </Field>

            <div className="space-y-2 border-t border-border pt-4 text-sm">
              <LinhaTotal label="Subtotal" value={brl(subtotal)} />
              <LinhaTotal label="Desconto" value={`− ${brl(valorDesconto)}`} muted />
              <div className="flex items-end justify-between gap-4 pt-2">
                <div>
                  <p className="eyebrow">Total a cobrar</p>
                  <p className="mt-1 text-xs text-muted-foreground">{pagamento}</p>
                </div>
                <p className="font-display text-2xl font-semibold tabular-nums">{brl(total)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={finalizar}
              disabled={itens.length === 0 || !vendedorId}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ReceiptText className="size-4" /> Finalizar venda · {brl(total)}
            </button>

            <p className="text-center text-[11px] leading-4 text-muted-foreground">
              Ao finalizar, a venda entra no histórico do vendedor e o estoque mock é atualizado.
            </p>
          </div>

          {historico[0] && (
            <div className="border-t border-border bg-secondary/45 px-4 py-3 sm:px-5">
              <p className="eyebrow">Última venda</p>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">
                    {nomeCliente(historico[0].clienteId, historico[0].clienteAvulso)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {dataCurta(historico[0].data)} · {nomeLoja(historico[0].loja)}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums">
                  {brl(historico[0].total)}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={novoClienteAberto} onOpenChange={setNovoClienteAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
            <p className="text-sm text-muted-foreground">
              O novo cliente será selecionado nesta venda.
            </p>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <input
                autoFocus
                className={fieldCls}
                value={novo.nome}
                onChange={(event) => setNovo({ ...novo, nome: event.target.value })}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                className={fieldCls}
                value={novo.telefone}
                onChange={(event) => setNovo({ ...novo, telefone: event.target.value })}
              />
            </Field>
            <Field label="Aniversário">
              <input
                type="date"
                className={fieldCls}
                value={novo.nascimento}
                onChange={(event) => setNovo({ ...novo, nascimento: event.target.value })}
              />
            </Field>
            <Field label="Cidade" className="sm:col-span-2">
              <input
                className={fieldCls}
                value={novo.cidade}
                onChange={(event) => setNovo({ ...novo, cidade: event.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setNovoClienteAberto(false)}
              className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={cadastrarCliente}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Cadastrar e selecionar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ResumoRapido({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="card-surface flex items-center gap-3 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-display text-base font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function LinhaTotal({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
