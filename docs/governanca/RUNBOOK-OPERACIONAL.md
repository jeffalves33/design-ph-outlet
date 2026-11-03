# Runbook de construção e operação — PH Outlet

Status: construção local concluída e validada até P6.4 em 2026-11-03, com cinco migrations até P5.2 aplicadas manualmente e conciliadas por evidência. P7 está adiado, não iniciado e sem autorização. Backup, teste de restauração, configuração final de produção, Vercel, Cognito, domínio, deploy e homologação pós-deploy não devem ser executados agora. As pendências abaixo permanecem documentadas somente para um release futuro solicitado expressamente; não são bloqueio nem trabalho atual. Nenhum comando aqui deve carregar ou imprimir arquivos privados.

## Banco

### Separação de execução — aprovada

O [gate de banco](../planejamento/HANDOFF-BANCO.md) especifica parada integral do construtor ao chegar à construção efetiva do schema, acionamento do Platform Agent e retomada somente após handoff/liberação. O Platform Agent conduz criação/configuração do database e acesso; construtor prepara schema/migrations; responsável aplica migrations de negócio. Este procedimento aprovado substitui a atribuição genérica anterior de onboarding diretamente ao executor/operador; não há banco criado por este documento.

Paths a criar pelo executor: database/schema.sql e database/migrations/YYYYMMDDHHMMSS_descricao.sql. Na mesma entrega de mudança de banco: atualizar schema, adicionar migration, ajustar contratos/código/testes. Migrations aplicadas são imutáveis. Não reaplicar schema completo em banco existente, não usar reset em produção. Schema não substitui histórico.

Cada migration informa pré-condições, lock/impacto, transação ou motivo para não ser transacional, verificação pós-aplicação e estratégia de correção/rollback. O responsável abre `/infraestrutura/sql` no Prodexy Sistema, seleciona PH Outlet, cola o conteúdo integral do arquivo versionado, executa e depois roda o pós-check fornecido pelo construtor. Retorna somente evidência não secreta. O SQL Editor substitui o fluxo rotineiro por SSM; SSM é fallback de infraestrutura orientado pelo Platform Agent. O controle de versões/checksums evita replay; nunca editar migration aplicada para alinhar checksum.

Em banco descartável autorizado: aplicar histórico desde vazio, comparar schema resultante com schema.sql (normalizando owners/metadados), executar contratos/integridade/permissões e registrar resultado. Em upgrade: testar sequência sobre versão anterior, com dados sintéticos isolados. Fixtures nunca em produção. Não aplicar schema.sql e depois o mesmo histórico no mesmo banco.

## Onboarding e secrets

Database, role runtime, HBA e limite de conexões P2.2 existem; identificadores e evidências de infraestrutura constam no [handoff](../planejamento/HANDOFF-BANCO.md) e no registry da plataforma. Pool de aplicação P2.4 foi implementado localmente, sem conexão real. App Client PH foi provisionado e consta no [handoff Auth](../planejamento/HANDOFF-AUTH.md); configuração Vercel e homologação real continuam pendentes. Antes de criar/usá-las informar nome exato, finalidade, destino e quem acessa. DATABASE_URL fica apenas no runtime server-side Vercel; nunca NEXT_PUBLIC_*. Responsável preenche sem enviar valor. Não ler .env nem solicitar chave privada. Metadados AWS reais vão ao registry da plataforma, depois ledger; projeto referencia a fonte, sem inventário paralelo de credenciais.

Variáveis Auth não secretas do runtime server-side: `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_ISSUER`, conforme [HANDOFF-AUTH](../planejamento/HANDOFF-AUTH.md). O responsável as configura privadamente na Vercel; não foram criadas neste bloco. O App Client PH não tem client secret. Access token fica apenas em cookie HttpOnly. A correção local de P2.5 mantém o refresh token cifrado/autenticado em cookie HttpOnly, SameSite strict e Secure em produção; renovação usa somente o servidor, reconfere token, GetUser e vínculo PH ativo, e não estende o vencimento original do refresh. Saída revoga no Cognito e limpa cookies; falha de revogação remota é indicada, não declarada como sucesso.

