"use client";

import "../styles.css";

export default function GlobalError({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground">
        <main className="grid min-h-screen place-items-center px-5 py-10">
          <section role="alert" className="card-surface w-full max-w-lg space-y-4 p-6 text-center">
            <span className="mx-auto flex w-fit items-center">
              <img src="/ph_outlet.png" alt="PH Outlet" className="size-11 rounded-xl bg-white object-contain ring-1 ring-border" />
              <img src="/ph_kids.png" alt="PH Outlet Kids" className="-ml-3 size-11 rounded-xl bg-white object-contain ring-1 ring-border" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">Não foi possível carregar</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma operação foi confirmada. Tente novamente.
              </p>
            </div>
            <button type="button" className="rounded-xl bg-primary px-4 py-2 text-primary-foreground" onClick={reset}>
              Tentar novamente
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
