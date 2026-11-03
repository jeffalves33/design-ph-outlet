import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return (
    <AppShell title="Carregando">
      <div role="status" className="card-surface p-5 text-sm text-muted-foreground">
        Carregando a página…
      </div>
    </AppShell>
  );
}