`PH_SESSION_ENCRYPTION_KEY` é segredo novo de aplicação: 32 bytes aleatórios codificados em base64, gerado e preenchido privadamente pelo responsável somente no runtime server-side Vercel, nunca em `NEXT_PUBLIC_*`, navegador, documentação ou logs. Sem chave válida, login/renovação falham fechados. A rotação dessa chave invalida as sessões já abertas; planejar a janela de rotação antes da publicação. Conforme confirmação do responsável, o Platform Agent alterou o App Client PH para 3.650 dias de validade do refresh token e registrou no registry e ledger. Para novas credenciais, o código guarda esse vencimento absoluto no cookie cifrado e emite o cookie por até 400 dias a cada vez no Chrome, limitado pelo tempo restante da credencial. A janela é renovada durante o uso (GET de sessão, navegação de renovação, checagem de 12 em 12 horas e retorno à aba), sem reiniciar o vencimento original. Ausência superior ao prazo efetivo permitido pelo navegador, limites adicionais ou token antigo emitido sob prazo anterior podem exigir novo login; não declarar sessão infinita ou garantida por 3.650 dias. Homologação real de login, expiração, renovação, MFA, recuperação e revogação permanece obrigatória antes de deploy, mas ambiente/conta de teste não estão autorizados agora. Preview/teste não recebem acesso ou credencial de produção por conveniência. Identidade de migration nunca é a credencial de runtime.

No banco: role mínima, grants somente necessários, restrições de PUBLIC e HBA para par explícito antes do reject; aplicação não executa DDL. Cognito compartilhado não autoriza automaticamente usuário de outro projeto. Testar vínculo ativo, isolamento de loja e vendedor. Não alterar SG global neste onboarding sem necessidade aprovada; D3 já é baseline.

## Quality gates locais e pendentes

`typecheck`, `lint`, `test:unit`, `build` e `check` já constam do `package.json`; não rodar build inadvertidamente neste ambiente, pois Next carrega `.env` presente. `test:integration:db` e `test:e2e` permanecem separados e dependem de alvo autorizado. `validate:schema` exige replay/paridade em banco descartável e não pode conectar implicitamente à produção.

Evidências: commit, ambiente lógico, comando sem segredo, retorno, cenários/contagens, limitações e limpeza. Teste não executado não é aprovado. Impressão exige homologação física, sem considerar window.print prova de papel impresso.

## Release e recuperação

### Conciliação P6.4 e pendências concretas

O histórico local contém exatamente cinco migrations aplicadas, sem arquivo pendente: `202610140001_inicial` (`7592e400…a8e09`), `202610240001_cadastro_inicial` (`74eeed07…5aacf`), `202610240002_tamanho_categoria` (`7d073565…e80a8`), `202610250001_metas` (`03739587…015f2`) e `202610260001_clientes_financeiro` (`bec90929…7a07e`). Os hashes integrais permanecem nas seções históricas acima e são verificados por teste. O estado acumulado corresponde ao `database/schema.sql`: 15 tabelas, 16 índices, evoluções de tamanho e cliente, e grants mínimos. Esta conclusão combina artefatos locais com os pós-checks apresentados pelo responsável; o executor não fez nova consulta ao database PH e não executou replay.

Quando o responsável solicitar futuramente o release, deverão ser retomadas as pendências abaixo, sem ocultá-las ou convertê-las em “feito”. Elas não são bloqueio nem trabalho atual:

1. homologação real completa de P2.5: MFA, recuperação, saída, renovação/revogação e vínculo às duas lojas;
2. instalação/build no runtime Node 22 alvo e configuração privada das variáveis server-side na Vercel;
3. homologação física do leitor, etiqueta térmica 50×30 mm e comprovante 80 mm;
4. homologação controlada dos fluxos mutáveis reais de estoque, venda, metas, clientes e despesas;
5. P7.1: confirmar backup recente, restauração lógica autorizada em destino temporário, TLS/limites/contatos e ambiente sem fixtures;
6. P7.2/P7.3: publicação explicitamente autorizada, verificações pós-deploy e aceite operacional.

P1.4 e P2.3 continuam sem aceite formal retroativo no checklist histórico, embora seus gates técnicos e evidências tenham sido reutilizados. Isso é pendência administrativa para release, não autorização para repetir migrations ou testes remotos.

### Padrão atual de migrations — SQL Editor

Para toda migration nova:

1. abrir o arquivo indicado em `database/migrations` e copiar seu conteúdo integral;
2. abrir `/infraestrutura/sql` no Prodexy Sistema;
3. selecionar `PH Outlet — prodexy_ph_outlet`;
4. colar e executar o SQL;
5. executar o pós-check fornecido na entrega;
6. devolver ao executor o resultado da migration e do pós-check, sem credenciais.

Não executar `database/schema.sql` sobre o banco existente e não reaplicar migration registrada. Os procedimentos SSM abaixo são históricos das migrations anteriores e não definem o fluxo atual.

### Procedimento histórico de transferência por PowerShell e SSM

Para toda migration nova, transferir os bytes do arquivo local por um único comando copiado pelo PowerShell e colado uma única vez em uma sessão SSM nova. O PowerShell compacta os bytes com GZip, codifica em Base64 e coloca na área de transferência o comando Linux que recria o arquivo. No SSM, conferir a integridade **somente pelo SHA-256 canônico informado para a migration**. Não usar contagem de bytes/caracteres, `heredoc`, colagem manual do SQL, corte por tamanho ou correção do arquivo no servidor.

