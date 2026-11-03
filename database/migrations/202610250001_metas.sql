-- Metas por vendedor e loja, com periodo civil e historico imutavel de revisoes.
-- Executar somente pelo responsavel no database PH, apos revisar o pre-check.
-- Parametro obrigatorio: hash_migracao calculado do arquivo exato.
BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202610240002_tamanho_categoria'
  ) THEN
    RAISE EXCEPTION 'Migration de tamanho ausente; metas nao aplicadas';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202610250001_metas'
  ) THEN
    RAISE EXCEPTION 'Migration de metas ja aplicada; nao repetir';
  END IF;
  IF to_regclass('public.metas') IS NOT NULL
     OR to_regclass('public.historico_metas') IS NOT NULL THEN
    RAISE EXCEPTION 'Objetos de metas ja existem sem ledger esperado; pare para diagnostico';
  END IF;
END;
$$;

CREATE TABLE public.metas (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  vendedor_usuario_id uuid NOT NULL,
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  alvo_centavos bigint NOT NULL CHECK (alvo_centavos > 0),
  inicio_data date NOT NULL,
  fim_data date NOT NULL,
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  criada_por_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  atualizada_por_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (vendedor_usuario_id, loja_id)
    REFERENCES public.usuarios_lojas(usuario_id, loja_id),
  CHECK (inicio_data <= fim_data),
  UNIQUE (id, loja_id)
);

CREATE TABLE public.historico_metas (
  id uuid PRIMARY KEY,
  meta_id uuid NOT NULL,
  loja_id uuid NOT NULL,
  vendedor_usuario_id uuid NOT NULL,
  versao integer NOT NULL CHECK (versao > 0),
  nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  alvo_centavos bigint NOT NULL CHECK (alvo_centavos > 0),
  inicio_data date NOT NULL,
  fim_data date NOT NULL,
  tipo_alteracao text NOT NULL CHECK (tipo_alteracao IN ('criacao', 'edicao')),
  alterada_por_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  alterada_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (meta_id, loja_id) REFERENCES public.metas(id, loja_id),
  FOREIGN KEY (vendedor_usuario_id, loja_id)
    REFERENCES public.usuarios_lojas(usuario_id, loja_id),
  CHECK (inicio_data <= fim_data),
  UNIQUE (meta_id, versao)
);

CREATE INDEX metas_vendedor_loja_periodo_idx
  ON public.metas (vendedor_usuario_id, loja_id, inicio_data, fim_data);
CREATE INDEX metas_loja_periodo_idx ON public.metas (loja_id, inicio_data, fim_data);
CREATE INDEX historico_metas_meta_versao_idx
  ON public.historico_metas (meta_id, versao DESC);

GRANT SELECT, INSERT, UPDATE ON public.metas TO prodexy_ph_outlet_app;
GRANT SELECT, INSERT ON public.historico_metas TO prodexy_ph_outlet_app;

INSERT INTO public.migracoes_schema (versao, hash_sha256)
VALUES ('202610250001_metas', :'hash_migracao');

COMMIT;
