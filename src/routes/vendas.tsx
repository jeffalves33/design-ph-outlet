import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingBag, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Chip, Field, SectionCard, fieldCls } from "@/components/form-bits";
import { StatCard } from "@/components/stat-card";
import {
  HOJE,
  LOJAS,
  brl,
  dataCurta,
  nomeLoja,
  type ItemVenda,
  type Loja,
  type Venda,
} from "@/lib/mock-data";
import { porEscopo, useStore } from "@/lib/store";

const pagamentos: Venda["pagamento"][] = ["Pix", "Débito", "Crédito", "Dinheiro"];

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas · PH Outlet" },
      {
        name: "description",
        content:
          "Registre vendas das lojas PH Outlet e PH Outlet Kids por código de produto, com ou sem identificação do cliente, e alimente o histórico do CRM.",
      },
      { property: "og:title", content: "Vendas · PH Outlet" },
      {
        property: "og:description",
        content:
          "Venda rápida no balcão: leitura por código, desconto, forma de pagamento e vínculo opcional com o cliente.",
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
    usuario,
    registrarVenda,
    addCliente,
    nomeCliente,
    nomeColaborador,
  } = useStore();

  const lojaInicial: Loja = escopo === "todas" ? "outlet" : escopo;
  const [loja, setLoja] = useState<Loja>(lojaInicial);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [codigo, setCodigo] = useState("");
  const [qtd, setQtd] = useState("1");
  const [clienteId, setClienteId] = useState<string>("");
  const [pagamento, setPagamento] = useState<Venda["pagamento"]>("Pix");
  const [desconto, setDesconto] = useState("");
  const [vendedorId, setVendedorId] = useState(usuario.id);
  const [novo, setNovo] = useState({ nome: "", telefone: "", nascimento: "", cidade: "" });
  const [modoNovo, setModoNovo] = useState(false);

  const disponiveis = produtos.filter((p) => p.loja === loja);
  const subtotal = itens.reduce((s, i) => s + i.qtd * i.precoUnit, 0);
  const total = Math.max(0, subtotal - (Number(desconto) || 0));

  const historico = porEscopo(vendas, escopo);
  const hoje = historico.filter((v) => v.data === HOJE);
  const receitaHoje = hoje.reduce((s, v) => s + v.total, 0);

  const adicionar = () => {
    const p = disponiveis.find(
      (x) => x.codigo.toLowerCase() === codigo.trim().toLowerCase(),
    );
    if (!p) {
      toast.error("Código não encontrado nesta loja.");
      return;
    }
    const q = Math.max(1, Number(qtd) || 1);
    if (q > p.estoque) {
      toast.error(`Só há ${p.estoque} unidades de ${p.codigo} em estoque.`);
      return;
    }
    setItens((prev) => {
      const existente = prev.find((i) => i.produtoId === p.id);
      if (existente)
        return prev.map((i) =>
          i.produtoId === p.id ? { ...i, qtd: i.qtd + q } : i,
        );
      return [
        ...prev,
        { produtoId: p.id, codigo: p.codigo, nome: p.nome, qtd: q, precoUnit: p.preco },
      ];
    });
    setCodigo("");
    setQtd("1");
  };

  const finalizar = () => {
    if (itens.length === 0) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }
    let idCliente: string | null = clienteId || null;
    if (modoNovo) {
      if (!novo.nome.trim()) {
        toast.error("Informe o nome do novo cliente.");
        return;
      }
      idCliente = addCliente({
        nome: novo.nome.trim(),
        telefone: novo.telefone.trim() || "—",
        nascimento: novo.nascimento || "1990-01-01",
        cidade: novo.cidade.trim() || "—",
        lojaPreferida: loja,
      });
    }
    registrarVenda({
      loja,
      clienteId: idCliente,
      clienteAvulso: idCliente ? undefined : "Cliente não identificado",
      vendedorId,
      itens,
      desconto: Number(desconto) || 0,
      pagamento,
    });
    toast.success(`Venda de ${brl(total)} registrada.`);
    setItens([]);
    setDesconto("");
    setClienteId("");
    setModoNovo(false);
    setNovo({ nome: "", telefone: "", nascimento: "", cidade: "" });
  };

  const sugestoes = useMemo(
    () => disponiveis.slice(0, 6),
    [disponiveis],
  );

  return (
    <AppShell
      title="Vendas"
      subtitle="Registre a venda pelo código da peça e vincule (ou não) um cliente"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Vendas de hoje"
          value={String(hoje.length)}
          icon={ShoppingBag}
          tone="brand"
        />
        <StatCard label="Faturado hoje" value={brl(receitaHoje)} icon={ShoppingBag} tone="success" />
        <StatCard
          label="Peças na sacola atual"
          value={String(itens.reduce((s, i) => s + i.qtd, 0))}
          icon={Plus}
        />
        <StatCard label="Total da venda atual" value={brl(total)} icon={ShoppingBag} />
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SectionCard title="Nova venda" description="Loja, produtos e pagamento">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loja da venda">
              <select
                className={fieldCls}
                value={loja}
                onChange={(e) => {
                  setLoja(e.target.value as Loja);
                  setItens([]);
                }}
              >
                {LOJAS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vendedor">
              <select
                className={fieldCls}
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
              >
                {colaboradores
                  .filter((c) => c.ativo && c.lojas.includes(loja))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-end">
            <Field label="Código do produto">
              <input
                className={fieldCls}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionar()}
                placeholder="OUT-1001"
              />
            </Field>
            <Field label="Qtd.">
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
              />
            </Field>
            <button
              type="button"
              onClick={adicionar}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Adicionar
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {sugestoes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCodigo(p.codigo)}
                className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-secondary-foreground transition-colors hover:bg-accent"
              >
                {p.codigo}
              </button>
            ))}
          </div>

          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {itens.map((i) => (
              <li key={i.produtoId} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.nome}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {i.codigo} · {i.qtd} × {brl(i.precoUnit)}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {brl(i.qtd * i.precoUnit)}
                </span>
                <button
                  type="button"
                  aria-label="Remover item"
                  onClick={() =>
                    setItens((prev) => prev.filter((x) => x.produtoId !== i.produtoId))
                  }
                  className="grid size-8 place-items-center rounded-lg border border-border transition-colors hover:bg-secondary"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
            {itens.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                Nenhum item na venda ainda.
              </li>
            )}
          </ul>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Desconto (R$)">
              <input
                type="number"
                className={fieldCls}
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
              />
            </Field>
            <Field label="Forma de pagamento">
              <select
                className={fieldCls}
                value={pagamento}
                onChange={(e) => setPagamento(e.target.value as Venda["pagamento"])}
              >
                {pagamentos.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4">
            <div>
              <p className="eyebrow">Total da venda</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{brl(total)}</p>
              <p className="text-xs text-muted-foreground">
                Subtotal {brl(subtotal)} · desconto {brl(Number(desconto) || 0)}
              </p>
            </div>
            <button
              type="button"
              onClick={finalizar}
              className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Finalizar venda
            </button>
          </div>
        </SectionCard>

        <div className="space-y-4 sm:space-y-5">
          <SectionCard
            title="Cliente"
            description="Opcional — vincular alimenta o histórico no CRM"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModoNovo(false)}
                className={`h-9 flex-1 rounded-xl border text-sm transition-colors ${
                  !modoNovo ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                Cliente existente
              </button>
              <button
                type="button"
                onClick={() => setModoNovo(true)}
                className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors ${
                  modoNovo ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                <UserPlus className="size-3.5" /> Cadastrar
              </button>
            </div>

            {modoNovo ? (
              <div className="mt-3 grid gap-3">
                <Field label="Nome">
                  <input
                    className={fieldCls}
                    value={novo.nome}
                    onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    className={fieldCls}
                    value={novo.telefone}
                    onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
                  />
                </Field>
                <Field label="Aniversário">
                  <input
                    type="date"
                    className={fieldCls}
                    value={novo.nascimento}
                    onChange={(e) => setNovo({ ...novo, nascimento: e.target.value })}
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    className={fieldCls}
                    value={novo.cidade}
                    onChange={(e) => setNovo({ ...novo, cidade: e.target.value })}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-3">
                <Field label="Selecionar cliente">
                  <select
                    className={fieldCls}
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                  >
                    <option value="">Venda sem identificação</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sem cliente selecionado, a venda entra como “não identificada” no caixa.
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Histórico recente" description="Últimas vendas" padded={false}>
            <ul className="divide-y divide-border">
              {historico.slice(0, 7).map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {nomeCliente(v.clienteId, v.clienteAvulso)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dataCurta(v.data)} · {nomeLoja(v.loja)} · {nomeColaborador(v.vendedorId)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{brl(v.total)}</p>
                      <Chip tone="muted">{v.pagamento}</Chip>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
