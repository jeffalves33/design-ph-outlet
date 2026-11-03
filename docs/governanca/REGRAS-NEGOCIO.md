# Regras de negócio — PH Outlet

Status: plano aprovado para início; contratos técnicos aceitos, salvo decisões explicitamente abertas no registro D01–D11. Não confundir UI mock com comportamento homologado.

## Confirmadas

- RN01: sistema dedicado a duas lojas do mesmo dono, **PH Outlet** e **PH Kids**; não é SaaS multiempresa. Os nomes foram confirmados para o cadastro inicial em 2026-10-24.
- RN02: administrador controla operação e configura metas de vendedores. Cada vendedor possui login próprio e consulta apenas metas/atingimento próprios. Ampliar acesso exige D03.
- RN03: produtos possuem estoque; entrada aumenta disponibilidade; venda efetivada debita automaticamente.
- RN04: cada combinação de loja, nome e tamanho é uma categoria comercial com código incremental de cinco dígitos, preço e saldo próprios. Códigos e preços de lojas diferentes são independentes. A busca por nome reúne os tamanhos daquele tipo de roupa e mostra o saldo de cada um; zero é identificado, e os menores saldos podem ser ordenados sem classificar “baixo” por um limite ainda não definido. Cor não foi solicitada. O histórico de venda mantém o preço registrado mesmo após edição.
- RN05: imprimir comprovante não fiscal em impressora térmica; emissão fiscal não integra V1. Preset provisório: papel 80 mm pelo diálogo do navegador. Modelo/papel efetivos serão homologados no fechamento, sem presumir impressão silenciosa.
- RN19: V1 não registra cartão/dinheiro, troco, parcelamento, taxas ou detalhamento de pagamento. Valor comercial da venda permanece; não inferir liquidação financeira nem regras de devolução/metas desta simplificação.
- RN20: catálogo, códigos, preços e estoques são separados por loja. Contexto de uma loja restringe seus dados; contexto ambas mostra as duas lojas identificadas separadamente, dentro das permissões do usuário. Não fundir categorias, códigos ou saldos de lojas diferentes.

## Contratos técnicos do plano aprovado

