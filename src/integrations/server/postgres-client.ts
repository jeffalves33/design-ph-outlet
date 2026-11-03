import "server-only";
import type { QueryResult, QueryResultRow } from "pg";
import { obterPool } from "./postgres-pool";

export type ConsultaSQL = Readonly<{
  texto: string;
  parametros: readonly unknown[];
}>;

export type TipoErroBanco = "indisponivel" | "tempo_esgotado" | "conflito" | "falha";

export class ErroBanco extends Error {
  readonly tipo: TipoErroBanco;

  constructor(tipo: TipoErroBanco) {
    const mensagens: Record<TipoErroBanco, string> = {
      indisponivel: "Banco de dados indisponível. Tente novamente mais tarde.",
      tempo_esgotado: "Operação de banco excedeu o tempo permitido.",
      conflito: "Conflito de dados. Revise a operação antes de tentar novamente.",
      falha: "Não foi possível concluir a operação de banco.",
    };
    super(mensagens[tipo]);
    this.name = "ErroBanco";
    this.tipo = tipo;
  }
}

function sanitizarErro(erro: unknown): ErroBanco {
  const codigo =
    typeof erro === "object" && erro !== null && "code" in erro
      ? String(erro.code)
      : "";

  if (codigo === "23505") return new ErroBanco("conflito");
  if (codigo === "57014" || codigo === "ETIMEDOUT") {
    return new ErroBanco("tempo_esgotado");
  }
  if (["53300", "08000", "08001", "08003", "08006", "ECONNREFUSED", "ECONNRESET"].includes(codigo)) {
    return new ErroBanco("indisponivel");
  }
  return new ErroBanco("falha");
}

export interface ClienteBanco {
  consultar<T extends QueryResultRow = QueryResultRow>(consulta: ConsultaSQL): Promise<QueryResult<T>>;
}

/** O callback conserva o mesmo cliente para futuras transações; release é obrigatório. */
export async function comClienteBanco<T>(executar: (cliente: ClienteBanco) => Promise<T>): Promise<T> {
  let cliente;
  try {
    cliente = await obterPool().connect();
  } catch (erro) {
    throw sanitizarErro(erro);
  }

  try {
    return await executar({
      async consultar<R extends QueryResultRow = QueryResultRow>(consulta: ConsultaSQL) {
        if (
          !consulta ||
          typeof consulta.texto !== "string" ||
          !consulta.texto.trim() ||
          !Array.isArray(consulta.parametros) ||
          consulta.parametros.some((parametro) => parametro === undefined)
        ) {
          throw new ErroBanco("falha");
        }
        try {
          return await cliente.query<R>({
            text: consulta.texto,
            values: [...consulta.parametros],
          });
        } catch (erro) {
          throw sanitizarErro(erro);
        }
      },
    });
  } finally {
    cliente.release();
  }
}
