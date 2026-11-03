import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell title="Página não encontrada">
      <section className="card-surface space-y-4 p-5">
        <p>Este endereço não está disponível.</p>
        <Link className="text-brand underline" href="/">
          Voltar ao painel
        </Link>
      </section>
    </AppShell>
  );
}