- RN06: toda operação é autorizada no servidor por usuário ativo, permissão e escopo de loja. Ocultar menu não autoriza nem protege API. ID de vendedor enviado pelo cliente nunca determina o dono da consulta pessoal.
- RN07: identidade Cognito vinculada por issuer/sub único ao perfil local; não armazenar senha humana no banco. Credencial PostgreSQL é da aplicação, não de cada humano. Usuário Cognito de outro projeto não obtém acesso sem vínculo local ativo.
- Cadastro inicial confirmado: um único perfil `administrador` para `prodexy.labs@gmail.com`, vinculado às duas lojas. Após a migration P6.5, `usuarios.email` registra o contato único para a gestão de funcionários; autorização continua usando somente `issuer`/`sub` Cognito e vínculo local ativo. Novos usuários criados pela interface são sempre vendedores, recebem convite temporário diretamente do Cognito e nunca têm senha humana armazenada no banco PH.
- RN08: movimentações de estoque são rastreáveis por loja, categoria, quantidade, tipo, autor, motivo e origem. Entrada soma quantidade inteira positiva; ajuste usa variação inteira positiva ou negativa, sempre com motivo, sem transferência entre lojas. Saldo não pode ficar negativo nem ser corrigido silenciosamente com Math.max(0,...). Operação, saldo e movimento são transacionais e reenvio com a mesma chave/payload não duplica peças; chave igual com payload diferente conflita. Ajuste exige autorização por loja concreta. Após resposta incerta, consultar por loja+chave sem escrever; operação encontrada com movimento confirma o saldo, ausência momentânea não comprova falha definitiva e eventual reenvio conserva chave e payload. A UI conserva a operação pendente no navegador, vinculada ao ID do usuário local, para recuperá-la após recarga; não guarda token Auth nesse registro. Trocar de navegador ou limpar os dados locais pode exigir conferência administrativa pela chave, sem presumir nova operação.
- RN09: confirmação de venda persiste cabeçalho, itens e movimentos numa transação, sem subsistema de pagamentos na V1. Recalcular valores e validar estoque/preço/permissão no servidor; conflito desfaz tudo. Estoque insuficiente rejeita, não vende negativamente por default. O responsável atribuído à venda deve ser usuário ativo e vinculado à loja; pode ter perfil administrador ou vendedor, sem conversão de perfil. Somente administrador confirma a venda na V1.
- RN10: itens repetidos são agregados antes da baixa; cada Enter/clique no leitor durante a preparação é uma leitura intencional e soma quantidade, sem ser confundido com reenvio da confirmação. Concorrência usa bloqueio/atualização condicional com ordem consistente e testes. A idempotência começa somente na confirmação da venda, por operação com chave única, escopo e fingerprint do payload; mesma chave/payload retorna resultado, mesma chave/payload diferente conflita. Timeout pede reconciliação antes de reenviar.
- RN11: valores monetários exatos (centavos inteiros ou numeric), sem float para invariantes; definir arredondamento e distribuição de desconto antes de implementar. Quantidades de peças inteiras positivas; histórico guarda snapshots de descrição/código/preço/custo necessários.
- RN12: reimprimir etiqueta/comprovante não altera estoque, venda ou meta. Falha da impressora após commit não desfaz venda. Interface distingue confirmado, erro e resultado desconhecido; não afirmar impressão física pelo retorno do diálogo. Referência provisória: leitor USB em modo teclado, etiqueta 50×30 mm/203 dpi com Code 128 B e comprovante 80 mm; homologação física continua no fechamento.
- RN13 (CONFIRMADO): cancelamentos, trocas e devoluções estão fora da V1. Não implementar endpoints, botões, tabelas ou estornos para esses fluxos. Ajuste de estoque não deve funcionar como cancelamento oculto de venda.
- RN14 (CONFIRMADO): administrador cria e modifica múltiplas metas por vendedor e loja, com nome, alvo em centavos e datas civis inicial/final inclusivas em `America/Sao_Paulo`; não há frequência mensal fixa. O atingimento soma no servidor somente vendas atribuídas ao vendedor naquela loja cujas datas locais estejam no intervalo. Metas sobrepostas são calculadas independentemente. Cada criação/edição acrescenta snapshot versionado ao histórico, sem apagar versão anterior. Vendedor consulta apenas as próprias metas; sem meta não é divisão por zero.
- RN15: filtros por loja/período são server-side. Consolidação soma apenas lojas autorizadas; paginação não limita totais agregados. Vendedor não recebe datasets completos para filtrar localmente.
- RN16: datas reais, estados vazio/erro/carregamento e feedback de salvamento explícitos. Mocks, datas fixas, autenticação simulada e seeds comerciais não alcançam produção.
- RN17: database por projeto, não por loja; cada categoria pertence a uma loja e seu saldo é dessa loja. Transferências não foram aprovadas. Mutações exigem loja concreta mesmo na visão ambas; nunca repartir baixa implicitamente.
- RN21 (proposta técnica): gerar número da categoria por loja de forma transacionalmente segura, com unicidade em (loja, código) e faixa 1–99999, exibindo zeros à esquerda. Não usar MAX+1 nem prometer ausência de lacunas. Não reciclar código arquivado; ao esgotar a faixa de uma loja, bloquear novo cadastro nessa loja e pedir decisão, sem truncar/voltar a 00001.
- RN18: DIURNO é perfil declarado de uso, não agenda de desligamento. Não criar jobs para parar EC2, reconectar sem limite ou criar fila offline. Indisponibilidade do node deve falhar com mensagem segura e sem venda falsa.
- RN22 (CONFIRMADO): cliente tem nome, WhatsApp normalizado, nascimento opcional, cidade, loja preferida e observação; o WhatsApp identifica um único cadastro. A venda pode ser confirmada sem cliente ou já nascer vinculada a um cliente, e esse vínculo não é reescrito depois. Despesa pertence a uma loja concreta, tem data civil, descrição, categoria aprovada e valor positivo em centavos; não é apagada ou alterada silenciosamente. Receita é a soma das vendas do período, resultado gerencial é receita menos despesas e margem é resultado dividido pela receita (zero quando não houver receita). Esses indicadores não comprovam recebimento, caixa, lucro contábil ou fiscal.

## Matriz de acesso inicial

| Capacidade | Administrador | Vendedor |
|---|---|---|
| Login/logout e própria sessão | Sim | Sim |
| Configurar metas/perfis | Sim | Não |
| Consultar atingimento | Equipe autorizada | Somente próprio |
| Estoque, vendas e impressão | Sim, contrato a detalhar | Não |
| Clientes/financeiro | Sim; contrato P5.2 e loja/período verificados no servidor | Não |
| Administrar banco/infraestrutura | Não pelo runtime | Não |

Gerente e estoquista são apenas cargos vistos no protótipo; não recebem permissões implícitas. Não construir hierarquia genérica, editor arbitrário de ACL ou delegação de administradores sem caso de uso confirmado.
