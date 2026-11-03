# Inventário observado e transição — PH Outlet

Discovery estático iniciado em 2026-10-12 e complementado por execução visual local no mesmo dia. Ainda não há validação de build da base Next nem homologação do responsável. Fontes: package.json, locks, tsconfig.json, src/routes, src/components/app-shell.tsx, src/lib/store.tsx, assets e contratos do protótipo. Não reproduzir dados pessoais ou credenciais demonstrativas da referência.

## Evidência visual P1.1 — execução local

O protótipo TanStack foi iniciado somente em `127.0.0.1`, com cache temporário isolado, para inspeção responsiva no navegador. Foram observados login, painel administrativo, estoque, vendas e a visão de vendedor em `/meu-desempenho`. O servidor e a sessão de demonstração foram encerrados após a captura. Não houve acesso remoto, dado real ou envio de formulário externo.

| Superfície observada | Referência visual preservável | Divergência contratual — não transportar como regra |
|---|---|---|
| Login | Fundo off-white, painel grafite em desktop, dupla marca, campos e ação principal de alto contraste | Preenchimento de credenciais de demonstração e autenticação em memória |
| Shell administrativo | Topbar compacta, seletor de loja, cards brancos arredondados, sidebar no desktop e menu compacto no viewport estreito | Sinos/contagens e usuário mock não comprovam requisito |
| Painel | Hierarquia título → ações → cards → gráficos/listas; cartões em duas colunas no viewport estreito | Faturamento, resultado, ticket e relatórios dependem da implementação P5.2 aprovada em escopo |
| Estoque | Cards de indicadores, catálogo, destaque de reposição, ações de entrada/etiqueta e identidade por loja | Protótipo usa “modelo”, SKU, tamanho e cor; correção de 2026-10-24 exige categoria por nome+tamanho, com código/preço/saldo próprios por combinação; cor não foi solicitada |
| Vendas | Jornada visual leitor → sacola → resumo, foco no campo de leitura e feedback de caixa | Cliente, meios de pagamento, desconto e atualização de estoque mock estão fora ou sem aprovação |
| Vendedor | Shell reduzido, cards de atingimento, progresso e lista pessoal | Meta mensal fixa, dados pessoais exibidos e detalhes de pagamento não definem o contrato aprovado |

Durante navegação direta em estoque e vendas, o runtime legado registrou `hydration mismatch`; a UI foi regenerada no cliente e ficou visível. Isso é limitação comprovada do protótipo, não regressão atribuída à base Next. A captura foi feita em viewport estreito do navegador integrado; a matriz desktop completa permanece para homologação posterior.

### Composição, tokens e assets

- Identidade: `public/ph_outlet.png` e `public/ph_kids.png`, ambos PNG 150×150, observados no login e no shell. Preservação visual proposta; aprovação definitiva do cliente ainda depende do responsável.
- Cores: grafite profundo para navegação, azul-gelo como marca/acento, off-white no fundo, cartões brancos e estados verde/âmbar/vermelho sem depender apenas de cor.
- Forma: raio base de `0.875rem`, cards `2xl`, sombras suaves, filete de marca e espaçamento generoso.
- Tipografia declarada: Sora para display e Manrope para texto, com fallbacks de sistema. O protótipo não fornece arquivos locais nem carregamento oficial dessas fontes; não declarar fidelidade tipográfica até a base definir a fonte efetiva.
- Composição responsiva observada: sidebar em desktop conforme código; no viewport estreito, topbar compacta e conteúdo em uma/duas colunas conforme largura.

## Matriz técnica proposta em P1.1

| Item | Versão/referência exata | Suporte/licença/acesso | Evidência |
|---|---|---|---|
| Node.js | 22.23.3 | Linha 22 LTS; licença do projeto Node.js. O executor local atual está em 26.8.1 e não é evidência do runtime alvo. | Arquivo oficial de releases Node.js consultado em 2026-10-12; `package.json` ainda declara `22.x` |
| Next.js | 16.4.0 | Active LTS 16.x; MIT | Política e instalação oficiais do Next.js; pacote local |
| React / React DOM | 19.2.8 | Patch estável da linha 19.2; MIT | Registro npm e pacotes locais |
| Tailwind CSS | 4.3.3 | Integração PostCSS recomendada para Next; MIT | Guia oficial Tailwind e pacote local |
| Vitest | 5.0.3 | Testes locais; MIT | Pacote local; gate pertence a P1.4 |
| `@prodexy/ui` | commit candidato histórico `c33921aa30ba4267354d22cd72b855e6a898d9c3`, ainda não homologado | Pacote ausente, licença e acesso não comprovados neste repositório | Bloqueia P1.3, não P1.1 |

Fontes oficiais consultadas: `https://nodejs.org/en/about/previous-releases`, `https://nodejs.org/en/download/archive/v22`, `https://nextjs.org/support-policy`, `https://nextjs.org/docs/app/getting-started/installation`, `https://react.dev/blog/2025/10/01/react-19-2` e `https://tailwindcss.com/docs/installation/framework-guides/nextjs`.

### Package manager e lock

`npm` é o gerenciador operacional proposto para o projeto e `package-lock.json` é o lock autoritativo proposto: ambos já estão presentes no histórico, npm está disponível no ambiente e Bun não está instalado. `bun.lock` permanece preservado até decisão explícita de remoção; não será atualizado em paralelo. Esta escolha técnica aguarda validação do responsável no gate D11 e não deve ser tratada como aceite implícito.

