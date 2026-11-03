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

const dominio = carregar("../src/features/estoque/dominio/categoria.ts");

test("categoria usa código de cinco dígitos e dinheiro inteiro exato", () => {
  assert.equal(dominio.codigoExibido(1), "00001");
  assert.equal(dominio.codigoExibido(99999), "99999");
  assert.equal(dominio.centavosDoTexto("79,90"), 7990);
  assert.equal(dominio.centavosDoTexto("0.01"), 1);
  assert.throws(() => dominio.centavosDoTexto("79,999"));
  assert.throws(() => dominio.validarCategoria("", "M", 100));
  assert.throws(() => dominio.validarCategoria("Camisa", "", 100));
  assert.throws(() => dominio.validarCategoria("Camisa", "M", 10.5));
  assert.deepEqual({ ...dominio.validarCategoria(" Camisa ", " M ", 100) },
    { nome: "Camisa", tamanho: "M", precoCentavos: 100 });
});

test("cadastro reserva código por loja na transação e inicia saldo zero", async () => {
  const comandos = [];
  const cliente = { async consultar(consulta) {
    comandos.push(consulta);
    if (consulta.texto.includes("SELECT id FROM public.lojas")) return { rows: [{ id: consulta.parametros[0] }] };
    if (consulta.texto.includes("RETURNING proximo_codigo")) return { rows: [{ codigo: 12 }] };
    return { rows: [] };
  } };
  const modulo = carregar("../src/features/estoque/server/catalogo.ts", {
    "node:crypto": { randomUUID: () => "id-sintetico" },
    "@/integrations/server/postgres-client": { comClienteBanco: (executar) => executar(cliente) },
    "../dominio/categoria": dominio,
  });
  const criado = await modulo.criarCategoria("loja-a", " Camisetas ", " M ", 7990);
  assert.equal(criado.codigo, 12);
  assert.equal(comandos[0].texto, "BEGIN");
  assert.equal(comandos.at(-1).texto, "COMMIT");
  assert.ok(comandos.some((c) => c.texto.includes("proximo_codigo + 1") && c.parametros[0] === "loja-a"));
  assert.ok(comandos.some((c) => c.texto.includes("INSERT INTO public.categorias") &&
    c.parametros[3] === "Camisetas" && c.parametros[4] === "M" && c.parametros[5] === 7990));
  assert.ok(comandos.some((c) => c.texto.includes("INSERT INTO public.saldos_estoque") &&
    c.texto.includes("VALUES ($1, $2, 0)") && c.parametros[1] === "loja-a"));
});

test("faixa esgotada e erro de escrita fazem rollback sem sucesso fictício", async () => {
  const comandos = [];
  const cliente = { async consultar(consulta) {
    comandos.push(consulta.texto);
    if (consulta.texto.includes("SELECT id FROM public.lojas")) return { rows: [{ id: "loja-a" }] };
    return { rows: [] };
  } };
  const modulo = carregar("../src/features/estoque/server/catalogo.ts", {
    "node:crypto": { randomUUID: () => "id-sintetico" },
    "@/integrations/server/postgres-client": { comClienteBanco: (executar) => executar(cliente) },
    "../dominio/categoria": dominio,
  });
  await assert.rejects(modulo.criarCategoria("loja-a", "Camisa", "M", 100));
  assert.equal(comandos.at(-1), "ROLLBACK");
  assert.ok(!comandos.includes("COMMIT"));
});

test("edição e arquivo não reescrevem preço histórico da venda", async () => {
  const comandos = [];
  const cliente = { async consultar(consulta) {
    comandos.push(consulta);
    return { rows: consulta.texto.includes("RETURNING id") ? [{ id: "categoria-a" }] : [] };
  } };
  const modulo = carregar("../src/features/estoque/server/catalogo.ts", {
    "node:crypto": { randomUUID: () => "id-sintetico" },
    "@/integrations/server/postgres-client": { comClienteBanco: (executar) => executar(cliente) },
    "../dominio/categoria": dominio,
  });
  await modulo.alterarCategoria("categoria-a", "loja-a", "Nova descrição", "G", 12000, true);
  const sql = comandos.map((c) => c.texto).join("\n");
  assert.match(sql, /UPDATE public\.categorias/);
  assert.match(sql, /arquivada_em = CASE/);
  assert.match(sql, /tamanho = \$4/);
  assert.doesNotMatch(sql, /UPDATE public\.itens_venda/);
  const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
  assert.match(schema, /preco_unitario_centavos bigint NOT NULL/);
  assert.match(schema, /UNIQUE \(loja_id, codigo\)/);
  assert.match(schema, /FOREIGN KEY \(categoria_id, loja_id\)/);
  assert.match(schema, /CREATE UNIQUE INDEX categorias_loja_nome_tamanho_ativas_uidx/);
});

test("API e tela usam catálogo real com autorização por loja", () => {
  const api = readFileSync(new URL("../src/app/api/catalogo/route.ts", import.meta.url), "utf8");
  const pagina = readFileSync(new URL("../src/app/catalogo/page.tsx", import.meta.url), "utf8");
  const estoque = readFileSync(new URL("../src/app/estoque/page.tsx", import.meta.url), "utf8");
  const tela = readFileSync(new URL("../src/features/estoque/components/catalogo-view.tsx", import.meta.url), "utf8");
  assert.match(api, /autorizarAcao\("estoque\.gerir", \{ lojaId: loja \}\)/);
  assert.match(api, /origemValida\(req\)/);
  assert.match(pagina, /catalogo-view/);
  assert.match(estoque, /catalogo-view/);
  assert.match(tela, /fetch\("\/api\/catalogo"/);
  assert.match(tela, /Buscar por nome/);
  assert.match(tela, /Menores saldos primeiro/);
  assert.match(tela, /categoria\.tamanho/);
  assert.match(api, /dados\["tamanho"\]/);
  assert.match(api, /erro\.tipo === "conflito"/);
  assert.match(api, /erro\.tipo === "conflito"/);
  assert.match(api, /erro\.tipo === "conflito"/);
  assert.doesNotMatch(tela, /presentation-state|mock-data/);
});
