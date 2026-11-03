# PH Outlet

Aplicação Next.js App Router do PH Outlet, preservando a interface original. Catálogo, estoque, vendas, comprovantes, metas, CRM e financeiro usam backend server-side e persistência PostgreSQL; autenticação usa Cognito. A homologação real completa, os dispositivos físicos e a publicação continuam pendentes. Não publicar esta base sem concluir os gates do ExecPlan.

## Executar

Alvo Node 22.x. Dependências Next 16.4.0, React 19.2.8 e Tailwind 4.3.3 pinadas no manifesto. `package-lock.json` é o lock autoritativo; o legado Bun/Vite/TanStack foi removido em P6.1.

- `npm ci` — instalação pelo lock (instalação limpa com Node 22 ainda requer validação).
- `npm run dev -- --hostname 127.0.0.1` — prévia local.
- `npm run check` — typecheck, lint, testes unitários locais e build.
- `npm run build` e `npm run preview -- --hostname 127.0.0.1` — build e prévia local de produção.

Saída Next em `.next-p1/`, isolada do cache da tentativa anterior. Nenhum desses comandos aplica migrations.

## Estrutura e limites

`src/app` entrega rotas, layout, APIs e estados de navegação; `src/features` contém domínio, persistência e as composições originais adaptadas. `src/features/workspace/contexto.tsx` mantém somente o escopo visual e as lojas carregadas do backend, sem identidade ou dados comerciais.

Seletor, menus, filtros e diálogos foram preservados. Login, catálogo, estoque, venda, comprovante, metas, clientes e despesas possuem implementação local real; pagamentos, desconto, cancelamentos, trocas e devoluções permanecem fora da V1. A homologação mutável real e de hardware ainda é necessária antes da publicação.

O runtime é exclusivamente Next. P6.1 removeu router/start/server/store antigos, fixtures, autenticação simulada e dependências TanStack/Vite/Nitro/Bun sem consumidores. Seis caminhos legados que não puderam ser excluídos no workspace são módulos-túmulo vazios e não entram no grafo Next. A adoção de `@prodexy/ui` foi adiada pelo responsável até correção da biblioteca. O teste sob Node 22 permanece pendente.

`src/integrations/server/env-contract.ts` marca integrações como server-only e valida nomes de variáveis, sem ler arquivos `.env` ou registrar valores. Valores são preenchidos privadamente pelo responsável. Operações remotas e deploy exigem autorização explícita.

P2.4 implementou a integração PostgreSQL em `src/integrations/server/postgres-*.ts`: `DATABASE_URL` pertence exclusivamente ao runtime server-side e usa a role mínima `prodexy_ph_outlet_app`. O módulo exige TLS com certificado e hostname verificados, limita o pool a uma conexão por instância, aplica timeouts, usa parâmetros separados do SQL, sanitiza falhas e libera clientes em `finally`. `attachDatabasePool` atua em Fluid Compute quando `VERCEL=1`. O construtor não lê nem registra valores privados.

O limite da role é quatro conexões **agregadas**: quatro instâncias com pool cheio já atingem o teto, sem reserva para transições ou outras conexões da mesma role. O pool local não impõe limite horizontal à Vercel; antes de ativar o backend é necessário aprovar/validar orçamento de instâncias e comportamento sob saturação. Testes atuais são simulados, sem consulta à produção nem replay de migrations. P1.4 ainda não recebeu aceite explícito.

Progresso e evidências: [ExecPlan](docs/prodexy/plans/2026-10-12-construcao.md). O próximo bloco exige autorização explícita. O schema canônico e todas as migrations permanecem em `database/`; migrations aplicadas não devem ser repetidas.
