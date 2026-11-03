# PH Outlet — questionário de entrada

Status: CONTEXTO CONSOLIDADO em 2026-10-12 / decisões específicas pendentes. Início autorizado pelo plano aprovado; operações remotas continuam gates separados.

## Respostas consolidadas do responsável — fonte prioritária

### Atualização prioritária posterior

Revisão de 2026-10-24: a regra vigente é categoria por loja+nome+tamanho, com código, preço e saldo próprios por combinação. Busca por nome reúne tamanhos e respectivos saldos. A resposta anterior “sem controle de tamanho” abaixo é histórica e foi substituída; D01 em `DECISOES-PENDENTES.md` é a fonte atual.

Respostas anteriores do responsável (histórico): categoria com preço único, sem controle de tamanho/cor, apenas quantidade por loja; administrador cria/edita múltiplas metas por funcionário e define seus prazos (sem frequência fixa); sem cancelamentos, trocas ou devoluções na V1. Confirmados em 2026-10-12: alvo em reais, início/fim explícitos, soma das vendas atribuídas no intervalo e cálculo independente das metas sobrepostas. O registro DECISOES-PENDENTES.md é a fonte atual; tabelas antigas abaixo são histórico, não perguntas a repetir.

- Código incremental por categoria, apresentação de cinco dígitos começando em 00001; etiquetas repetem o código. A proposta anterior de SKU por variante foi rejeitada/substituída. Item/preço dentro da categoria ainda precisa de definição se houver variedade.
- Comprovante não fiscal, impressora térmica padrão; largura/modelo ficam para homologação física.
- V1 sem forma de pagamento, troco, parcelamento, taxas ou detalhamento de pagamentos. Isso não resolve automaticamente política de devoluções ou fórmula de metas.
- Estoque separado por loja; contexto de uma loja filtra seus dados, ambas mostra as duas sem fundir estoques. Transferência não foi solicitada.
- Novo fluxo solicitado: construtor para integralmente ao chegar à construção efetiva do schema; responsável aciona Platform Agent para provisionar database/acesso; retorno por handoff explícito. Construtor prepara migrations posteriores e notifica responsável para aplicação manual. Redação para aceite em [HANDOFF-BANCO](HANDOFF-BANCO.md).

Esta atualização supera as pendências já respondidas na tabela histórica abaixo; não exige responder o questionário novamente.

Esta seção preenche o questionário a partir do relato recebido; campos sem informação não são presumidos. As perguntas originais abaixo são formulário histórico, não solicitação de repetir respostas.

| Perguntas | Resposta / estado |
|---|---|
| 1–3 | Sistema dedicado de gestão de roupas para duas lojas, normal e infantil, do mesmo dono. Objetivo: controle do negócio, vendas, estoque e metas. Sucesso funcional proposto: entrada → etiquetas → venda → baixa → atingimento verificável. Critérios finais de homologação ainda dependem de aceite. |
| 4–6 | Confirmados produtos/estoque, entradas, vendas com baixa automática, etiquetas/código de barras, impressão térmica, administração de vendedores e metas, consulta individual do atingimento. Clientes, despesas e dashboards aparecem no protótipo; extensão financeira ainda não confirmada. |
| 7 | Exemplo informado: receber 20 camisas polo, gerar 20 etiquetas com o mesmo código e debitar o item na venda por leitura. Falta decidir se código identifica categoria, modelo ou variante e como diferenciar tamanho/cor/preço. Não assumir serial individual por peça. |
| 8 | Propostas técnicas: venda/baixa atômicas, idempotência, auditoria e proteção de estoque concorrente. Cancelamento, troca, devolução, desconto e pagamento ainda exigem regras do negócio. |
| 9 | Dono administrador; vendedores com login próprio e acesso somente às próprias metas/atingimento. Administrador configura metas. Não há autorização para vendedor operar PDV. Gerente/estoquista aparecem no protótipo, mas não foram confirmados como perfis funcionais. |
| 10–12 | Produtos, lojas, vendedores, metas, vendas e estoques confirmados conceitualmente. Não houve confirmação de dados reais a importar nem de modelo financeiro/relatórios completos. Dados mock não são dados reais e não devem ser migrados. |
| 13–14 | Leitor de código de barras, etiquetas em lote e impressora térmica são necessidades. Modelos, largura de papel, sistema operacional, conexão, conteúdo e natureza fiscal da nota pendentes. Outros provedores e upload de arquivos não informados. |
| 15–16 | Frontend existente serve de design inicial, mesmo fora da stack. Construção de backend, schema e migrations será pelo agente local. Adotar padrões Prodexy/UI e preservar identidade/intenção visual; telas não são regras de negócio aprovadas. Dispositivos, PWA e offline não definidos. |
| 17 | Uso predominantemente comercial, perfil DIURNO. Quantidade de usuários simultâneos, lojas/caixas concorrentes e volume não informados. |
| 18–19 | Agente pai planeja; agente do projeto constrói. Usuário executará migrations no PostgreSQL AWS. Secrets permanecem privados; provisioning/deploy/testes remotos precisam de autorização específica. Ambientes e política de commits/push pendentes. |
| 20–22 | Sem prazo ou teto específico informado. Operação da plataforma permanece com responsável Prodexy. Desligamento noturno é possibilidade futura do node inteiro, não tarefa nem economia prometida deste projeto. |

