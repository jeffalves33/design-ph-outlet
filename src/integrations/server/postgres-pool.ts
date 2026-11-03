import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { criarConfiguracaoPool } from "./postgres-config";

let pool: Pool | undefined;

/** Um pool por instância Node; o limite agregado depende da escala na Vercel. */
export function obterPool(): Pool {
  if (pool) return pool;

  const novoPool = new Pool(criarConfiguracaoPool(process.env["DATABASE_URL"]));
  // pg emite erros de clientes ociosos fora das promises de consulta.
  novoPool.on("error", () => {
    console.error("Conexão PostgreSQL ociosa indisponível.");
  });

  if (process.env["VERCEL"] === "1") attachDatabasePool(novoPool);
  pool = novoPool;
  return novoPool;
}
