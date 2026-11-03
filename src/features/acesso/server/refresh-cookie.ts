import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const COOKIE_RENOVACAO = "ph_renovacao";
// Validade confirmada pelo responsável para novas credenciais do App Client PH.
export const PRAZO_RENOVACAO_SEGUNDOS = 3650 * 24 * 60 * 60;
// Teto prático por emissão no Chrome; a expiração absoluta Cognito continua separada.
export const JANELA_COOKIE_RENOVACAO_SEGUNDOS = 400 * 24 * 60 * 60;

export function duracaoCookieRenovacao(expiraEm: number) {
  const restante = Math.floor((expiraEm - Date.now()) / 1000);
  if (!Number.isSafeInteger(expiraEm) || restante < 1) throw new Error("Sessão inválida.");
  return Math.min(restante, JANELA_COOKIE_RENOVACAO_SEGUNDOS);
}

function chave() {
  const valor = process.env["PH_SESSION_ENCRYPTION_KEY"];
  if (!valor || !/^[A-Za-z0-9+/]{43}=$/.test(valor)) throw new Error("Configuração de sessão indisponível.");
  const bytes = Buffer.from(valor, "base64");
  if (bytes.length !== 32 || bytes.toString("base64") !== valor)
    throw new Error("Configuração de sessão indisponível.");
  return bytes;
}

export function protegerRenovacao(token: string, expiraEm: number) {
  if (!token || !Number.isSafeInteger(expiraEm) || expiraEm <= Date.now())
    throw new Error("Sessão inválida.");
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const conteudo = Buffer.concat([cifra.update(JSON.stringify({ token, expiraEm }), "utf8"), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), conteudo]).toString("base64url");
}

export function abrirRenovacao(valor: string) {
  try {
    if (!valor || valor.length > 6000) throw new Error();
    const dados = Buffer.from(valor, "base64url");
    if (dados.length < 29) throw new Error();
    const decifra = createDecipheriv("aes-256-gcm", chave(), dados.subarray(0, 12));
    decifra.setAuthTag(dados.subarray(12, 28));
    const conteudo = JSON.parse(Buffer.concat([decifra.update(dados.subarray(28)), decifra.final()]).toString("utf8")) as {
      token?: unknown; expiraEm?: unknown;
    };
    if (typeof conteudo.token !== "string" || !conteudo.token ||
        typeof conteudo.expiraEm !== "number" || !Number.isSafeInteger(conteudo.expiraEm) ||
        conteudo.expiraEm <= Date.now()) throw new Error();
    return { token: conteudo.token, expiraEm: conteudo.expiraEm };
  } catch { throw new Error("Sessão inválida."); }
}
