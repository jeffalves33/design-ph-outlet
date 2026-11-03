# Handoff Cognito — PH Outlet — gate Auth de P2.5

Status: **App Client criado e configuração conferida em 2026-10-16** por saída CloudShell fornecida pelo responsável. **Handoff validado pelo responsável em 2026-10-16; retomada autorizada somente para o restante de P2.5.** Esta evidência de infraestrutura não equivale a teste de login de aplicação. P2.6 não autorizado.

## Recurso existente

| Campo | Valor |
|---|---|
| Região | `us-east-1` |
| User Pool compartilhado | `prodexy-prod-dedicated-users` — `us-east-1_Jm4EQEGdZ` |
| Issuer esperado | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Jm4EQEGdZ` |
| App Client exclusivo do PH | `prodexy-prod-ph-outlet-web` — `4ia9j9rb19t0qqncadeugjqu9e` |
| Fluxos habilitados | `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH` |
| Outros controles observados | `PreventUserExistenceErrors=ENABLED`, token revocation=true, refresh token=7 dias, OAuth=false |
| Client secret | **Não gerado** (`--no-generate-secret`); não existe valor a pedir ou armazenar |
| Pool MFA | `OPTIONAL` no pré-check, com TOTP habilitado conforme registry da plataforma; desafios reais não testados |

Atualização posterior informada pelo responsável em 2026-10-16: o Platform Agent alterou e confirmou a validade de refresh do App Client PH para **3.650 dias**, com registro no registry e ledger. A linha de 7 dias acima preserva a evidência do handoff original, não o estado atual. Esta atualização não foi consultada remotamente pelo construtor. O ajuste local inicial de cookie por 30 dias não foi aceito; revisão entregue para aceite: janela móvel de até 400 dias por emissão no Chrome, limitada pelo vencimento absoluto da credencial. Homologação real ainda pendente.

O formulário atual de e-mail/senha pode chamar o backend Next.js, que conduz a autenticação via API Cognito. Não há Hosted UI, domínio, callbacks ou redirects criados neste gate. O executor deve tratar `NEW_PASSWORD_REQUIRED` e desafios MFA que o Cognito efetivamente retornar, além de login, recuperação, sessão e saída previstos em P2.5. Não habilitar cadastro público nem inserir login simulado.

Pool ID, issuer e Client ID são **configuração não secreta**. Convenção de nomes sugerida para o runtime server-side do PH: `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` e `COGNITO_ISSUER`; o executor ajusta nomes somente dentro do contrato local, sem `NEXT_PUBLIC_*` para credenciais. Essas variáveis **não foram configuradas na Vercel**. A senha do database PH é outra credencial e permanece sob o procedimento de [HANDOFF-BANCO](HANDOFF-BANCO.md); não foi lida ou alterada aqui.

## Gate obrigatório do executor

- Validar assinatura, issuer, tipo, expiração e `aud`/`client_id` do token conforme o tipo recebido; não confiar em claims sem verificação.
- Após autenticar a pessoa, usar `issuer/sub` para consultar o perfil local ativo e os vínculos/lojas autorizados. O App Client **não isola** automaticamente os usuários dos projetos que compartilham o pool.
- Manter tokens fora de logs e impedir acesso ao PH para identidade sem vínculo PH, inativa ou de outro projeto. Cookie/sessão, proteção de origem e fluxos de desafio pertencem à implementação/testes P2.5.
- Não criar usuário, App Client adicional, domínio, secret, recurso de banco, deploy ou configuração Vercel por inferência deste handoff.

## Evidência e limite

CloudShell do responsável criou o cliente após confirmar nome/tier do pool, MFA OPTIONAL e ausência de cliente homônimo. `describe-user-pool-client` confirmou nome, IDs, fluxos e controles acima. Fontes canônicas: `D:\Prodexy\docs\platform\aws\RESOURCE_REGISTRY.md` (recurso) e `D:\Prodexy\docs\platform\aws\BUILD_LEDGER.md` (execução). Nenhum usuário foi criado nesta operação; a contagem atual de usuários não foi reconsultada. Não houve teste de login, recuperação, email, MFA, Vercel ou aplicação PH.

Gate cumprido: o responsável validou este handoff e autorizou **somente a retomada de P2.5** pelo executor em 2026-10-16. Ao entregar P2.5, o executor atualiza os checks, apresenta evidências e para; P2.6 exige novo aceite.
