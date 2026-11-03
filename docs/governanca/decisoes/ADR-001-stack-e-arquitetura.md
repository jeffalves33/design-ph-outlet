# ADR-001 — Construção PH Outlet sobre a plataforma Prodexy

Status: ACEITA no plano aprovado; base Vercel/PostgreSQL/Cognito aprovada na plataforma e reafirmada pelo responsável. Decisões específicas pendentes em ../../planejamento/DECISOES-PENDENTES.md. Sem implementação.

## Contexto e decisão

Converter design frontend TanStack/Vite em monólito modular Next.js App Router/TypeScript strict. Frontend e APIs na Vercel, Node.js; PostgreSQL autogerenciado no DB Node existente. Não manter stack antiga por conveniência nem descartar identidade visual. Compatibilidade e versões exatas de Next/React/Node/UI serão verificadas em P1; não instalar latest indiscriminadamente nem copiar lockfile do Sonhando.

Persistência por pg, SQL parametrizado, repositories server-only e pool por instância com attachDatabasePool em Fluid Compute. TLS valida cadeia e hostname db01.prodexylabs.com:5432; SCRAM e role runtime mínima própria. Nunca credencial PostgreSQL no browser. Pool/CONNECTION LIMIT são dimensionados no onboarding, não fixados aqui. Não usar Supabase, PostgREST, ORM ou PgBouncer adicional como requisito inicial.

Cognito no pool compartilhado de dedicados com App Client próprio, provisionado somente em etapa autorizada. Login humano separado da conexão PostgreSQL. Backend valida token/sessão, issuer, audiência/client_id conforme tipo, validade e vínculo local ativo; cadastro público permanece desabilitado. Escolher fluxo Cognito compatível com a interface durante P2, não inventar domínio ou client existente. Administração local controla autorização da aplicação, não acesso AWS.

## Módulos alvo

- src/app: rotas, layouts e handlers/actions, sem SQL disperso.
- src/features: catalogo, estoque, vendas, equipe/metas e módulos opcionais aprovados; cada feature com domínio/testes e camada server quando necessário.
- src/shared: sessão, autorização, validação, erros, dinheiro/datas e observabilidade realmente comuns.
- src/integrations: PostgreSQL e Cognito, outros providers somente se aprovados.
- src/branding: identidade Outlet/Kids; @prodexy/ui fornece primitivas, não permissões ou regras PH.

Começar simples; não criar classes vazias nem framework genérico. Separar requireSession/authorize de componentes de login. Quando houver repetição comprovada, registrar candidato transversal e pedir revisão ao Platform Agent; nenhum pacote compartilhado ou alteração de outro repo por este plano.

## Contrato de dados proposto, não DDL

Conforme D02 validada em 2026-10-14, categoria é cadastrada por loja, com código e preço independentes entre lojas. Revisão D01 de 2026-10-24: cada combinação loja+nome+tamanho tem código, preço e saldo próprios. Metas permitem múltiplos registros por funcionário e prazo livre; não impor UNIQUE por funcionário/mês. Cancelamentos/trocas/devoluções excluídos; não modelar tabelas de reversão na V1. Contrato detalhado de cálculo das metas permanece D04.

Um database dedicado ao projeto. Duas lojas são entidades internas, não databases nem tenants SaaS. Entidades: lojas; perfis (issuer/sub, ativo, papel); vínculos perfil/loja; categorias identificadas por nome e tamanho, cada uma com código e preço próprios; códigos incrementais de cinco dígitos por loja; saldos e movimentos separados por categoria/loja; vendas; itens de venda com snapshots; metas por vendedor/período conforme D04; clientes; despesas; auditoria/idempotência. Unicidade do código é por loja; a visão ambas não funde categorias com mesmo código. D08 confirmou cliente opcional na venda e relatório gerencial derivado de vendas/despesas. Não criar tabelas/campos de meios de pagamento, taxas, parcelas, troco ou caixa na V1. Reversões excluídas. Não armazenar senha humana. Contexto ambas não cria terceiro estoque. Comprovante é não fiscal.

Constraints/FKs/uniqueness e índices acompanham casos de uso; moeda exata, timestamps com timezone e datas comerciais explícitas. Estado final em database/schema.sql, evolução em database/migrations; role runtime não cria objetos. Role de manutenção é separada e operada pelo responsável. SQL de negócio não deve criar roles globais, grants amplos ou recursos AWS.

## Alternativas e consequências

Não copiar Supabase Auth/RLS/auth.uid()/RPCs do Sonhando: são referência metodológica, não stack alvo. Duas lojas exigem autorização e consistência transacional reais. UI reutilizável não implica permissão por menu. Backend server-side recebe a responsabilidade antes simulada no browser. Custos de runtime/dados dependem de uso; sem novo gateway fixo.

Perfil DIURNO declarado pelo responsável. Desligamento é futuro no node compartilhado, depende de todos os workloads, backup 06:00 UTC e jobs; não criar agenda neste projeto. Aplicação continua online-only como proposta até D10; indisponibilidade não pode gerar venda falsa.
