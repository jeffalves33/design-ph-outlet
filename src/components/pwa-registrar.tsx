"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let recarregarAoAtivar = false;
    const aoTrocarControle = () => { if (recarregarAoAtivar) window.location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", aoTrocarControle);

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registro) => {
      const oferecerAtualizacao = (worker: ServiceWorker) => toast("Nova versão disponível.", {
        duration: Infinity,
        action: { label: "Atualizar", onClick: () => {
          recarregarAoAtivar = true;
          worker.postMessage({ tipo: "ATIVAR_ATUALIZACAO" });
        } },
      });
      if (registro.waiting) oferecerAtualizacao(registro.waiting);
      registro.addEventListener("updatefound", () => {
        const worker = registro.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) oferecerAtualizacao(worker);
        });
      });
    }).catch(() => { /* A aplicação online continua funcional sem registro PWA. */ });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", aoTrocarControle);
  }, []);
  return null;
}
