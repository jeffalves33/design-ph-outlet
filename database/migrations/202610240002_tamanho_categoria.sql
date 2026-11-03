-- Categoria por nome e tamanho; um codigo, preco e saldo por combinacao em cada loja.
-- Executar somente pelo responsavel no database PH, apos revisar o pre-check.
-- Parametro obrigatorio: hash_migracao calculado do arquivo exato.
-- Se houver categorias preexistentes, abortar sem inventar tamanhos.
BEGIN;

SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

LOCK TABLE public.categorias IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.migracoes_schema WHERE versao = '202610140001_inicial') THEN
    RAISE EXCEPTION 'Migration inicial ausente; alteracao nao aplicada';
  END IF;
  IF EXISTS (SELECT 1 FROM public.migracoes_schema WHERE versao = '202610240002_tamanho_categoria') THEN
    RAISE EXCEPTION 'Migration de tamanho ja aplicada; nao repetir';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categorias) THEN
    RAISE EXCEPTION 'Categorias preexistentes exigem mapeamento manual de tamanho; alteracao nao aplicada';
  END IF;
END;
$$;

ALTER TABLE public.categorias
  ADD COLUMN tamanho text NOT NULL CHECK (length(btrim(tamanho)) BETWEEN 1 AND 40);
ALTER TABLE public.itens_venda
  ADD COLUMN tamanho_registrado text NOT NULL CHECK (length(btrim(tamanho_registrado)) BETWEEN 1 AND 40);

CREATE UNIQUE INDEX categorias_loja_nome_tamanho_ativas_uidx
  ON public.categorias (loja_id, lower(btrim(nome)), lower(btrim(tamanho)))
  WHERE arquivada_em IS NULL;
CREATE INDEX categorias_loja_nome_idx ON public.categorias (loja_id, lower(btrim(nome)));

INSERT INTO public.migracoes_schema (versao, hash_sha256)
VALUES ('202610240002_tamanho_categoria', :'hash_migracao');

COMMIT;