Depois que o SHA-256 remoto coincidir com o canônico, executar a migration com `psql -X -P pager=off -v ON_ERROR_STOP=1`. A conferência do hash prova somente a transferência; a migration continua pendente até aparecer `COMMIT` e o pós-check confirmar versão, objetos e privilégios. Migrations já aplicadas não devem ser transferidas ou executadas novamente.

### Migração inicial PH Outlet — aplicada manualmente em 2026-10-15; não repetir

O responsável apresentou `COMMIT` e pós-check: versão/hash canônicos, 11 tabelas e grants mínimos. O procedimento abaixo é histórico e serve apenas para revisão; **não execute novamente na base PH já migrada**. Aceite formal de P2.3 continua pendente no ExecPlan.

Arquivo local que deve ser copiado: `D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610140001_inicial.sql`. `database/schema.sql` é apenas o estado canônico: **não o execute** depois da migração. SHA-256 esperado do arquivo da migração: `7592e40001a4795b5e96f4045fca976547868bbda224713bb556c5b3670a8e09`.

**Cópia manual pela sessão SSM, sem ferramenta de transferência:** no Windows, abra o arquivo local acima em um editor de texto, selecione todo o conteúdo (`Ctrl+A`) e copie (`Ctrl+C`). No shell Linux da sessão SSM do DB Node 01, execute estas duas linhas:

```sh
sudo install -d -m 0755 /var/tmp/ph-outlet
sudo tee /var/tmp/ph-outlet/202610140001_inicial.sql >/dev/null <<'PH_OUTLET_SQL'
```

O shell ficará aguardando texto. Cole **todo o conteúdo** copiado do arquivo SQL, sem modificar quebras de linha. Em uma nova linha após o último `COMMIT;`, digite somente `PH_OUTLET_SQL` e pressione Enter. O delimitador não faz parte do arquivo. A checagem SHA abaixo detecta qualquer alteração ou cópia incompleta. Não cole o texto do `schema.sql`.

Pré-condições: conexão SSM no DB Node correto, backup PH recente confirmado pelo responsável, database `prodexy_ph_outlet` ainda sem objetos de negócio, manutenção local por `postgres`. Não usar a role runtime para DDL. No mesmo shell SSM:

```sh
ARQUIVO_SQL=/var/tmp/ph-outlet/202610140001_inicial.sql
sudo -u postgres test -r "$ARQUIVO_SQL" || { echo 'migração ausente ou ilegível'; exit 1; }
HASH_REAL=$(sha256sum "$ARQUIVO_SQL" | cut -d ' ' -f1)
HASH_ESPERADO=7592e40001a4795b5e96f4045fca976547868bbda224713bb556c5b3670a8e09
test "$HASH_REAL" = "$HASH_ESPERADO" || { echo 'checksum divergente; pare'; exit 1; }
sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT current_database() AS banco, current_user AS usuario, to_regclass('public.migracoes_schema') AS controle_existente, (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS tabelas_publicas;"
```

Só prossiga se aparecer banco `prodexy_ph_outlet`, usuário `postgres`, `controle_existente` vazio e `tabelas_publicas = 0`. Então execute uma única vez:

```sh
sudo -u postgres psql -X -v ON_ERROR_STOP=1 -v hash_migracao="$HASH_REAL" -d prodexy_ph_outlet -f "$ARQUIVO_SQL"
sudo -u postgres psql -X -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT versao, hash_sha256, aplicada_em FROM public.migracoes_schema; SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename; SELECT has_table_privilege('prodexy_ph_outlet_app', 'public.vendas', 'SELECT') AS vendas_consulta, has_table_privilege('prodexy_ph_outlet_app', 'public.vendas', 'INSERT') AS vendas_inclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.vendas', 'UPDATE') AS vendas_alteracao, has_table_privilege('prodexy_ph_outlet_app', 'public.migracoes_schema', 'SELECT') AS controle_consulta;"
```

Esperado: um registro `202610140001_inicial` com SHA igual ao arquivo, 11 tabelas, `vendas_consulta` e `vendas_inclusao` verdadeiros, `vendas_alteracao` e `controle_consulta` falsos. A operação é transacional com `ON_ERROR_STOP`; erro antes do COMMIT deve abortar/rollback ao encerrar o psql. Risco: DDL obtém locks; a base deve estar sem tráfego. Backup foi gerado, mas restore PH não foi homologado. Se houver erro ou pós-check divergente, não reaplique nem apague objetos: preserve a saída sem segredo, bloqueie o próximo bloco e solicite diagnóstico/correção ao executor e ao Platform Agent. Nenhum teste destrutivo ou replay em produção.

