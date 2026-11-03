import "server-only";
import type { PoolConfig } from "pg";

const HOSPEDEIRO = "db01.prodexylabs.com";
const BANCO = "prodexy_ph_outlet";
const USUARIO = "prodexy_ph_outlet_app";
const PORTA = 5432;

export class ConfiguracaoBancoInvalida extends Error {
  constructor() {
    super("Configuração do banco indisponível ou incompatível com o PH Outlet.");
    this.name = "ConfiguracaoBancoInvalida";
  }
}

/** Recebe somente o valor do ambiente server-side; nunca inclui a URL em erros. */
export function criarConfiguracaoPool(valor: string | undefined): PoolConfig {
  if (!valor?.trim()) throw new ConfiguracaoBancoInvalida();

  let url: URL;
  let usuario: string;
  let senha: string;
  let banco: string;
  try {
    url = new URL(valor);
    usuario = decodeURIComponent(url.username);
    senha = decodeURIComponent(url.password);
    banco = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new ConfiguracaoBancoInvalida();
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== HOSPEDEIRO ||
    (url.port !== "" && url.port !== String(PORTA)) ||
    banco !== BANCO ||
    usuario !== USUARIO ||
    !senha ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new ConfiguracaoBancoInvalida();
  }

  // Campos separados evitam que parâmetros de uma connectionString substituam ssl.
  return {
    host: HOSPEDEIRO,
    port: PORTA,
    database: BANCO,
    user: USUARIO,
    password: senha,
    ssl: { rejectUnauthorized: true, servername: HOSPEDEIRO },
    max: 1,
    min: 0,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 15_000,
    statement_timeout: 10_000,
    lock_timeout: 3_000,
    idle_in_transaction_session_timeout: 15_000,
    application_name: "prodexy_ph_outlet",
  };
}
