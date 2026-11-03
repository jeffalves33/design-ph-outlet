# Casos de uso e aceite — PH Outlet

Status: especificação do plano aprovado; testes abaixo são exigências futuras, não resultados. Permissões RN06/RN07 aplicam-se a todos. Fluxos mutáveis sempre incluem validação, autorização, transação quando necessária, resposta segura e evidência.

| ID | Ator / fluxo principal | Alternativas e critério verificável | Regras / fase |
|---|---|---|---|
| UC01 Acesso | Admin/vendedor autentica via Cognito, perfil ativo resolve sessão, logout encerra acesso | Negar anônimo, token expirado, issuer/client incorretos, usuário de outro projeto e inativo; recuperação a homologar sem cadastro público | RN02/06/07; P2 |
| UC02 Administração | Admin mantém vínculo, lojas e atribui metas | Impedir autoelevação por payload e acesso de vendedor; provisionamento Cognito separado do cadastro local, sem senha na UI administrativa | RN02/06/14; P2/P5 |
| UC03 Catálogo | Admin cadastra categoria por nome e tamanho em loja concreta; cada combinação tem código, preço e saldo próprios | Busca por nome mostra todos os tamanhos e respectivos saldos; duplicata ativa nome+tamanho na mesma loja é rejeitada, categoria referenciada é arquivada sem apagar histórico | RN04/11/17/20/21; P3 |
| UC04 Entrada/ajuste | Admin registra quantidade recebida por item/loja e motivo | Reenvio não duplica saldo; ajuste inválido rejeita; após resposta incerta consulta operação por loja+chave antes de reenviar os mesmos dados; transferência não autorizada | RN03/08/10; P3 |
| UC05 Etiquetas | Admin seleciona categoria/lote e quantidade, visualiza e imprime | Entrada de 20 permite 20 etiquetas com o código da combinação nome+tamanho; leitura retorna tamanho/preço próprios; reimpressão não duplica recebimento; homologação física obrigatória | RN04/12/21; P4 |
| UC06 Venda | Admin escolhe loja e responsável ativo vinculado (administrador ou vendedor), lê códigos, revisa itens e confirma | Código desconhecido não gera item arbitrário; preço adulterado é ignorado/recalculado no servidor; última peça concorrente tem um vencedor; resposta incerta é consultada pela mesma chave e falha não deixa venda parcial | RN03/09/10/11; P4 |
| UC07 Comprovante | Após venda persistida, admin imprime/reimprime comprovante não fiscal | Reimpressão não debita estoque; documento reflete snapshots/total; sem meios de pagamento/troco/parcelas/taxas; homologar impressora térmica real | RN05/12/19; P4 |
| UC08 Metas | Admin cria/edita várias metas por funcionário e seus prazos; vendedor consulta próprias metas | Sem limite de uma meta ou frequência fixa; trocar userId não mostra colega; testar sobreposição e edição com alvo em reais, início/fim explícitos, soma de vendas atribuídas e cálculo independente por meta | RN02/14/15; P5 |
| UC09 Clientes | Admin cadastra/consulta clientes e escolhe opcionalmente um cliente antes de confirmar a venda | Nome e WhatsApp obrigatórios; nascimento, cidade, loja preferida e observação opcionais; histórico deriva das vendas vinculadas, vínculo não muda após confirmação e vendedor não recebe dados pessoais | RN06/15/22; P5 |
| UC10 Financeiro | Admin lança despesa e consulta resultado gerencial por período/loja | Categorias: fornecedores, aluguel, folha, marketing e operacional; receita vem de vendas, resultado = receita − despesas e margem trata período sem receita; não representa pagamento/recebimento/caixa ou resultado fiscal | RN11/15/22; P5 |
| UC11 Reversões — EXCLUÍDO | Cancelamentos, trocas e devoluções não integram V1 | Não criar fluxo ou ação oculta de estorno; ID preservado somente para rastreabilidade | RN13; fora do escopo |

## Jornadas obrigatórias de homologação

1. Admin: cadastrar item → receber 20 → imprimir 20 → ler etiqueta → vender quantidade → conferir saldo, total, vendedor e comprovante.
2. Vendedor: login próprio → meta/atingimento correto → tentativa direta de API de colega/estoque/admin negada → logout.
3. Duas sessões: disputar última unidade, reenviar confirmação e simular timeout; apenas um efeito persistido por operação.
4. Banco indisponível: mensagem segura, nenhuma confirmação fictícia; reconciliação após retorno.
5. Nova base descartável: replay de migrations e comparação ao schema canônico; integridade e privilégios testados.

Cada jornada registra commit, ambiente, comando, dados sintéticos isolados, resultado esperado/observado e limpeza. Cenário dispensado permanece dispensado com aceite do responsável, nunca marcado como teste aprovado. Impressão requer modelo/configuração e prova física pelo responsável.