### Cadastro inicial — aplicada manualmente conforme responsável; NÃO repetir

**Situação em linguagem simples:** o responsável informou que o SQL cadastrou duas lojas e **um** perfil administrador no banco PH, vinculado às duas lojas; o pós-check confirmou hash, contadores e vínculos. O SQL **não cria o login nem a senha** da pessoa. O responsável agora dispõe de senha temporária Cognito, mas o primeiro login/troca de senha ainda não foi homologado pelo executor. **Não copie ou execute novamente esta migration.**

Sequência de referência e estado atual:

1. **Identidade Cognito:** senha temporária informada pelo responsável; evidência não secreta do handoff `issuer`/`sub` ainda não foi registrada neste projeto. Não solicitar senha ou `sub` pelo chat.
2. **Cadastro local:** migration aplicada manualmente pelo responsável em 2026-10-24, com pós-check informado; não repetir.
3. **Primeiro acesso:** o responsável relatou sucesso ao entrar em `/login` e trocar a senha temporária. Eventual MFA e acesso às duas lojas não foram descritos individualmente; homologação real completa e deploy continuam pendentes.

Arquivo aplicado, mantido para auditoria: `D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610240001_cadastro_inicial.sql`. `database/schema.sql` é apenas o contrato estrutural; **não execute nenhum dos dois arquivos novamente**. SHA-256 do arquivo de cadastro: `74eeed07c10468df04213011e6fecb5af97f1985202d5dabba21ca9a37e5aacf`.

Gate: o Platform Agent deve confirmar que `issuer` e `sub` pertencem à identidade Cognito de `prodexy.labs@gmail.com`. Não criar usuário ou senha Cognito por este procedimento; não enviar valores privados pelo chat. O responsável revisa o arquivo e confirma backup recente, DB Node 01 correto, database PH, migration inicial aplicada, e ausência de lojas, usuários, vínculos e contadores. A verificação de leitura de 2026-10-24 observou tabelas vazias, mas precisa ser repetida imediatamente antes da aplicação. Não usar a role runtime para executar a migration.

**Procedimento histórico de cópia pela sessão SSM — NÃO repetir na base PH:** no Windows, o arquivo local indicado era copiado com `Ctrl+A`, `Ctrl+C`. Os comandos abaixo foram preservados apenas para auditoria:

```sh
sudo install -d -m 0755 /var/tmp/ph-outlet
sudo tee /var/tmp/ph-outlet/202610240001_cadastro_inicial.sql >/dev/null <<'PH_CADASTRO_SQL'
```

O shell ficará aguardando. Cole todo o SQL copiado. Depois do último `COMMIT;`, em linha nova digite apenas `PH_CADASTRO_SQL` e pressione Enter. O delimitador não integra o arquivo. Se a sessão travar em `>` ou o hash divergir, pare; não execute arquivo parcial. Faça as pré-verificações:

```sh
ARQUIVO_SQL=/var/tmp/ph-outlet/202610240001_cadastro_inicial.sql
HASH_ESPERADO=74eeed07c10468df04213011e6fecb5af97f1985202d5dabba21ca9a37e5aacf
sudo -u postgres test -r "$ARQUIVO_SQL" || { echo 'arquivo ausente ou ilegível'; exit 1; }
HASH_REAL=$(sha256sum "$ARQUIVO_SQL" | cut -d ' ' -f1)
test "$HASH_REAL" = "$HASH_ESPERADO" || { echo 'checksum divergente; pare'; exit 1; }
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT current_database() AS banco, current_user AS usuario, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610140001_inicial') AS inicial_aplicada, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610240001_cadastro_inicial') AS cadastro_aplicado, (SELECT count(*) FROM public.lojas) AS lojas, (SELECT count(*) FROM public.usuarios) AS usuarios, (SELECT count(*) FROM public.usuarios_lojas) AS vinculos, (SELECT count(*) FROM public.sequencias_categoria) AS contadores;"
```

Esperado: banco `prodexy_ph_outlet`, usuário `postgres`, `inicial_aplicada=1`, `cadastro_aplicado=0` e as quatro contagens de negócio iguais a zero. Se qualquer valor divergir, pare e solicite revisão; não adapte o SQL na sessão. **Somente após handoff da identidade e revisão do responsável**, informe os identificadores no shell SSM sem colocá-los no arquivo ou no chat. Os comandos `read` não gravam os valores no histórico do shell:

