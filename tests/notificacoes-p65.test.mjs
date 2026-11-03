import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregar(comClienteBanco) {
  const fonte = readFileSync(new URL("../src/features/notificacoes/server/notificacoes.ts", import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports, Date, Intl,
    require(nome) {
      if (nome === "server-only") return {};
      if (nome === "@/integrations/server/postgres-client") return { comClienteBanco };
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
  return modulo.exports;
}

const AGORA = new Date("2026-11-03T15:00:00Z");

function banco({ lidas = [] } = {}) {
  const consultas = [];
  const cliente = { async consultar(consulta) {
    consultas.push(consulta);
    if (consulta.texto.includes("FROM public.clientes")) return { rows: [
      { id: "cliente-1", nome: "Ana", data_nascimento: "1990-11-03" },
      { id: "cliente-2", nome: "Bia", data_nascimento: "1990-12-20" },
    ] };
    if (consulta.texto.includes("FROM public.categorias")) return { rows: [
      { id: "categoria-1", loja_id: "loja-1", nome: "Camiseta", tamanho: "M", codigo: 1,
        atualizado_em: "2026-11-03 10:00:00+00" },
    ] };
    if (consulta.texto.includes("FROM public.notificacoes_lidas")) return { rows: lidas.map((chave) => ({ chave })) };
    return { rows: [] };
  } };
  return { cliente, consultas };
}

test("lista somente alertas ativos e mantém leitura por ocorrência", async () => {
  const estado = banco({ lidas: ["aniversario:cliente-1:2026"] });
  const modulo = carregar((executar) => executar(estado.cliente));
  const alertas = await modulo.listarNotificacoes("usuario-1", ["loja-1"], AGORA);
  assert.equal(alertas.length, 2);
  assert.equal(alertas.find((item) => item.tipo === "aniversario").lida, true);
  assert.equal(alertas.find((item) => item.tipo === "estoque_zerado").lida, false);
  assert.match(alertas.find((item) => item.tipo === "estoque_zerado").chave,
    /^estoque:categoria-1:2026-11-03/);
  assert.ok(estado.consultas.every((consulta) => Array.isArray(consulta.parametros)));
});

test("marca apenas notificações ativas do usuário e usa upsert", async () => {
  const estado = banco();
  const modulo = carregar((executar) => executar(estado.cliente));
  const chave = "aniversario:cliente-1:2026";
  assert.equal((await modulo.marcarNotificacoesLidas("usuario-1", ["loja-1"], [chave], AGORA)).marcadas, 1);
  const escrita = estado.consultas.find((consulta) => consulta.texto.includes("INSERT INTO public.notificacoes_lidas"));
  assert.match(escrita.texto, /ON CONFLICT \(usuario_id, chave\) DO UPDATE/);
  assert.equal(escrita.parametros[0], "usuario-1");
  assert.equal(escrita.parametros[1].length, 1);
  assert.equal(escrita.parametros[1][0], chave);
  await assert.rejects(modulo.marcarNotificacoesLidas("usuario-1", ["loja-1"], ["alerta-inventado"], AGORA),
    /inexistente ou encerrada/);
});

test("API protege mutação e shell contabiliza somente não lidas", () => {
  const api = readFileSync(new URL("../src/app/api/notificacoes/route.ts", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("painel\.consultar", \{ todas: true \}\)/);
  assert.match(api, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.doesNotMatch(api, /usuarioId.*dados|usuarioId.*searchParams/);
  assert.match(shell, /Marcar todas como lidas/);
  assert.match(shell, /Marcar como lida/);
  assert.match(shell, /const naoLidas = visiveis\.filter\(\(item\) => !item\.lida\)/);
});
