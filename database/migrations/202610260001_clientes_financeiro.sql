BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202610250001_metas'
  ) THEN
    RAISE EXCEPTION 'Migration de metas ausente; CRM e financeiro nao aplicados';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202610260001_clientes_financeiro'
  ) THEN
    RAISE EXCEPTION 'Migration de clientes e financeiro ja aplicada; nao repetir';
  END IF;
  IF to_regclass('public.clientes') IS NOT NULL
     OR to_regclass('public.despesas') IS NOT NULL
     OR EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vendas'
          AND column_name = 'cliente_id'
     ) THEN
    RAISE EXCEPTION 'Objetos de clientes ou financeiro ja existem sem ledger esperado; pare para diagnostico';
  END IF;
END;
$$;

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 160),
  whatsapp_digitos text NOT NULL CHECK (whatsapp_digitos ~ '^[0-9]{10,15}$'),
  data_nascimento date,
  cidade text CHECK (cidade IS NULL OR length(btrim(cidade)) BETWEEN 1 AND 120),
  loja_preferida_id uuid REFERENCES public.lojas(id),
  observacao text CHECK (observacao IS NULL OR length(btrim(observacao)) BETWEEN 1 AND 1000),
  criada_por_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (whatsapp_digitos)
);

ALTER TABLE public.vendas
  ADD COLUMN cliente_id uuid REFERENCES public.clientes(id);

CREATE TABLE public.despesas (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 200),
  categoria text NOT NULL CHECK (
    categoria IN ('fornecedores', 'aluguel', 'folha', 'marketing', 'operacional')
  ),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  data_despesa date NOT NULL,
  criada_por_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, loja_id)
);

CREATE INDEX vendas_cliente_data_idx
  ON public.vendas (cliente_id, realizada_em DESC)
  WHERE cliente_id IS NOT NULL;
CREATE INDEX clientes_nome_idx ON public.clientes (lower(btrim(nome)));
CREATE INDEX clientes_loja_preferida_idx ON public.clientes (loja_preferida_id);
CREATE INDEX clientes_nascimento_idx ON public.clientes (data_nascimento)
  WHERE data_nascimento IS NOT NULL;
CREATE INDEX despesas_loja_data_idx ON public.despesas (loja_id, data_despesa DESC);
CREATE INDEX despesas_categoria_data_idx ON public.despesas (categoria, data_despesa DESC);

GRANT SELECT, INSERT ON public.clientes TO prodexy_ph_outlet_app;
GRANT SELECT, INSERT ON public.despesas TO prodexy_ph_outlet_app;

INSERT INTO public.migracoes_schema (versao, hash_sha256)
VALUES ('202610260001_clientes_financeiro', :'hash_migracao');

COMMIT;