```sh
printf 'Issuer confirmado pelo Platform Agent: '
IFS= read -r EMISSOR_COGNITO
printf 'Sub confirmado pelo Platform Agent (entrada oculta): '
stty -echo
IFS= read -r SUB_COGNITO
stty echo
printf '\n'
test "$EMISSOR_COGNITO" = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Jm4EQEGdZ' || { echo 'issuer divergente; pare'; exit 1; }
test -n "$SUB_COGNITO" || { echo 'sub ausente; pare'; exit 1; }
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -v emissor_cognito="$EMISSOR_COGNITO" -v sub_cognito="$SUB_COGNITO" -v hash_migracao="$HASH_REAL" -d prodexy_ph_outlet -f "$ARQUIVO_SQL"
unset EMISSOR_COGNITO SUB_COGNITO
```

O SQL aplica as quatro inserções em uma transação e registra a versão/hash antes de `COMMIT`. Ele toma locks curtos de escrita nas tabelas de cadastro (`lock_timeout=3s`); leituras continuam possíveis. `ON_ERROR_STOP=1` encerra no primeiro erro e a transação sem commit é revertida ao fechar `psql`. Após sucesso, confira sem imprimir `sub`:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT versao, hash_sha256 FROM public.migracoes_schema WHERE versao = '202610240001_cadastro_inicial'; SELECT l.nome, s.proximo_codigo FROM public.lojas l JOIN public.sequencias_categoria s ON s.loja_id = l.id ORDER BY l.nome; SELECT u.nome_exibicao, u.perfil, u.ativo, count(ul.loja_id) AS lojas_vinculadas FROM public.usuarios u JOIN public.usuarios_lojas ul ON ul.usuario_id = u.id AND ul.ativo GROUP BY u.id, u.nome_exibicao, u.perfil, u.ativo;"
```

Esperado: versão/hash igual ao arquivo; `PH Kids` e `PH Outlet` com próximo código `1`; um perfil `administrador` ativo `prodexy.labs@gmail.com` com dois vínculos. Isso comprova cadastro local, **não** login/MFA homologados. Se o comando falhar antes do `COMMIT`, confira contagens/ledger antes de qualquer repetição. Se houver erro ou divergência após `COMMIT`, não faça `DELETE`, reset ou replay: preserve evidência e peça uma migration corretiva; restore depende de procedimento e autorização separados do Platform Agent. Envie ao executor apenas saída de contagens/versão/hash, sem `issuer`, `sub`, senha ou tokens.

### P3.1 — tamanho da categoria: aplicada manualmente pelo responsável; NÃO REPETIR

Registro de 2026-10-25: responsável informou `COMMIT` no database PH e pós-check de versão/hash, duas colunas `NOT NULL`, dois índices e três privilégios; executor não consultou o banco. O procedimento a seguir é histórico para auditoria, **não uma instrução de nova execução**. Arquivo aplicado: `D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610240002_tamanho_categoria.sql`; `database/schema.sql` é o estado canônico, não uma migration. A migration inicial e a de cadastro também não devem ser repetidas. A migration de tamanho abortaria se houvesse categorias preexistentes, sem criar tamanhos fictícios.

No PowerShell local, confira e copie **o conteúdo do arquivo** para a área de transferência:

```powershell
$ArquivoPH = 'D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610240002_tamanho_categoria.sql'
Get-Item -LiteralPath $ArquivoPH | Select-Object Length
Get-FileHash -LiteralPath $ArquivoPH -Algorithm SHA256 | Select-Object Hash
Get-Content -LiteralPath $ArquivoPH -Raw | Set-Clipboard
```

Esperado: 1632 bytes e SHA-256 `7d073565370bd455dd7b942b36643ea117e1ec8cad515f6bf12947b807de80a8`. Na sessão SSM da instância de banco já conhecida, execute **somente** estes comandos de criação do arquivo local no servidor:

```sh
sudo install -d -m 0755 /var/tmp/ph-outlet
sudo tee /var/tmp/ph-outlet/202610240002_tamanho_categoria.sql >/dev/null <<'PH_TAMANHO_SQL'
```

Cole o conteúdo copiado. Depois de `COMMIT;`, em uma linha nova digite apenas `PH_TAMANHO_SQL` e Enter. Se o prompt continuar em `>`, não execute SQL: finalize corretamente a linha delimitadora ou interrompa a cópia e refaça. Confira bytes/hash antes de qualquer execução:

```sh
ARQUIVO_SQL=/var/tmp/ph-outlet/202610240002_tamanho_categoria.sql
sudo -u postgres test -r "$ARQUIVO_SQL" || { echo 'arquivo ausente ou ilegível; pare'; exit 1; }
test "$(wc -c < "$ARQUIVO_SQL")" -eq 1632 || { echo 'tamanho divergente; pare'; exit 1; }
HASH_REAL=$(sha256sum "$ARQUIVO_SQL" | cut -d ' ' -f1)
test "$HASH_REAL" = '7d073565370bd455dd7b942b36643ea117e1ec8cad515f6bf12947b807de80a8' || { echo 'hash divergente; pare'; exit 1; }
```

Pré-verificação somente leitura (não executar se qualquer condição divergir):

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT current_database() AS banco, current_user AS usuario, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610140001_inicial') AS inicial, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610240002_tamanho_categoria') AS tamanho_aplicado, (SELECT count(*) FROM public.categorias) AS categorias_existentes, (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'tamanho') AS coluna_tamanho;"
```

