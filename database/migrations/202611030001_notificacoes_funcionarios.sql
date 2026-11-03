BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202610260001_clientes_financeiro'
  ) THEN
    RAISE EXCEPTION 'Migration de clientes e financeiro ausente; pare';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.migracoes_schema
     WHERE versao = '202611030001_notificacoes_funcionarios'
  ) THEN
    RAISE EXCEPTION 'Migration de notificacoes e funcionarios ja aplicada; nao repetir';
  END IF;
  IF to_regclass('public.notificacoes_lidas') IS NOT NULL
     OR EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usuarios'
          AND column_name = 'email'
     ) THEN
    RAISE EXCEPTION 'Objetos de notificacoes ou funcionarios ja existem sem ledger esperado; pare para diagnostico';
  END IF;
END;
$$;

ALTER TABLE public.usuarios
  ADD COLUMN email text CHECK (
    email IS NULL OR (length(btrim(email)) BETWEEN 3 AND 254 AND position('@' IN btrim(email)) > 1)
  );

CREATE UNIQUE INDEX usuarios_email_uidx ON public.usuarios (lower(btrim(email)))
  WHERE email IS NOT NULL;

CREATE TABLE public.notificacoes_lidas (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  chave text NOT NULL CHECK (length(btrim(chave)) BETWEEN 1 AND 240),
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, chave)
);

CREATE INDEX notificacoes_lidas_usuario_data_idx
  ON public.notificacoes_lidas (usuario_id, lida_em DESC);

GRANT SELECT, INSERT, UPDATE ON public.notificacoes_lidas TO prodexy_ph_outlet_app;

INSERT INTO public.migracoes_schema (versao, hash_sha256)
VALUES (
  '202611030001_notificacoes_funcionarios',
  '6454b71652a75c7c44f165a6c0fc2ef8fbd38aff4a8a4b2830d326acda08d482'
);

COMMIT;
