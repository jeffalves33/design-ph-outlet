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

const dominio = carregar("../src/features/vendas/dominio/sacola.ts");
const produto = Object.freeze({
  id: "categoria-a", lojaId: "loja-a", lojaNome: "PH Outlet", codigo: "00001",
  nome: "Camiseta", tamanho: "M", precoCentavos: "7990", estoque: "3",
});

test("código exige cinco dígitos e preserva zeros iniciais", () => {
  assert.equal(dominio.normalizarCodigoVenda("00001"), "00001");
  assert.equal(dominio.normalizarCodigoVenda("99999"), "99999");
  assert.throws(() => dominio.normalizarCodigoVenda("1"), /cinco dígitos/);
  assert.throws(() => dominio.normalizarCodigoVenda("0001A"), /cinco dígitos/);
});

test("cada leitura intencional consolida o mesmo item sem duplicar linhas", () => {
  const primeira = dominio.adicionarNaSacola([], produto);
  const segunda = dominio.adicionarNaSacola(primeira, produto);
  assert.equal(segunda.length, 1);
  assert.equal(segunda[0].quantidade, 2);
  const lote = dominio.adicionarNaSacola([], produto, 3);
  assert.equal(lote[0].quantidade, 3);
});

test("sacola respeita loja e saldo, e totaliza dinheiro em centavos inteiros", () => {
  const itens = dominio.adicionarNaSacola([], produto, 3);
  assert.equal(dominio.totalSacolaCentavos(itens), 23970n);
  assert.equal(dominio.quantidadePecas(itens), 3);
  assert.throws(() => dominio.adicionarNaSacola(itens, produto), /Estoque disponível/);
  assert.throws(() => dominio.adicionarNaSacola(itens, { ...produto, id: "b", lojaId: "loja-b" }), /lojas diferentes/);
  assert.equal(dominio.definirQuantidade(itens, produto.id, 0).length, 0);
});

test("consulta usa loja e código exatos, retorna tamanho e somente lê catálogo/saldo", async () => {
  const consultas = [];
  const servidor = carregar("../src/features/vendas/server/catalogo-venda.ts", {
    "@/integrations/server/postgres-client": { comClienteBanco: async (executar) =>
      executar({ consultar: async (consulta) => {
        consultas.push(consulta);
        return { rows: [{ id: "categoria-a", loja_id: "loja-a", loja_nome: "PH Outlet",
          codigo: 1, nome: "Camiseta", tamanho: "M", preco_centavos: "7990", estoque: "3" }] };
      } }) },
    "../dominio/sacola": dominio,
  });
  const encontrado = await servidor.buscarProdutoVenda("loja-a", "00001");
  assert.equal(encontrado.codigo, "00001");
  assert.equal(encontrado.tamanho, "M");
  assert.deepEqual([...consultas[0].parametros], ["loja-a", 1]);
  assert.match(consultas[0].texto, /c\.loja_id = \$1 AND c\.codigo = \$2/);
  assert.match(consultas[0].texto, /c\.arquivada_em IS NULL/);
  assert.doesNotMatch(consultas[0].texto, /INSERT|UPDATE|DELETE/);
});

test("API de leitura autoriza a loja e permanece separada da confirmação", () => {
  const api = readFileSync(new URL("../src/app/api/vendas/catalogo/route.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/vendas/components/page-view.tsx", import.meta.url), "utf8");
  const pagina = readFileSync(new URL("../src/app/vendas/page.tsx", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("vendas\.consultar", \{ lojaId \}\)/);
  assert.match(api, /normalizarCodigoVenda/);
  assert.match(tela, /method: "GET"/);
  assert.match(tela, /Cada Enter ou clique é uma leitura intencional/);
  assert.doesNotMatch(api, /export async function POST/);
  assert.doesNotMatch(api, /INSERT|UPDATE|DELETE/);
  assert.match(pagina, /listarLojasVenda\(perfil\.lojas\)/);
});
