import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../database/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../database/migrations/202610260001_clientes_financeiro.sql", import.meta.url),
  "utf8",
);

test("schema e migration mantêm o contrato de clientes e despesas", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /CREATE TABLE public\.clientes/);
    assert.match(sql, /whatsapp_digitos text NOT NULL/);
    assert.match(sql, /data_nascimento date/);
    assert.match(sql, /loja_preferida_id uuid REFERENCES public\.lojas/);
    assert.match(sql, /UNIQUE \(whatsapp_digitos\)/);
    assert.match(sql, /CREATE TABLE public\.despesas/);
    assert.match(sql, /valor_centavos bigint NOT NULL CHECK \(valor_centavos > 0\)/);
    assert.match(sql, /data_despesa date NOT NULL/);
    assert.match(sql, /categoria IN \('fornecedores', 'aluguel', 'folha', 'marketing', 'operacional'\)/);
  }
});

test("venda aceita cliente opcional e o histórico é consultável por cliente", () => {
  assert.match(schema, /cliente_id uuid REFERENCES public\.clientes\(id\)/);
  assert.match(migration, /ALTER TABLE public\.vendas[\s\S]*ADD COLUMN cliente_id uuid REFERENCES public\.clientes\(id\)/);
  assert.match(migration, /vendas_cliente_data_idx/);
  assert.doesNotMatch(migration, /cliente_id uuid NOT NULL/);
  assert.doesNotMatch(migration, /GRANT[^;]*UPDATE ON public\.vendas/i);
});

test("relatório financeiro deriva de vendas e despesas sem subsistema de pagamentos", () => {
  assert.match(migration, /despesas_loja_data_idx/);
  assert.match(migration, /despesas_categoria_data_idx/);
  for (const termo of ["pagamentos", "recebimentos", "parcelas", "troco", "taxas", "caixa"])
    assert.doesNotMatch(migration, new RegExp(`public\\.${termo}\\b`, "i"));
});

test("runtime tem DML mínimo e migration é transacional e versionada", () => {
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
  assert.match(migration, /202610250001_metas/);
  assert.match(migration, /202610260001_clientes_financeiro/);
  assert.match(migration, /:'hash_migracao'/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.clientes/);
  assert.match(migration, /GRANT SELECT, INSERT ON public\.despesas/);
  assert.doesNotMatch(migration, /GRANT[^;]*(DELETE|TRUNCATE)/i);
  assert.doesNotMatch(migration, /CREATE (DATABASE|ROLE|USER)|ALTER ROLE|PASSWORD|HOSTSSL/i);
});

