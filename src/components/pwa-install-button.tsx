"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [ios, setIos] = useState(false);
  const [instalado, setInstalado] = useState(true);

  useEffect(() => {
    const modoApp = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setInstalado(modoApp);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !modoApp);
    const antesDeInstalar = (recebido: Event) => { recebido.preventDefault(); setEvento(recebido as EventoInstalacao); };
    const instaladoAgora = () => { setInstalado(true); setEvento(null); };
    window.addEventListener("beforeinstallprompt", antesDeInstalar);
    window.addEventListener("appinstalled", instaladoAgora);
    return () => {
      window.removeEventListener("beforeinstallprompt", antesDeInstalar);
      window.removeEventListener("appinstalled", instaladoAgora);
    };
  }, []);

  if (instalado || (!evento && !ios)) return null;
  const instalar = async () => {
    if (evento) {
      await evento.prompt();
      const escolha = await evento.userChoice;
      if (escolha.outcome === "accepted") setEvento(null);
      return;
    }
    window.alert("No Safari, toque em Compartilhar e depois em ‘Adicionar à Tela de Início’.");
  };
  return <button type="button" onClick={() => void instalar()}
    className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card transition-colors hover:bg-secondary"
    aria-label="Instalar aplicativo" title="Instalar aplicativo">
    <Download className="size-[18px]" />
  </button>;
}
