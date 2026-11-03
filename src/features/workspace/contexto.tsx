"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type LojaWorkspace = Readonly<{ id: string; nome: string }>;
export type EscopoWorkspace = "todas" | string;
type EstadoWorkspace = Readonly<{
  escopo: EscopoWorkspace;
  lojas: readonly LojaWorkspace[];
  setEscopo: (escopo: EscopoWorkspace) => void;
  setLojas: (lojas: readonly LojaWorkspace[]) => void;
}>;

const Contexto = createContext<EstadoWorkspace | null>(null);
const CHAVE_ESCOPO = "prodexy.loja-em-exibicao";
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
  const lojasRef = useRef<readonly LojaWorkspace[]>([]);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CHAVE_ESCOPO);
      if (guardado) {
        const valido = guardado === "todas" || lojasRef.current.length === 0 ||
          lojasRef.current.some((loja) => loja.id === guardado);
        setEscopo(valido ? guardado : "todas");
      }
    } catch { /* o seletor continua funcional apenas durante a sessão */ }
  }, []);
  const alterarEscopo = useCallback((proximo: EscopoWorkspace) => {
    const valido = proximo === "todas" || lojasRef.current.some((loja) => loja.id === proximo);
    const normalizado = valido ? proximo : "todas";
    setEscopo(normalizado);
    try { window.localStorage.setItem(CHAVE_ESCOPO, normalizado); } catch { /* sem persistência local */ }
  }, []);
  const setLojas = useCallback((proximas: readonly LojaWorkspace[]) => {
    lojasRef.current = proximas;
    setLojasEstado(proximas);
    setEscopo((atual) => {
      const proximo = atual === "todas" || proximas.some((loja) => loja.id === atual) ? atual : "todas";
      if (proximo !== atual) {
        try { window.localStorage.setItem(CHAVE_ESCOPO, proximo); } catch { /* sem persistência local */ }
      }
      return proximo;
    });
  }, []);
  const valor = useMemo(() => ({ escopo, lojas, setEscopo: alterarEscopo, setLojas }),
    [alterarEscopo, escopo, lojas, setLojas]);
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
