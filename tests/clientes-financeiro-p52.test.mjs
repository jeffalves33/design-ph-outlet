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
  runInNewContext(codigo, { module: modulo, exports: modulo.exports, Intl, Date });
  return modulo.exports;
}

const clientes = carregar("../src/features/clientes/dominio/cliente.ts");
const financeiro = carregar("../src/features/financeiro/dominio/financeiro.ts");
const ID = "11111111-1111-4111-8111-111111111111";
const LOJA = "22222222-2222-4222-8222-222222222222";

test("cliente normaliza nome/WhatsApp e mantém opcionais ausentes", () => {
  const validado = clientes.validarNovoCliente({ id: ID, nome: "  Ana   Souza ",
    whatsapp: "+55 (27) 99999-0000", dataNascimento: "", cidade: "", lojaPreferidaId: "",
    observacao: "" });
  assert.equal(validado.nome, "Ana Souza");
  assert.equal(validado.whatsappDigitos, "5527999990000");
  assert.equal(validado.dataNascimento, null);
  assert.equal(validado.lojaPreferidaId, null);
  assert.throws(() => clientes.validarNovoCliente({ ...validado, whatsapp: "123" }), /10 a 15/);
  assert.throws(() => clientes.validarNovoCliente({ ...validado, whatsapp: "27999990000",
    dataNascimento: "2099-01-01" }), /futuro/);
});

test("despesa exige categoria fixa, centavos positivos e data civil", () => {
  const validada = financeiro.validarNovaDespesa({ id: ID, lojaId: LOJA,
    descricao: "  Compra   de embalagens ", categoria: "operacional",
    valorCentavos: "15990", dataDespesa: "2026-10-26" });
  assert.equal(validada.descricao, "Compra de embalagens");
  assert.equal(validada.valorCentavos, "15990");
  assert.throws(() => financeiro.validarNovaDespesa({ ...validada, valorCentavos: "15.90" }), /centavos/);
  assert.throws(() => financeiro.validarNovaDespesa({ ...validada, categoria: "impostos" }), /Categoria/);
  assert.throws(() => financeiro.validarPeriodo("2026-10-31", "2026-10-01"), /posterior/);
});

test("persistência restringe lojas, mantém cadastros imutáveis e deriva receita das vendas", () => {
  const clientesServidor = readFileSync(new URL("../src/features/clientes/server/clientes.ts", import.meta.url), "utf8");
  const financeiroServidor = readFileSync(new URL("../src/features/financeiro/server/financeiro.ts", import.meta.url), "utf8");
  assert.match(clientesServidor, /c\.loja_preferida_id = ANY\(\$1::uuid\[\]\)/);
  assert.match(clientesServidor, /ON CONFLICT DO NOTHING/);
  assert.match(financeiroServidor, /v\.realizada_em AT TIME ZONE 'America\/Sao_Paulo'/);
  assert.match(financeiroServidor, /d\.loja_id = ANY\(\$1::uuid\[\]\)/);
  assert.match(financeiroServidor, /ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(`${clientesServidor}\n${financeiroServidor}`, /UPDATE public\.(clientes|despesas)|DELETE FROM public\.(clientes|despesas)/);
});

test("APIs autorizam no servidor, exigem mesma origem e não aceitam identidade do navegador", () => {
  const apiClientes = readFileSync(new URL("../src/app/api/clientes/route.ts", import.meta.url), "utf8");
  const apiFinanceiro = readFileSync(new URL("../src/app/api/financeiro/route.ts", import.meta.url), "utf8");
  assert.match(apiClientes, /autorizarAcao\("clientes\.consultar", \{ todas: true \}\)/);
  assert.match(apiClientes, /autorizarAcao\("clientes\.gerir"\)/);
  assert.match(apiFinanceiro, /autorizarAcao\("financeiro\.gerir", \{ lojaId \}\)/);
  assert.match(`${apiClientes}\n${apiFinanceiro}`, /req\.headers\.get\("origin"\) !== req\.nextUrl\.origin/);
  assert.doesNotMatch(`${apiClientes}\n${apiFinanceiro}`, /usuarioId.*searchParams|autorUsuarioId.*dados/);
});

test("venda inclui cliente opcional na idempotência e grava vínculo somente no INSERT", () => {
  const dominioVenda = readFileSync(new URL("../src/features/vendas/dominio/venda.ts", import.meta.url), "utf8");
  const servidorVenda = readFileSync(new URL("../src/features/vendas/server/vendas.ts", import.meta.url), "utf8");
  const telaVenda = readFileSync(new URL("../src/features/vendas/components/page-view.tsx", import.meta.url), "utf8");
  assert.match(dominioVenda, /clienteId: validada\.clienteId/);
  assert.match(servidorVenda, /clienteId: venda\.clienteId/);
  assert.match(servidorVenda, /total_centavos, cliente_id/);
  assert.match(servidorVenda, /SELECT id FROM public\.clientes WHERE id = \$1 FOR SHARE/);
  assert.doesNotMatch(servidorVenda, /UPDATE public\.vendas[\s\S]*cliente_id/);
  assert.match(telaVenda, /Cliente \(opcional\)/);
  assert.match(telaVenda, /clienteId: operacao\.clienteId/);
});

test("telas preservam CRM/financeiro e usam APIs reais sem pagamentos simulados", () => {
  const telaClientes = readFileSync(new URL("../src/features/clientes/components/page-view.tsx", import.meta.url), "utf8");
  const telaFinanceiro = readFileSync(new URL("../src/features/financeiro/components/page-view.tsx", import.meta.url), "utf8");
  assert.match(telaClientes, /CRM de clientes/);
  assert.match(telaClientes, /fetch\("\/api\/clientes"/);
  assert.match(telaFinanceiro, /Relatório financeiro/);
  assert.match(telaFinanceiro, /fetch\(`\/api\/financeiro\?/);
  assert.match(telaFinanceiro, /não representa caixa, recebimento ou resultado fiscal/);
  assert.doesNotMatch(`${telaClientes}\n${telaFinanceiro}`, /mock-data|addCliente|addDespesa|pagamento ===/);
});