## Estado real

TanStack Start/Router + Vite, React 19, Tailwind 4, TypeScript strict, Node 22 declarado. package-lock.json e bun.lock coexistem; package manager único requer D11. Scripts atuais: dev, build, build:dev, preview, lint, format; typecheck/test/check ainda não estabelecidos. @prodexy/ui não está declarado no PH. Há src/server.ts e src/start.ts de framework; isso não comprova backend de negócio.

Store React em memória, mocks e data fixa; sessão simulada em sessionStorage e verificação client-side de conta. AppShell redireciona todo não administrador para meu-desempenho, mas os datasets completos estão no cliente. Esses mecanismos não são autorização segura. Venda/estoque calculados no browser, sem transação; truncamento de saldo negativo mascara inconsistência. Remover na construção, não converter mocks em seed.

| Rota observada | Intenção de UI | Destino planejado |
|---|---|---|
| /login | Login e identidade visual | Cognito + sessão server-side UC01 |
| / | Indicadores e filtro de loja | Consultas reais autorizadas; métricas D08 |
| /estoque | Catálogo, entrada e etiquetas | UC03–05 |
| /vendas | Registro/lista de vendas | UC06–07 |
| /colaboradores | Perfis, lojas e metas | UC02, sem gestão de senha local |
| /meu-desempenho | Meta e vendas pessoais | UC08; reduzir payload conforme D03 |
| /clientes | Cadastro, busca, indicadores e histórico derivado das vendas vinculadas | UC09 implementado localmente sobre a migration P5.2; homologação real pendente |
| /financeiro | Receita, despesas, resultado gerencial e comparativos por período/loja | UC10 implementado localmente sobre a migration P5.2, sem formas de pagamento por D05; homologação real pendente |

Preservar logos public/ph_outlet.png e public/ph_kids.png se confirmados como assets do cliente, branding por loja, composição e fluxos existentes; não transportar navegação Sonhando. Confrontar screenshots e runtime antes de refatorar. Tela existente não confirma escopo nem comportamento fiscal.

## Substituições planejadas

- Rotas TanStack → Next App Router com inventário de paridade; atualizar src/routes/README.md, cuja orientação atual proíbe Next por descrever o protótipo.
- Store/mocks → services/repositories server-only e estado de formulário local.
- Sessão simulada → Cognito + vínculo local + autorização por ação/loja/identidade.
- Primitivas locais → @prodexy/ui somente após auditar exports e compatibilidade; remover duplicatas sem consumidores após paridade, não antes.
- Datas/totais client-side → contratos reais e agregações server-side.

## UI transversal

Referência observada no Sonhando: @prodexy/ui pinado no commit c33921aa30ba4267354d22cd72b855e6a898d9c3. Não é versão homologada automaticamente para PH. Checkout da biblioteca não localizado entre diretórios de primeiro nível; acesso e auditoria pendentes D11. Não importar fonte de repositório irmão. Login visual pode ser composição reutilizável; regras Cognito, sessão e permissões não pertencem à biblioteca visual. Alterações na biblioteca exigem plano próprio, autorização e testes dos consumidores; não bloquear PH por extração genérica prematura.

## Aceite visual futuro

### Transição P1.2 — 2026-10-13

Next preserva as composições do HEAD b2bee82 (inclusive frente de caixa, etiquetas e equipe mais recentes que os prints históricos). Shell, seletor com as três opções, ícones, cores, fontes e assets foram mantidos. Em P6.1, o contexto transitório foi substituído por `src/features/workspace/contexto.tsx`, que contém somente o escopo e as lojas obtidas do backend, sem identidade ou dados comerciais. Campos históricos de pagamento, senha ou meta mensal não autorizam implementação contrária a D03/D04/D05; tamanho passou a ser exigido pela revisão D01 de 2026-10-24. Clientes/CRM, despesas e financeiro integram a V1; o contrato foi confirmado em 2026-10-26, a migration foi aplicada manualmente e as telas agora usam APIs server-side reais. Homologação mutável real permanece pendente.

Rotas Next não importam store, fixtures, autenticação simulada, TanStack ou Vite. P6.1 removeu o legado executável e as dependências sem consumidores; os seis caminhos que o workspace não permitiu excluir são módulos-túmulo vazios, fora do grafo Next. Painel, estoque, seletor e alertas usam dados das APIs reais. Boundaries de loading/error/not-found e apresentação de acesso negado existem, sem alegação de segurança por UI. Em P6.2, login e recuperação foram revistos em desktop/mobile e por teclado; textos temporários, orientação incorreta e link circular foram removidos, e o erro global deixou de depender do contexto de lojas. O responsável aceitou P6.2 com exceção explícita para as verificações autenticada e física restantes. P6.3 consolidou testes de revogação, sessão inválida, isolamento por pessoa/loja, adulteração, reenvio e indisponibilidade do banco; a política permanece server-side. P6.4 conciliou cinco migrations imutáveis ao schema final de 15 tabelas e 16 índices usando hashes locais e os pós-checks já fornecidos, sem nova consulta remota. Progresso/checks e limitações somente no ExecPlan.

Matriz completa de rotas × perfis × dispositivos reais ainda depende de D10. Verificar carregamento, vazio, erro, sem permissão, formulários, leitor, teclado, impressão e recuperação após desconexão. Registrar diferenças intencionais. A captura P1.1 documenta a referência local em viewport estreito; não substitui homologação visual do responsável nem prova comportamento funcional.
