# Gate obrigatório de banco

Status: PROCEDIMENTO APROVADO em 2026-10-12. Provisionamento P2.2 evidenciado em 2026-10-14; handoff aguardando validação explícita do responsável. Nenhum schema ou migration de negócio aplicado.

## Responsabilidades

O Project Agent prepara modelagem, contrato de schema e SQL versionado. Não provisiona database, roles, secrets, grants estruturais ou HBA da plataforma. Ao alcançar o início da construção efetiva do schema, interrompe o desenvolvimento e solicita ao responsável o acionamento do Platform Agent. Não continua tarefas independentes para contornar esta parada.

O Platform Agent conduz o provisionamento do banco dedicado no DB Node aprovado, com autorização e evidências: database, owner/roles mínimos, isolamento, HBA, referência de credencial server-side e orçamento de conexões. Se não houver acesso direto, orienta execução pelo responsável; não declara criação sem evidência. Não cria nova EC2 nem altera a D3 por inferência.

O responsável preenche valores privados, executa migrations de negócio pelo SQL Editor do Prodexy Sistema e devolve evidência não secreta. O Project Agent retoma somente após handoff explícito do Platform Agent e liberação do responsável. Preparar SQL não equivale a aplicá-lo; provisão do database não equivale a schema de negócio aplicado.

## Solicitação do construtor

Mensagem obrigatória:

> BLOQUEADO — PROVISIONAMENTO DO BANCO. Cheguei ao gate de construção do schema. O contrato e as necessidades do banco estão documentados; não criei database, roles, secrets ou regra HBA. Acione o Platform Agent para provisionar o banco e devolver o handoff. Desenvolvimento interrompido até liberação explícita.

Anexar no próprio projeto: ambiente pretendido; modelo/decisões resolvidas; versão PostgreSQL/extensões necessárias (ou nenhuma); paths e revisão dos artefatos; capacidade/conexões estimadas; permissões runtime e manutenção; necessidades de teste/backup. Sem valores privados. Dúvidas de modelo permanecem visíveis; não inventar nomes existentes.

## Devolução do Platform Agent — P2.2

- Status/data: infraestrutura do database provisionada e evidenciada em 2026-10-14; handoff **validado pelo responsável** em 2026-10-14, com liberação somente para P2.3.
- Ambiente: production, EC2 DB Node 01 `i-065fe5928e2c923e1`, perfil `DIURNO` (sem agendamento de desligamento), PostgreSQL 17.11, `db01.prodexylabs.com:5432`, database `prodexy_ph_outlet`. Nenhuma extensão adicional requerida ou criada.
- Identidades: `postgres` permanece owner/administrador local do database; `prodexy_sistema_sql_executor` atende o SQL Editor administrativo e controla os objetos públicos; `prodexy_ph_outlet_app` é role exclusiva do runtime PH, sem privilégios administrativos, com LOGIN/SCRAM, `CONNECT` apenas no database PH e `CONNECTION LIMIT 4`. `PUBLIC` não tem privilégios no database PH e a role PH não acessa o database administrativo `postgres`.
- Rede e autenticação: HBA `hostssl prodexy_ph_outlet prodexy_ph_outlet_app 0.0.0.0/0 scram-sha-256` antes das rejeições globais; conexão externa CloudShell validou hostname/cadeia com `sslmode=verify-full`, role/database PH e TLS 1.3. Regras sem TLS e pares não autorizados permanecem rejeitados por configuração HBA; tentativas negativas não foram repetidas após esta edição. A regra D3 do Security Group TCP 5432 IPv4 permanece compartilhada; nenhuma regra SG nova foi criada para PH.
- Credencial: identificador privado `PRODEXY_PROD_PH_OUTLET_DB_PASSWORD`, finalidade senha da role runtime, destino cofre seguro do responsável, valor acessível somente a ele; o agente não recebeu ou verificou o valor no cofre. Para a aplicação, `DATABASE_URL` será configurada **somente** no ambiente server-side do projeto na Vercel pelo responsável, sem `NEXT_PUBLIC_*`, nunca no navegador ou documentação. Variável Vercel não criada/validada nesta etapa.
- Capacidade: limite efetivo da role é 4 conexões simultâneas no cluster de 50 (`superuser_reserved_connections=3`). Proposta conservadora para P2.4: pool global reutilizado com `max=1` por instância Node/Vercel e `attachDatabasePool` em Fluid Compute. Escala horizontal pode atingir o limite agregado de 4; o executor deverá tratar indisponibilidade/timeout e não aumentar pool ou cap sem novo dimensionamento/aceite. A configuração de pool ainda não foi implementada nem aprovada pelo responsável.
- Schema/migrations aplicados: **NENHUM**. `database/schema.sql` e `database/migrations` ainda serão preparados pelo executor em P2.3; aplicação de cada migration cabe ao responsável após aviso explícito.
- Testes: conexão externa de infraestrutura validada, não teste de aplicação. Nenhum database descartável de homologação/replay foi provisionado ou autorizado; não usar produção para testes destrutivos, fixtures ou replay. Ambiente de teste requer decisão/etapa própria antes dessas verificações.
- Backup: execução manual da rotina existente confirmou `DATABASE_VERIFIED` de `prodexy_ph_outlet` e `BACKUP_SUCCESS databases=2`, com serviço `Result=success`/`ExecMainStatus=0` em 2026-10-15 00:56 UTC. Manifesto no prefixo diário S3; restore do PH não testado. Responsável opera e valida a recuperação conforme etapa posterior.
- Fontes canônicas: [RESOURCE_REGISTRY](../../../docs/platform/aws/RESOURCE_REGISTRY.md) e [BUILD_LEDGER](../../../docs/platform/aws/BUILD_LEDGER.md), atualizados nessa ordem. Evidências detalhadas e IDs permanecem lá; sem valores privados neste projeto.
- Validação do responsável e autorização para P2.3: **RECEBIDAS em 2026-10-14**. Autorização restrita ao preparo de schema e migration; aplicação manual pelo responsável após revisão. P2.4 e demais blocos não autorizados.

## Cada migration posterior

Construtor atualiza `schema.sql`, prepara migration imutável e testes, então avisa explicitamente: MIGRATION PENDENTE DE EXECUÇÃO PELO RESPONSÁVEL. Informar arquivo/ordem, database alvo `prodexy_ph_outlet`, pré-condições, impacto e pós-check. O responsável cola e executa o SQL em `/infraestrutura/sql`, com PH Outlet selecionado, e devolve o resultado sem segredos. Não aplicar por conta própria nem presumir deploy automático. Etapas dependentes ficam bloqueadas até confirmação. Alteração de database, roles, HBA ou infraestrutura volta ao Platform Agent. SSM não é o fluxo normal de migrations.