Esperado: banco `prodexy_ph_outlet`, usuário de manutenção `postgres`, `inicial=1`, `tamanho_aplicado=0`, `categorias_existentes=0`, `coluna_tamanho=0`. Se já houver categorias, pare e solicite plano de migração de dados reais; não apague registros. Após revisão do responsável, executar uma vez com parada no primeiro erro:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -v hash_migracao="$HASH_REAL" -d prodexy_ph_outlet -f "$ARQUIVO_SQL"
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT versao, hash_sha256, aplicada_em FROM public.migracoes_schema WHERE versao = '202610240002_tamanho_categoria'; SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name = 'categorias' AND column_name = 'tamanho') OR (table_name = 'itens_venda' AND column_name = 'tamanho_registrado')) ORDER BY table_name; SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'categorias' AND indexname IN ('categorias_loja_nome_tamanho_ativas_uidx', 'categorias_loja_nome_idx') ORDER BY indexname; SELECT has_column_privilege('prodexy_ph_outlet_app', 'public.categorias', 'tamanho', 'SELECT') AS consulta, has_column_privilege('prodexy_ph_outlet_app', 'public.categorias', 'tamanho', 'INSERT') AS inclusao, has_column_privilege('prodexy_ph_outlet_app', 'public.categorias', 'tamanho', 'UPDATE') AS alteracao;"
```

Esperado: versão/hash correspondentes, `categorias.tamanho` e `itens_venda.tamanho_registrado` com `is_nullable=NO`, dois índices e três privilégios verdadeiros (herdados dos grants existentes da tabela). A migration não cria role/grant novo. `ON_ERROR_STOP` e `BEGIN` revertem falha antes do commit; após commit, não reaplicar nem remover dados: registrar saída sem credenciais, pedir migration corretiva se algo divergir. Risco principal: lock das tabelas e eventual falha por categorias preexistentes. Restore do backup somente com autorização e procedimento separado do Platform Agent. Enviar ao executor apenas versão/hash e resultados do pós-check, sem segredos.

### P5.1 — metas e histórico: aplicada manualmente; NÃO REPETIR

Registro de 2026-10-25: o responsável informou `COMMIT` e apresentou pós-check com versão/hash corretos, 12 colunas em cada tabela, três índices e privilégios `t/t/t/f` para metas e `t/t/f` para histórico. O procedimento abaixo é histórico para auditoria e não deve ser executado novamente.

Arquivo a copiar: `D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610250001_metas.sql`. `database/schema.sql` é somente o estado canônico e não deve ser executado como migration. No PowerShell local, copie o conteúdo exato:

```powershell
$ArquivoPH = 'D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610250001_metas.sql'
Get-Item -LiteralPath $ArquivoPH | Select-Object Length
Get-FileHash -LiteralPath $ArquivoPH -Algorithm SHA256 | Select-Object Hash
Get-Content -LiteralPath $ArquivoPH -Raw | Set-Clipboard
```

Esperado: 3099 bytes e SHA-256 `03739587ddd887033831142efdc1a8604acc76e2f922fc0892530ee7b49015f2`. Na sessão SSM da instância de banco, crie o arquivo sem acrescentar o delimitador ao SQL:

```sh
sudo install -d -m 0755 /var/tmp/ph-outlet
sudo tee /var/tmp/ph-outlet/202610250001_metas.sql >/dev/null <<'PH_METAS_SQL'
```

Cole o conteúdo copiado. Depois de `COMMIT;`, em uma linha nova, digite somente `PH_METAS_SQL` e Enter. Se o prompt continuar em `>`, não execute o arquivo; interrompa a cópia e refaça. Confira bytes e hash:

```sh
ARQUIVO_SQL=/var/tmp/ph-outlet/202610250001_metas.sql
sudo -u postgres test -r "$ARQUIVO_SQL" || { echo 'arquivo ausente ou ilegível; pare'; exit 1; }
test "$(wc -c < "$ARQUIVO_SQL")" -eq 3099 || { echo 'tamanho divergente; pare'; exit 1; }
HASH_REAL=$(sha256sum "$ARQUIVO_SQL" | cut -d ' ' -f1)
test "$HASH_REAL" = '03739587ddd887033831142efdc1a8604acc76e2f922fc0892530ee7b49015f2' || { echo 'hash divergente; pare'; exit 1; }
```

Pré-verificação somente leitura; prossiga apenas se `banco=prodexy_ph_outlet`, `usuario=postgres`, `tamanho=1`, `metas=0`, `tabela_metas` e `tabela_historico` vazios:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT current_database() AS banco, current_user AS usuario, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610240002_tamanho_categoria') AS tamanho, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610250001_metas') AS metas, to_regclass('public.metas') AS tabela_metas, to_regclass('public.historico_metas') AS tabela_historico;"
```

