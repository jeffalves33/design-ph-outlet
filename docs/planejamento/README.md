# Entrada do planejamento — PH Outlet

Status: construção local concluída e validada até P6.4 em 2026-11-03. P7 está adiado, não iniciado e sem autorização. As pendências de release permanecem documentadas para solicitação futura; não são bloqueio nem trabalho atual.

Leia [AGENTS ativo](../../AGENTS.md), [contexto](QUESTIONARIO-INICIAL.md), [decisões atuais](DECISOES-PENDENTES.md), [governança](../governanca/README.md), [ExecPlan aprovado](../prodexy/plans/2026-10-12-construcao.md), [handoff do banco](HANDOFF-BANCO.md) e [handoff Auth](HANDOFF-AUTH.md).

## Prompt de início

```text
Trabalhe em D:\Prodexy\Prodexy-Ph-Outlet como agente executor.
Leia AGENTS.md e docs/planejamento/README.md com seus contratos referenciados. Execute docs/prodexy/plans/2026-10-12-construcao.md, aprovado para início.
Confira branch/working tree e preserve alterações existentes. Comece P0/P1 nos marcos elegíveis, sem pedir novamente aprovação do plano ou reabrir decisões resolvidas. Agrupe perguntas residuais por gate; não invente requisitos.
Execute apenas o primeiro bloco elegível, identificado por Pn.n; não execute P0/P1 inteiras. Se já houver execução em andamento, apresente o estado e confirme o recorte atual antes de ampliar o trabalho.
Trabalhe somente neste repositório, mantenha contratos e evidências no ExecPlan. Não faça push, deploy ou operações remotas sem autorização.
Ao chegar à construção efetiva do schema, interrompa integralmente o desenvolvimento e solicite provisionamento pelo Platform Agent conforme HANDOFF-BANCO.md. Retome somente após handoff e liberação explícita. Depois mantenha database/schema.sql e migrations coerentes; notifique cada migration para execução manual pelo responsável, aguardando evidência antes das etapas dependentes. Nunca leia valores de secrets.
Cada entrega: Feito (tópicos curtos e validações); Migrations (nenhuma/preparada aguardando responsável/aplicada com evidência); Fase atual (estimativa do que falta, próximo passo e bloqueios).
Ao terminar o bloco, atualize seus checks de execução, apresente validações e pare para meu aceite. Não inicie o próximo bloco sem minha confirmação explícita. Não marque minha validação ou liberação por conta própria. Gates de banco, decisões e operações remotas também permanecem obrigatórios.
```

## Limites do aceite

Nenhuma nova aprovação do plano é necessária para começar. Decisões residuais de catálogo, UI/lock, banco/Auth, aplicação de migrations e homologação física permanecem nos gates correspondentes. Nenhum código, SQL ou recurso remoto foi criado por este pacote.