Pendências com alternativas e gates: [decisões do projeto](DECISOES-PENDENTES.md). Plano executivo: [construção](../prodexy/plans/2026-10-12-construcao.md).

## Como responder

Preencha abaixo ou envie respostas numeradas. Use NÃO SEI ou NÃO SE APLICA quando necessário. Pode anexar referências públicas ou exemplos anonimizados; nunca envie senhas, tokens, URLs com credenciais ou dados pessoais reais.

## Contexto já definido

Projeto será construído do zero conforme orientação do responsável; há um repositório existente cuja reutilização ainda precisa ser definida. Frontend e backend Next.js permanecem na Vercel; banco PostgreSQL AWS por conexão nativa TLS, driver pg e pool dimensionado no onboarding; Auth conforme padrão Cognito. Não há autorização para criar recursos de projeto nesta coleta. Platform Agent planeja; outro agente executará localmente após aprovação.

Estado observado em 2026-10-12: branch main, working tree limpa; AGENTS.md ausente; README contém somente o título design-ph-outlet. Código ainda não auditado funcionalmente. Não concluir que o repositório está vazio ou pronto.

## 1. Produto e escopo

1. O que é PH Outlet, quem opera o negócio e qual problema o sistema resolverá?
   Resposta:
2. Quem utilizará o produto? Confirma projeto dedicado a um negócio? Há lojas, filiais ou empresas distintas?
   Resposta:
3. Quais resultados concretos definem sucesso da V1? O que fica explicitamente fora dela?
   Resposta:
4. Quais módulos são indispensáveis e qual sua ordem de prioridade?
   Resposta:

## 2. Jornadas e regras

5. Descreva as principais jornadas, do início ao fim, como funcionam hoje e como devem funcionar no sistema.
   Resposta:
6. Para cada módulo, informe atores, campos obrigatórios, estados, ações, cálculos, exceções e critérios de aceite. Quais regras já estão documentadas?
   Resposta:
7. Caso existam catálogo, estoque e vendas: há variantes/SKU, reservas, múltiplos estoques, descontos, parcelamento, trocas, devoluções ou cancelamentos? Descreva apenas o aplicável.
   Resposta:
8. Quais ações exigem aprovação, histórico imutável, auditoria ou proteção contra execução duplicada/concorrente?
   Resposta:

## 3. Usuários e dados

9. Quais perfis existem e o que cada um pode consultar, criar, alterar, excluir e exportar? Quem provisiona usuários? Há área pública ou clientes com login?
   Resposta:
10. Quais entidades e informações precisam ser armazenadas? Há dados pessoais/sensíveis, retenção, exclusão ou exigências legais específicas?
   Resposta:
11. Existem dados reais a importar? De qual origem, formato e volume? O que deve ser preservado? Não envie os dados agora.
   Resposta:
12. Quais relatórios, indicadores, documentos e exportações são necessários? Defina cálculos e períodos.
   Resposta:

## 4. Integrações e experiência

13. Haverá pagamentos, fiscal, WhatsApp, email, frete, ERP, ecommerce, webhooks ou jobs? Para cada um: fornecedor, finalidade, situação e obrigatoriedade na V1, sem credenciais.
   Resposta:
14. Que arquivos serão enviados/gerados? Tipos, tamanhos, acesso público/privado e necessidade de exclusão/substituição.
   Resposta:
15. O código existente é referência visual, protótipo descartável ou possui partes a preservar? Quais telas, assets e comportamentos estão aprovados? Nada será apagado sem escopo definido.
   Resposta:
16. Há identidade visual, exemplos e materiais? Quais dispositivos/navegadores, requisitos de acessibilidade, idiomas, PWA ou funcionamento offline são necessários?
   Resposta:

## 5. Capacidade, execução e aceite

17. Estime usuários simultâneos, registros iniciais/crescimento, picos e operações mais frequentes. Há metas de desempenho?
   Resposta:
18. Quais ambientes de desenvolvimento/testes/homologação serão usados? Quem poderá acessá-los? Confirma fixtures sintéticas isoladas, nunca testes destrutivos em produção?
   Resposta:
19. Quem autoriza e executa migrations, criação de recursos, preenchimento de secrets e deploy? O executor pode fazer commits/push? Quais ações exigem parada e aceite?
   Resposta:
20. Há prazo, ordem de entregas, limite de escopo/custo ou dependência externa? Quem homologa cada módulo e o produto final?
   Resposta:
21. Quem será responsável por operação/suporte e quais instruções ou treinamentos devem acompanhar a entrega?
   Resposta:
22. Quais informações adicionais, documentos ou decisões o plano deve considerar?
   Resposta:

## Próxima etapa

Consolidar respostas, auditar o repositório sem ler secrets, esclarecer somente lacunas bloqueantes e preparar contratos e ExecPlan autocontidos dentro deste projeto. Nenhum nome de database, role, secret ou App Client está definido por este questionário.
