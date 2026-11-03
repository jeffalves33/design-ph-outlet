"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type LojaWorkspace = Readonly<{ id: string; nome: string }>;
export type EscopoWorkspace = "todas" | string;
type EstadoWorkspace = Readonly<{
  escopo: EscopoWorkspace;
  lojas: readonly LojaWorkspace[];
  setEscopo: (escopo: EscopoWorkspace) => void;
  setLojas: (lojas: readonly LojaWorkspace[]) => void;
}>;

const Contexto = createContext<EstadoWorkspace | null>(null);
const ignorarEscopo = () => {};
const ignorarLojas = () => {};
const workspaceVazio: EstadoWorkspace = {
  escopo: "todas",
  lojas: [],
  setEscopo: ignorarEscopo,
  setLojas: ignorarLojas,
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [escopo, setEscopo] = useState<EscopoWorkspace>("todas");
  const [lojas, setLojasEstado] = useState<readonly LojaWorkspace[]>([]);
  const setLojas = useCallback((proximas: readonly LojaWorkspace[]) => {
    setLojasEstado(proximas);
    setEscopo((atual) => atual === "todas" || proximas.some((loja) => loja.id === atual)
      ? atual : "todas");
  }, []);
  const valor = useMemo(() => ({ escopo, lojas, setEscopo, setLojas }), [escopo, lojas, setLojas]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useWorkspace() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("WorkspaceProvider ausente.");
  return contexto;
}

export function useWorkspaceOpcional() {
  return useContext(Contexto) ?? workspaceVazio;
}
