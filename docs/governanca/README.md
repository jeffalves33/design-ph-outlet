# Governança — PH Outlet

Status: P0–P7 concluídos. Extensão P8.1 PWA concluída e validada localmente em 2026-11-03, aguardando aceite e autorização separada para publicação; o ExecPlan é a fonte do estado por bloco.

## Ordem de leitura do executor

1. [Entrada e handoff](../planejamento/README.md).
2. [Questionário consolidado](../planejamento/QUESTIONARIO-INICIAL.md) e [decisões pendentes](../planejamento/DECISOES-PENDENTES.md).
3. [Arquitetura](decisoes/ADR-001-stack-e-arquitetura.md), [regras](REGRAS-NEGOCIO.md), [casos de uso](CASOS-DE-USO.md) e [inventário](INVENTARIO-FUNCIONAL.md).
4. [Runbook](RUNBOOK-OPERACIONAL.md).
5. [ExecPlan](../prodexy/plans/2026-10-12-construcao.md), único checklist/progresso de construção.

Banco alvo: `database/schema.sql` e `database/migrations/*.sql`, a criar pelo construtor após decisões de dados. O schema representa estado final; migrations representam evolução. Não duplicar SQL aqui. Atualizar contratos, implementação e testes juntos. Não reabrir checklist concluído para uma nova versão.

As regras aqui são locais. Plataforma não recebe nomes, tabelas ou permissões específicas do PH. Reutilização transversal requer evidência e aprovação separada.
