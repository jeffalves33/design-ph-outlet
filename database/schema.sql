-- Estado canônico incluindo as seis migrations aplicadas.
-- PostgreSQL 17; executar com a identidade de manutenção no database PH.
-- Sem dados de exemplo, extensões, criação de database/role ou infraestrutura.
BEGIN;

CREATE TABLE public.migracoes_schema (
  versao text PRIMARY KEY CHECK (versao ~ '^[0-9]{12}_[a-z0-9_]+$'),
  hash_sha256 text NOT NULL CHECK (hash_sha256 ~ '^[0-9a-f]{64}$'),
  aplicada_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lojas (
  id uuid PRIMARY KEY,
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
  ativa boolean NOT NULL DEFAULT true,
  criada_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY,
  emissor_cognito text NOT NULL CHECK (length(trim(emissor_cognito)) > 0),
  sub_cognito text NOT NULL CHECK (length(trim(sub_cognito)) > 0),
  email text CHECK (
    email IS NULL OR (length(btrim(email)) BETWEEN 3 AND 254 AND position('@' IN btrim(email)) > 1)
  ),
  nome_exibicao text NOT NULL CHECK (length(trim(nome_exibicao)) > 0),
  perfil text NOT NULL CHECK (perfil IN ('administrador', 'vendedor')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emissor_cognito, sub_cognito)
);

CREATE TABLE public.usuarios_lojas (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  ativo boolean NOT NULL DEFAULT true,
  PRIMARY KEY (usuario_id, loja_id)
);

CREATE TABLE public.notificacoes_lidas (
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  chave text NOT NULL CHECK (length(btrim(chave)) BETWEEN 1 AND 240),
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, chave)
);

-- Um contador por loja; reservar o próximo código sob lock na transação do cadastro.
-- Criar a linha do contador ao cadastrar a loja e nunca reciclar códigos.
CREATE TABLE public.sequencias_categoria (
  loja_id uuid PRIMARY KEY REFERENCES public.lojas(id),
  proximo_codigo integer NOT NULL DEFAULT 1 CHECK (proximo_codigo BETWEEN 1 AND 100000)
);

CREATE TABLE public.categorias (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  codigo integer NOT NULL CHECK (codigo BETWEEN 1 AND 99999),
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  tamanho text NOT NULL CHECK (length(btrim(tamanho)) BETWEEN 1 AND 40),
  preco_centavos bigint NOT NULL CHECK (preco_centavos >= 0),
  arquivada_em timestamptz,
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, codigo),
  UNIQUE (id, loja_id)
);

CREATE TABLE public.saldos_estoque (
  categoria_id uuid PRIMARY KEY,
  loja_id uuid NOT NULL,
  quantidade bigint NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (categoria_id, loja_id) REFERENCES public.categorias(id, loja_id),
  UNIQUE (categoria_id, loja_id)
);

CREATE TABLE public.operacoes_estoque (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  autor_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  chave_idempotencia text NOT NULL CHECK (length(chave_idempotencia) BETWEEN 1 AND 200),
  impressao_requisicao text NOT NULL CHECK (impressao_requisicao ~ '^[0-9a-f]{64}$'),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'ajuste')),
  motivo text NOT NULL CHECK (length(trim(motivo)) > 0),
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, chave_idempotencia),
  UNIQUE (id, loja_id)
);

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

CREATE TABLE public.vendas (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id),
  autor_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  vendedor_usuario_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id),
  chave_idempotencia text NOT NULL CHECK (length(chave_idempotencia) BETWEEN 1 AND 200),
  impressao_requisicao text NOT NULL CHECK (impressao_requisicao ~ '^[0-9a-f]{64}$'),
  total_centavos bigint NOT NULL CHECK (total_centavos >= 0),
  realizada_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (vendedor_usuario_id, loja_id) REFERENCES public.usuarios_lojas(usuario_id, loja_id),
  UNIQUE (loja_id, chave_idempotencia),
  UNIQUE (id, loja_id)
);

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

CREATE TABLE public.itens_venda (
  id uuid PRIMARY KEY,
  venda_id uuid NOT NULL,
  loja_id uuid NOT NULL,
  categoria_id uuid NOT NULL,
  codigo_registrado integer NOT NULL CHECK (codigo_registrado BETWEEN 1 AND 99999),
  nome_registrado text NOT NULL CHECK (length(trim(nome_registrado)) > 0),
  tamanho_registrado text NOT NULL CHECK (length(btrim(tamanho_registrado)) BETWEEN 1 AND 40),
  preco_unitario_centavos bigint NOT NULL CHECK (preco_unitario_centavos >= 0),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  total_linha_centavos bigint NOT NULL CHECK (total_linha_centavos >= 0 AND total_linha_centavos = preco_unitario_centavos * quantidade),
  FOREIGN KEY (venda_id, loja_id) REFERENCES public.vendas(id, loja_id),
  FOREIGN KEY (categoria_id, loja_id) REFERENCES public.categorias(id, loja_id),
  UNIQUE (venda_id, categoria_id)
);

