-- Cadastro inicial PH Outlet: dados operacionais, sem DDL ou senha humana.
-- Executar uma unica vez pelo responsavel, via psql -X -v ON_ERROR_STOP=1,
-- apos o Platform Agent confirmar issuer/sub da identidade prodexy.labs@gmail.com.
-- Parametros obrigatorios: emissor_cognito, sub_cognito, hash_migracao.
-- A ausencia de qualquer parametro causa erro e rollback; nao editar este arquivo apos aplicar.
BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SET LOCAL ph_cadastro.emissor = :'emissor_cognito';
SET LOCAL ph_cadastro.sub = :'sub_cognito';

DO $$
BEGIN
  IF current_setting('ph_cadastro.emissor') <> 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Jm4EQEGdZ'
     OR length(btrim(current_setting('ph_cadastro.sub'))) = 0 THEN
    RAISE EXCEPTION 'Identidade Cognito ausente ou emissor divergente; cadastro nao aplicado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.migracoes_schema WHERE versao = '202610140001_inicial'
  ) THEN
    RAISE EXCEPTION 'Migration inicial ausente; cadastro nao aplicado';
  END IF;
END;
$$;

-- Bloqueia escritas concorrentes apenas durante este cadastro curto.
LOCK TABLE public.lojas, public.usuarios, public.usuarios_lojas,
  public.sequencias_categoria IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lojas)
     OR EXISTS (SELECT 1 FROM public.usuarios)
     OR EXISTS (SELECT 1 FROM public.usuarios_lojas)
     OR EXISTS (SELECT 1 FROM public.sequencias_categoria) THEN
    RAISE EXCEPTION 'Cadastro inicial requer lojas, usuarios, vinculos e contadores vazios';
  END IF;
END;
$$;

INSERT INTO public.lojas (id, nome, ativa) VALUES
  ('adc87f08-4917-410a-977d-afb821e2d8da', 'PH Outlet', true),
  ('47d1d6eb-cdda-4780-abaa-9aa21f4bb23b', 'PH Kids', true);

INSERT INTO public.sequencias_categoria (loja_id, proximo_codigo) VALUES
  ('adc87f08-4917-410a-977d-afb821e2d8da', 1),
  ('47d1d6eb-cdda-4780-abaa-9aa21f4bb23b', 1);

-- O schema nao possui coluna de e-mail; o nome identifica este perfil inicial.
-- O vinculo real de login depende exclusivamente do issuer/sub confirmado.
INSERT INTO public.usuarios
  (id, emissor_cognito, sub_cognito, nome_exibicao, perfil, ativo)
VALUES
  ('4e403e3b-33c6-412e-a42d-12e6e5673295',
   current_setting('ph_cadastro.emissor'), current_setting('ph_cadastro.sub'),
   'prodexy.labs@gmail.com', 'administrador', true);

INSERT INTO public.usuarios_lojas (usuario_id, loja_id, ativo) VALUES
  ('4e403e3b-33c6-412e-a42d-12e6e5673295', 'adc87f08-4917-410a-977d-afb821e2d8da', true),
  ('4e403e3b-33c6-412e-a42d-12e6e5673295', '47d1d6eb-cdda-4780-abaa-9aa21f4bb23b', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.lojas WHERE ativa) <> 2
     OR (SELECT count(*) FROM public.sequencias_categoria WHERE proximo_codigo = 1) <> 2
     OR (SELECT count(*) FROM public.usuarios WHERE perfil = 'administrador' AND ativo) <> 1
     OR (SELECT count(*) FROM public.usuarios_lojas WHERE ativo) <> 2 THEN
    RAISE EXCEPTION 'Pos-verificacao do cadastro inicial falhou; rollback';
  END IF;
END;
$$;

INSERT INTO public.migracoes_schema (versao, hash_sha256)
VALUES ('202610240001_cadastro_inicial', :'hash_migracao');

COMMIT;
