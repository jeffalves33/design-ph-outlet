# Governança — PH Outlet

Status: construção local concluída e validada até P6.4 em 2026-11-03. P7 está adiado, não iniciado e sem autorização. Homologações reais, equipamentos físicos e publicação permanecem documentados como pendências futuras de release, não como bloqueio ou trabalho atual; o ExecPlan é a fonte do estado por bloco.

## Ordem de leitura do executor

1. [Entrada e handoff](../planejamento/README.md).
2. [Questionário consolidado](../planejamento/QUESTIONARIO-INICIAL.md) e [decisões pendentes](../planejamento/DECISOES-PENDENTES.md).
3. [Arquitetura](decisoes/ADR-001-stack-e-arquitetura.md), [regras](REGRAS-NEGOCIO.md), [casos de uso](CASOS-DE-USO.md) e [inventário](INVENTARIO-FUNCIONAL.md).
4. [Runbook](RUNBOOK-OPERACIONAL.md).
5. [ExecPlan](../prodexy/plans/2026-10-12-construcao.md), único checklist/progresso de construção.

Banco alvo: `database/schema.sql` e `database/migrations/*.sql`, a criar pelo construtor após decisões de dados. O schema representa estado final; migrations representam evolução. Não duplicar SQL aqui. Atualizar contratos, implementação e testes juntos. Não reabrir checklist concluído para uma nova versão.

As regras aqui são locais. Plataforma não recebe nomes, tabelas ou permissões específicas do PH. Reutilização transversal requer evidência e aprovação separada.
