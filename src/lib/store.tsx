import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import * as seed from "./mock-data";
import { HOJE } from "./mock-data";
import type {
  Cliente,
  Colaborador,
  Despesa,
  ItemVenda,
  Loja,
  Produto,
  Venda,
} from "./mock-data";

export type Escopo = Loja | "todas";

type NovaVenda = {
  loja: Loja;
  clienteId: string | null;
  clienteAvulso?: string | undefined;
  vendedorId: string;
  itens: ItemVenda[];
  desconto: number;
  pagamento: Venda["pagamento"];
};

type Store = {
  escopo: Escopo;
  setEscopo: (e: Escopo) => void;
  produtos: Produto[];
  clientes: Cliente[];
  vendas: Venda[];
  despesas: Despesa[];
  colaboradores: Colaborador[];
  usuario: Colaborador;
  ajustarEstoque: (id: string, delta: number) => void;
  addProduto: (p: Omit<Produto, "id">) => void;
  addCliente: (c: Omit<Cliente, "id" | "desde">) => string;
  addDespesa: (d: Omit<Despesa, "id">) => void;
  registrarVenda: (v: NovaVenda) => void;
  addColaborador: (c: Omit<Colaborador, "id" | "desde">) => void;
  updateColaborador: (id: string, patch: Partial<Omit<Colaborador, "id">>) => void;
  nomeCliente: (id: string | null, avulso?: string) => string;
  nomeColaborador: (id: string) => string;
};

const StoreContext = createContext<Store | null>(null);

const uid = () => Math.random().toString(36).slice(2, 9);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [escopo, setEscopo] = useState<Escopo>("todas");
  const [produtos, setProdutos] = useState<Produto[]>(seed.produtos);
  const [clientes, setClientes] = useState<Cliente[]>(seed.clientes);
  const [vendas, setVendas] = useState<Venda[]>(seed.vendas);
  const [despesas, setDespesas] = useState<Despesa[]>(seed.despesas);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(seed.colaboradores);

  const value = useMemo<Store>(() => {
    const usuario = colaboradores[0]!;
    return {
      escopo,
      setEscopo,
      produtos,
      clientes,
      vendas,
      despesas,
      colaboradores,
      usuario,
      ajustarEstoque: (id, delta) =>
        setProdutos((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, estoque: Math.max(0, p.estoque + delta) } : p,
          ),
        ),
      addProduto: (p) => setProdutos((prev) => [{ ...p, id: uid() }, ...prev]),
      addCliente: (c) => {
        const id = uid();
        setClientes((prev) => [{ ...c, id, desde: HOJE }, ...prev]);
        return id;
      },
      addDespesa: (d) => setDespesas((prev) => [{ ...d, id: uid() }, ...prev]),
      registrarVenda: (v) => {
        const total =
          v.itens.reduce((s, i) => s + i.qtd * i.precoUnit, 0) - v.desconto;
        setVendas((prev) => [
          { ...v, id: uid(), data: HOJE, total: Math.max(0, total) },
          ...prev,
        ]);
        setProdutos((prev) =>
          prev.map((p) => {
            const it = v.itens.find((i) => i.produtoId === p.id);
            return it ? { ...p, estoque: Math.max(0, p.estoque - it.qtd) } : p;
          }),
        );
      },
      addColaborador: (c) =>
        setColaboradores((prev) => [...prev, { ...c, id: uid(), desde: HOJE }]),
      updateColaborador: (id, patch) =>
        setColaboradores((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
      nomeCliente: (id, avulso) =>
        id ? (clientes.find((c) => c.id === id)?.nome ?? "—") : (avulso ?? "Não identificado"),
      nomeColaborador: (id) => colaboradores.find((c) => c.id === id)?.nome ?? "—",
    };
  }, [escopo, produtos, clientes, vendas, despesas, colaboradores]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}

/** Filtra qualquer lista com campo `loja` pelo escopo selecionado. */
export function porEscopo<T extends { loja: Loja }>(itens: T[], escopo: Escopo) {
  return escopo === "todas" ? itens : itens.filter((i) => i.loja === escopo);
}