CREATE TABLE public.movimentos_estoque (
  id uuid PRIMARY KEY,
  loja_id uuid NOT NULL,
  categoria_id uuid NOT NULL,
  autor_usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  operacao_estoque_id uuid,
  venda_id uuid,
  variacao_quantidade bigint NOT NULL CHECK (variacao_quantidade <> 0),
  saldo_apos bigint NOT NULL CHECK (saldo_apos >= 0),
  motivo text NOT NULL CHECK (length(trim(motivo)) > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (categoria_id, loja_id) REFERENCES public.categorias(id, loja_id),
  FOREIGN KEY (operacao_estoque_id, loja_id) REFERENCES public.operacoes_estoque(id, loja_id),
  FOREIGN KEY (venda_id, loja_id) REFERENCES public.vendas(id, loja_id),
  CHECK (num_nonnulls(operacao_estoque_id, venda_id) = 1),
  CHECK (venda_id IS NULL OR variacao_quantidade < 0),
  UNIQUE (operacao_estoque_id, categoria_id),
  UNIQUE (venda_id, categoria_id)
);

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

CREATE INDEX usuarios_perfil_ativo_idx ON public.usuarios (perfil, ativo);
CREATE UNIQUE INDEX usuarios_email_uidx ON public.usuarios (lower(btrim(email)))
  WHERE email IS NOT NULL;
CREATE INDEX notificacoes_lidas_usuario_data_idx
  ON public.notificacoes_lidas (usuario_id, lida_em DESC);
CREATE INDEX categorias_loja_ativas_idx ON public.categorias (loja_id, codigo) WHERE arquivada_em IS NULL;
CREATE UNIQUE INDEX categorias_loja_nome_tamanho_ativas_uidx
  ON public.categorias (loja_id, lower(btrim(nome)), lower(btrim(tamanho)))
  WHERE arquivada_em IS NULL;
CREATE INDEX categorias_loja_nome_idx ON public.categorias (loja_id, lower(btrim(nome)));
CREATE INDEX vendas_loja_data_idx ON public.vendas (loja_id, realizada_em DESC);
CREATE INDEX vendas_vendedor_data_idx ON public.vendas (vendedor_usuario_id, realizada_em DESC);
CREATE INDEX vendas_cliente_data_idx
  ON public.vendas (cliente_id, realizada_em DESC)
  WHERE cliente_id IS NOT NULL;
CREATE INDEX movimentos_categoria_data_idx ON public.movimentos_estoque (categoria_id, criado_em DESC);
CREATE INDEX metas_vendedor_loja_periodo_idx
  ON public.metas (vendedor_usuario_id, loja_id, inicio_data, fim_data);
CREATE INDEX metas_loja_periodo_idx ON public.metas (loja_id, inicio_data, fim_data);
CREATE INDEX historico_metas_meta_versao_idx ON public.historico_metas (meta_id, versao DESC);
CREATE INDEX clientes_nome_idx ON public.clientes (lower(btrim(nome)));
CREATE INDEX clientes_loja_preferida_idx ON public.clientes (loja_preferida_id);
CREATE INDEX clientes_nascimento_idx ON public.clientes (data_nascimento)
  WHERE data_nascimento IS NOT NULL;
CREATE INDEX despesas_loja_data_idx ON public.despesas (loja_id, data_despesa DESC);
CREATE INDEX despesas_categoria_data_idx ON public.despesas (categoria, data_despesa DESC);

-- Apenas privilégios de objetos necessários ao runtime server-side; sem DDL ou DELETE.
GRANT USAGE ON SCHEMA public TO prodexy_ph_outlet_app;
GRANT SELECT ON public.lojas, public.usuarios, public.usuarios_lojas,
  public.sequencias_categoria, public.categorias, public.saldos_estoque,
  public.operacoes_estoque, public.vendas, public.itens_venda, public.movimentos_estoque,
  public.metas, public.historico_metas, public.clientes, public.despesas,
  public.notificacoes_lidas
  TO prodexy_ph_outlet_app;
GRANT INSERT ON public.lojas, public.usuarios, public.usuarios_lojas,
  public.sequencias_categoria, public.categorias, public.saldos_estoque,
  public.operacoes_estoque, public.vendas, public.itens_venda, public.movimentos_estoque,
  public.metas, public.historico_metas, public.clientes, public.despesas,
  public.notificacoes_lidas
  TO prodexy_ph_outlet_app;
GRANT UPDATE ON public.lojas, public.usuarios, public.usuarios_lojas,
  public.sequencias_categoria, public.categorias, public.saldos_estoque, public.metas,
  public.notificacoes_lidas
  TO prodexy_ph_outlet_app;

COMMIT;
-- Cadastro operacional inicial (sem DDL adicional): migration
-- 202610240001_cadastro_inicial.sql; estado de aplicacao no ExecPlan.
-- 202610240002_tamanho_categoria.sql aplicada manualmente conforme pós-check relatado pelo responsável em 2026-10-25; não repetir.
-- 202610250001_metas.sql aplicada manualmente conforme pos-check relatado pelo responsavel em 2026-10-25; nao repetir.
-- 202610260001_clientes_financeiro.sql aplicada manualmente conforme pos-check relatado pelo responsavel em 2026-10-26; nao repetir.
-- 202611030001_notificacoes_funcionarios.sql aplicada manualmente conforme pós-check relatado pelo responsável em 2026-11-03; não repetir.
