import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function carregar(caminho) {
  const fonte = readFileSync(new URL(caminho, import.meta.url), "utf8");
  const codigo = ts.transpileModule(fonte, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const modulo = { exports: {} };
  runInNewContext(codigo, { module: modulo, exports: modulo.exports });
  return modulo.exports;
}

const dominio = carregar("../src/features/metas/dominio/meta.ts");
const ID = "11111111-1111-4111-8111-111111111111";
const LOJA = "22222222-2222-4222-8222-222222222222";
const VENDEDOR = "33333333-3333-4333-8333-333333333333";

test("meta aceita prazo livre e dinheiro exato, sem frequência mensal", () => {
  const meta = dominio.validarNovaMeta({ id: ID, lojaId: LOJA, vendedorUsuarioId: VENDEDOR,
    nome: "  Campanha   primavera ", alvoCentavos: "1500000",
    inicioData: "2026-09-15", fimData: "2027-02-28" });
  assert.equal(meta.nome, "Campanha primavera");
  assert.equal(meta.alvoCentavos, "1500000");
  assert.equal(meta.inicioData, "2026-09-15");
  assert.throws(() => dominio.validarNovaMeta({ ...meta, alvoCentavos: "10.50" }), /centavos/);
  assert.throws(() => dominio.validarNovaMeta({ ...meta, inicioData: "2026-02-30" }), /inválida/);
  assert.throws(() => dominio.validarNovaMeta({ ...meta, inicioData: "2027-03-01" }), /posterior/);
});

test("edição exige versão positiva para concorrência otimista", () => {
  const base = { id: ID, lojaIdFixa: LOJA, vendedorUsuarioIdFixo: VENDEDOR,
    nome: "Meta", alvoCentavos: "10000", inicioData: "2026-10-01", fimData: "2026-10-31" };
  assert.equal(dominio.validarEdicaoMeta({ ...base, versaoEsperada: 2 }).versaoEsperada, 2);
  assert.throws(() => dominio.validarEdicaoMeta({ ...base, versaoEsperada: 0 }), /Versão/);
});

test("atingimento usa vendedor, loja e limites civis inclusivos de São Paulo", () => {
  const servidor = readFileSync(new URL("../src/features/metas/server/metas.ts", import.meta.url), "utf8");
  assert.match(servidor, /v\.loja_id = m\.loja_id AND v\.vendedor_usuario_id = m\.vendedor_usuario_id/);
  assert.match(servidor, /AT TIME ZONE 'America\/Sao_Paulo'/);
  assert.match(servidor, /BETWEEN m\.inicio_data AND m\.fim_data/);
  assert.match(servidor, /m\.vendedor_usuario_id = \$1 AND m\.loja_id = ANY\(\$2::uuid\[\]\)/);
  assert.doesNotMatch(servidor, /LIMIT \d+[\s\S]*sum\(v\.total_centavos\)/i);
});

test("criação e edição são transacionais e acrescentam histórico", () => {
  const servidor = readFileSync(new URL("../src/features/metas/server/metas.ts", import.meta.url), "utf8");
  assert.match(servidor, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(servidor, /'criacao'/);
  assert.match(servidor, /'edicao'/);
  assert.match(servidor, /WHERE id = \$1 AND loja_id = ANY\(\$2::uuid\[\]\)[\s\S]*FOR UPDATE/);
  assert.match(servidor, /lojasAutorizadas\.includes\(entrada\.lojaId\)/);
  assert.match(servidor, /meta\.versao === entrada\.versaoEsperada \+ 1 && mesmosDados/);
  assert.doesNotMatch(servidor, /UPDATE public\.historico_metas|DELETE FROM public\.(metas|historico_metas)/);
});

test("API ignora identidade de consulta do navegador e autoriza mutações no servidor", () => {
  const api = readFileSync(new URL("../src/app/api/metas/route.ts", import.meta.url), "utf8");
  assert.match(api, /listarMetasProprias\(proprio\.id, proprio\.lojas\)/);
  assert.match(api, /autorizarAcao\("metas\.gerir"\)/);
  assert.match(api, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.doesNotMatch(api, /searchParams\.get\("usuarioId"\)/);
});

test("telas usam API real, múltiplas metas e histórico sem store de demonstração", () => {
  const admin = readFileSync(new URL("../src/features/metas/components/admin-view.tsx", import.meta.url), "utf8");
  const propria = readFileSync(new URL("../src/features/metas/components/page-view.tsx", import.meta.url), "utf8");
  assert.match(admin, /Nova meta/);
  assert.match(admin, /Histórico/);
  assert.match(admin, /method: nova \? "POST" : "PATCH"/);
  assert.match(propria, /Cada meta usa somente suas vendas na loja e no período indicados/);
  assert.match(propria, /fetch\("\/api\/metas"/);
  assert.doesNotMatch(`${admin}\n${propria}`, /useStore|mock-data|metaMensal/);
});