Aplicação manual, uma única vez, com parada no primeiro erro, seguida do pós-check:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -v hash_migracao="$HASH_REAL" -d prodexy_ph_outlet -f "$ARQUIVO_SQL"
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT versao, hash_sha256, aplicada_em FROM public.migracoes_schema WHERE versao = '202610250001_metas'; SELECT table_name, count(*) AS colunas FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('metas', 'historico_metas') GROUP BY table_name ORDER BY table_name; SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('metas_vendedor_loja_periodo_idx', 'metas_loja_periodo_idx', 'historico_metas_meta_versao_idx') ORDER BY indexname; SELECT has_table_privilege('prodexy_ph_outlet_app', 'public.metas', 'SELECT') AS metas_consulta, has_table_privilege('prodexy_ph_outlet_app', 'public.metas', 'INSERT') AS metas_inclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.metas', 'UPDATE') AS metas_alteracao, has_table_privilege('prodexy_ph_outlet_app', 'public.metas', 'DELETE') AS metas_exclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.historico_metas', 'SELECT') AS historico_consulta, has_table_privilege('prodexy_ph_outlet_app', 'public.historico_metas', 'INSERT') AS historico_inclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.historico_metas', 'UPDATE') AS historico_alteracao;"
```

Esperado: versão/hash iguais ao arquivo; `historico_metas=12` e `metas=12` colunas; três índices; SELECT/INSERT/UPDATE de metas verdadeiros, DELETE falso; SELECT/INSERT do histórico verdadeiros e UPDATE falso. O risco principal é lock de catálogo curto durante os dois `CREATE TABLE`; execute sem outra manutenção concorrente. Qualquer erro antes do `COMMIT` é revertido ao encerrar o `psql`. Se houver erro ou divergência após commit, não reaplique, não apague objetos e não edite a migration: preserve a saída, bloqueie P5.1 e solicite migration corretiva. Restore somente com autorização e procedimento do Platform Agent.

### P5.2 — clientes e financeiro: aplicada manualmente em 2026-10-26; NÃO REPETIR

O responsável apresentou `COMMIT` e pós-check em 2026-10-26: versão/hash canônicos, `clientes=9` colunas, `despesas=8` colunas, seis índices e SELECT/INSERT verdadeiros com UPDATE falso para as duas tabelas. A migration `D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610260001_clientes_financeiro.sql` está aplicada e é imutável. O procedimento abaixo fica somente como evidência histórica; **não transferir nem executar novamente**. `database/schema.sql` permanece o estado canônico e não deve ser executado no banco existente. SHA-256 aplicado: `bec909299d360642a2c3be8297661de0b62382aafecc5475216f27ae87e7a07e`.

No PowerShell local, gere o comando único de transferência e coloque-o na área de transferência:

```powershell
$Arquivo = 'D:\Prodexy\Prodexy-Ph-Outlet\database\migrations\202610260001_clientes_financeiro.sql'
$Bytes = [System.IO.File]::ReadAllBytes($Arquivo)
$Memoria = New-Object System.IO.MemoryStream
$Gzip = New-Object System.IO.Compression.GZipStream($Memoria, [System.IO.Compression.CompressionMode]::Compress, $true)
$Gzip.Write($Bytes, 0, $Bytes.Length)
$Gzip.Dispose()
$Base64 = [Convert]::ToBase64String($Memoria.ToArray())
$Comando = "sudo install -d -m 0755 /var/tmp/ph-outlet; printf '%s' '$Base64' | base64 -d | gzip -d | sudo tee /var/tmp/ph-outlet/202610260001_clientes_financeiro.sql >/dev/null"
Set-Clipboard -Value $Comando
```

Em uma sessão SSM nova do DB Node, cole uma única vez o comando da área de transferência e pressione Enter. Depois confira somente o hash:

```sh
ARQUIVO_SQL=/var/tmp/ph-outlet/202610260001_clientes_financeiro.sql
sudo -u postgres sha256sum "$ARQUIVO_SQL"
```

O hash remoto confirmado foi `bec909299d360642a2c3be8297661de0b62382aafecc5475216f27ae87e7a07e`.

Pré-verificação somente leitura; prossiga apenas com banco/usuário corretos, `metas=1`, `p52=0` e os três objetos novos vazios:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT current_database() AS banco, current_user AS usuario, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610250001_metas') AS metas, (SELECT count(*) FROM public.migracoes_schema WHERE versao = '202610260001_clientes_financeiro') AS p52, to_regclass('public.clientes') AS tabela_clientes, to_regclass('public.despesas') AS tabela_despesas, (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'cliente_id') AS coluna_cliente;"
```

