"use client";

import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/features/workspace/contexto";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <WorkspaceProvider>
      <AppShell title="Não foi possível carregar">
        <section role="alert" className="card-surface space-y-4 p-5">
          <p>Nenhuma operação foi confirmada. Tente novamente.</p>
          <button type="button" className="rounded-xl bg-primary px-4 py-2 text-primary-foreground" onClick={reset}>
            Tentar novamente
          </button>
        </section>
      </AppShell>
    </WorkspaceProvider>
  );
}
