import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function Denied() {
  return (
    <AppShell title="Acesso não autorizado">
      <section className="card-surface space-y-4 p-5">
        <p>É necessário um acesso autorizado para consultar informações da loja.</p>
        <Link className="text-brand underline" href="/login">
          Ir para o acesso
        </Link>
      </section>
    </AppShell>
  );
}