Confirme também backup PH recente conforme operação da plataforma. Aplique uma única vez e pare no primeiro erro:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -v hash_migracao="bec909299d360642a2c3be8297661de0b62382aafecc5475216f27ae87e7a07e" -d prodexy_ph_outlet -f "$ARQUIVO_SQL"
```

Após `COMMIT`, execute o pós-check:

```sh
sudo -u postgres psql -X -P pager=off -v ON_ERROR_STOP=1 -d prodexy_ph_outlet -c "SELECT versao, hash_sha256, aplicada_em FROM public.migracoes_schema WHERE versao = '202610260001_clientes_financeiro'; SELECT table_name, count(*) AS colunas FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('clientes', 'despesas') GROUP BY table_name ORDER BY table_name; SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'cliente_id'; SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('vendas_cliente_data_idx', 'clientes_nome_idx', 'clientes_loja_preferida_idx', 'clientes_nascimento_idx', 'despesas_loja_data_idx', 'despesas_categoria_data_idx') ORDER BY indexname; SELECT has_table_privilege('prodexy_ph_outlet_app', 'public.clientes', 'SELECT') AS clientes_consulta, has_table_privilege('prodexy_ph_outlet_app', 'public.clientes', 'INSERT') AS clientes_inclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.clientes', 'UPDATE') AS clientes_alteracao, has_table_privilege('prodexy_ph_outlet_app', 'public.despesas', 'SELECT') AS despesas_consulta, has_table_privilege('prodexy_ph_outlet_app', 'public.despesas', 'INSERT') AS despesas_inclusao, has_table_privilege('prodexy_ph_outlet_app', 'public.despesas', 'UPDATE') AS despesas_alteracao, has_table_privilege('prodexy_ph_outlet_app', 'public.vendas', 'UPDATE') AS vendas_alteracao;"
```

Esperado: versão/hash iguais ao arquivo; `clientes=9` e `despesas=8` colunas; `vendas.cliente_id` anulável; seis índices; SELECT/INSERT verdadeiros e UPDATE falso em clientes/despesas, além de UPDATE falso em vendas. A migration não cria registros comerciais. Risco principal: `ALTER TABLE public.vendas` toma lock exclusivo curto; execute sem venda ou manutenção concorrente. Falha antes do `COMMIT` reverte toda a transação. Após commit, não reaplique, não remova objetos nem edite o arquivo: preserve a saída e peça migration corretiva. Restore depende de autorização e procedimento do Platform Agent.

Pré-release: decisões resolvidas, gates, migrations testadas, backup verificado, Vercel/URL/Auth configurados, limites de conexão, HBA, usuário admin e teste sem dados reais aprovados. Migrations e deploy são passos separados; registrar ambos. Homologar login, loja, estoque, venda, etiquetas, térmica e metas. Nunca apagar protótipo em massa antes da paridade.

Rollback de aplicação para revisão compatível; se schema mudou, preferir migration corretiva, interrompendo escrita se necessário. Restore somente autorizado em destino isolado e conforme política da plataforma; não restaurar por cima de produção por este runbook. Validar inclusão do database no backup existente e restore lógico autorizado antes do aceite operacional. Não exigir nova EC2 nem ampliar estratégia de disaster recovery.

## Incidentes e DIURNO

Movimentação de estoque com resposta desconhecida: usar "Verificar se foi registrada" na mesma loja. Se encontrada com movimento, conferir categoria/tamanho e saldo; não reenviar. Se ainda não localizada, aguardar e verificar novamente; um POST ainda em trânsito pode confirmar depois. Se for necessário reenviar, manter exatamente a mesma chave e os mesmos dados: a unicidade por loja impede soma duplicada. Não editar a solicitação enquanto a reconciliação estiver pendente. Os testes atuais são locais; não executar fixture ou escrita de homologação no database PH sem autorização e ambiente isolado.

Pool esgotado: timeout controlado, logs sem segredo, revisar concorrência; não elevar max_connections unilateralmente. Queda após venda: consultar chave idempotente para descobrir resultado antes de repetir. Falha de impressão: reimprimir venda confirmada, não repetir venda. Certificado expirado: acionar operador, nunca desabilitar TLS. Node indisponível: informar usuário; sem fila offline implícita. DIURNO não autoriza desligamento; futuro plano da plataforma deve reconciliar todos os consumidores e backup antes de qualquer agenda.
