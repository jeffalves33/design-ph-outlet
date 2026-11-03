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

const dominio = carregar("../src/features/etiquetas/dominio/etiqueta.ts");

test("código humano preserva cinco dígitos e Code 128 gera barras determinísticas", () => {
  assert.equal(dominio.codigoEtiqueta(1), "00001");
  assert.equal(dominio.codigoEtiqueta(99999), "99999");
  assert.throws(() => dominio.codigoEtiqueta(0), /Código inválido/);
  const primeiro = dominio.barrasCode128B("00001");
  const repetido = dominio.barrasCode128B("00001");
  assert.deepEqual(JSON.parse(JSON.stringify(primeiro)), JSON.parse(JSON.stringify(repetido)));
  assert.ok(primeiro.barras.length > 20);
  assert.equal(primeiro.larguraTotal, 110);
  assert.ok(primeiro.larguraTotal > primeiro.barras.at(-1).x);
  assert.throws(() => dominio.barrasCode128B("1"), /cinco dígitos/);
});

test("lote N produz exatamente N etiquetas e pagina conforme o formato", () => {
  const termicas = dominio.paginarEtiquetas(20, "termica");
  assert.equal(termicas.length, 20);
  assert.equal(termicas.flat().length, 20);
  assert.deepEqual([...termicas[0]], [1]);
  assert.deepEqual([...termicas[19]], [20]);
  const a4 = dominio.paginarEtiquetas(31, "a4");
  assert.equal(a4.length, 2);
  assert.equal(a4[0].length, 30);
  assert.deepEqual([...a4[1]], [31]);
  assert.throws(() => dominio.paginarEtiquetas(501, "a4"), /1 a 500/);
  assert.throws(() => dominio.normalizarMargemMm(5.5), /0 e 5/);
});

test("consulta da etiqueta usa categoria e loja autorizadas sem escrita", async () => {
  const consultas = [];
  const modulo = carregar("../src/features/etiquetas/server/etiquetas.ts", {
    "@/integrations/server/postgres-client": { comClienteBanco: async (executar) =>
      executar({ consultar: async (consulta) => {
        consultas.push(consulta);
        return { rows: [{ id: "categoria", loja_id: "loja", loja_nome: "PH Outlet",
          codigo: 1, nome: "Camiseta", tamanho: "M", preco_centavos: "7990" }] };
      } }) },
  });
  const categoria = await modulo.obterCategoriaParaEtiqueta("loja", "categoria");
  assert.equal(categoria.codigo, 1);
  assert.deepEqual([...consultas[0].parametros], ["categoria", "loja"]);
  assert.match(consultas[0].texto, /c\.id = \$1 AND c\.loja_id = \$2/);
  assert.doesNotMatch(consultas[0].texto, /INSERT|UPDATE|DELETE/);
});

test("API autoriza impressão e UI permite reimpressão sem movimentar estoque", () => {
  const api = readFileSync(new URL("../src/app/api/etiquetas/route.ts", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/etiquetas/components/etiquetas-dialog.tsx", import.meta.url), "utf8");
  const catalogo = readFileSync(new URL("../src/features/estoque/components/catalogo-view.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("impressao\.executar", \{ lojaId \}\)/);
  assert.match(catalogo, /fetch\(`\/api\/etiquetas\?\$\{parametros\}`/);
  assert.match(tela, /window\.print\(\)/);
  assert.match(tela, /Reimprimir não altera entrada, estoque ou histórico/);
  assert.doesNotMatch(tela, /api\/estoque\/movimentos|ajustarEstoque/);
  assert.match(css, /size: 50mm 30mm/);
  assert.match(css, /grid-template-columns: repeat\(3, 50mm\)/);
  assert.match(css, /break-after: page/);
});
