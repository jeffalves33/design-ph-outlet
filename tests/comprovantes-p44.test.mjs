import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregar(caminho, dependencias = {}) {
  const fonte = readFileSync(new URL(caminho, import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports,
    require(nome) {
      if (nome === "server-only") return {};
      if (Object.hasOwn(dependencias, nome)) return dependencias[nome];
      throw new Error(`Dependência inesperada: ${nome}`);
    },
  });
  return modulo.exports;
}

class ErroVenda extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function servico(respostas, consultas) {
  return carregar("../src/features/vendas/server/comprovantes.ts", {
    "@/integrations/server/postgres-client": { comClienteBanco: async (executar) =>
      executar({ consultar: async (consulta) => {
        consultas.push(consulta);
        return { rows: respostas.shift() ?? [] };
      } }) },
    "../dominio/venda": { ErroVenda },
  });
}

const cabecalho = { id: "venda-a", loja_nome: "PH Outlet", responsavel_nome: "Administrador",
  total_centavos: "15980", realizada_em: "2026-10-25T12:00:00.000Z" };
const item = { categoria_id: "categoria-a", codigo_registrado: 1,
  nome_registrado: "Camiseta", tamanho_registrado: "M",
  preco_unitario_centavos: "7990", quantidade: 2, total_linha_centavos: "15980" };

test("comprovante nasce somente de venda, snapshots e baixas persistidos", async () => {
  const consultas = [];
  const modulo = servico([[cabecalho], [item], [{ categoria_id: "categoria-a" }]], consultas);
  const comprovante = await modulo.obterComprovante("loja-a", "venda-a");
  assert.equal(comprovante.lojaNome, "PH Outlet");
  assert.equal(comprovante.itens[0].codigo, "00001");
  assert.equal(comprovante.itens[0].tamanho, "M");
  assert.equal(comprovante.totalCentavos, "15980");
  assert.deepEqual([...consultas[0].parametros], ["venda-a", "loja-a"]);
  const sql = consultas.map((consulta) => consulta.texto).join("\n");
  assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/);
  assert.match(sql, /public\.itens_venda/);
  assert.match(sql, /public\.movimentos_estoque/);
});

test("venda inexistente ou inconsistente não gera comprovante fictício", async () => {
  let consultas = [];
  let modulo = servico([[]], consultas);
  assert.equal(await modulo.obterComprovante("loja-a", "venda-a"), null);
  consultas = [];
  modulo = servico([[cabecalho], [{ ...item, total_linha_centavos: "1" }],
    [{ categoria_id: "categoria-a" }]], consultas);
  await assert.rejects(modulo.obterComprovante("loja-a", "venda-a"),
    (erro) => erro.status === 503);
  consultas = [];
  modulo = servico([[cabecalho], [item], []], consultas);
  await assert.rejects(modulo.obterComprovante("loja-a", "venda-a"),
    (erro) => erro.status === 503);
});

test("listagem recente é limitada por loja e somente leitura", async () => {
  const consultas = [];
  const modulo = servico([[{ id: "venda-a", total_centavos: "15980",
    realizada_em: cabecalho.realizada_em, responsavel_nome: "Administrador" }]], consultas);
  const vendas = await modulo.listarVendasRecentes("loja-a");
  assert.equal(vendas[0].totalCentavos, "15980");
  assert.deepEqual([...consultas[0].parametros], ["loja-a"]);
  assert.match(consultas[0].texto, /ORDER BY v\.realizada_em DESC, v\.id DESC/);
  assert.match(consultas[0].texto, /LIMIT 10/);
  assert.doesNotMatch(consultas[0].texto, /INSERT|UPDATE|DELETE/);
});

test("API autoriza impressão por loja e não possui mutação", () => {
  const api = readFileSync(new URL("../src/app/api/comprovantes/route.ts", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("impressao\.executar", \{ lojaId \}\)/);
  assert.match(api, /obterComprovante\(lojaId, vendaId\)/);
  assert.doesNotMatch(api, /export async function POST|export async function PATCH|export async function DELETE/);
});

test("prévia é não fiscal e reimpressão abre somente o diálogo do navegador", () => {
  const tela = readFileSync(new URL("../src/features/vendas/components/comprovante-dialog.tsx", import.meta.url), "utf8");
  const vendas = readFileSync(new URL("../src/features/vendas/components/page-view.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(tela, /COMPROVANTE NÃO FISCAL/);
  assert.match(tela, /Documento sem valor fiscal/);
  assert.match(tela, /window\.print\(\)/);
  assert.match(tela, /Reimprimir consulta a venda persistida e não altera estoque, venda ou meta/);
  assert.match(vendas, /api\/comprovantes/);
  assert.match(vendas, /Vendas recentes/);
  assert.doesNotMatch(tela, /api\/vendas|api\/estoque|fetch\(/);
  assert.match(css, /\.comprovante-fisico[\s\S]*width: 80mm/);
  assert.match(css, /@page comprovante-termico/);
});
