# Central de Atendimento do RH · Grupo TEA

Canal único para os chamados de RH das cerca de 1.000 pessoas do Grupo TEA (CLT, PJ e
estágio), substituindo o atendimento espalhado entre WhatsApp, e-mail e presencial.

- **Colaborador**: abre o chamado sem login, recebe um protocolo e acompanha tudo com
  protocolo + CPF.
- **RH**: 5 a 7 usuários com login e senha, fila de atendimento, respostas, notas internas,
  responsável, prioridade e histórico.
- **Custo**: R$ 0 nos planos gratuitos de Vercel, Supabase e Resend.

---

## 1. Como está montado

| Peça | Serviço | Plano gratuito |
|---|---|---|
| Site e servidor | Vercel (Next.js) | 100 GB de banda/mês |
| Banco de dados, login e anexos | Supabase | 500 MB de banco, 1 GB de arquivos, 50 mil logins/mês |
| E-mails automáticos | Resend | 3.000 e-mails/mês |

Com 1.000 pessoas, a folga é grande: um chamado ocupa poucos KB no banco, e o consumo real
fica nos anexos (atestados). Veja a seção 7 para o que fazer quando o 1 GB de arquivos
começar a encher.

### Fluxo de atendimento

```
Colaborador → vínculo (PJ | CLT | Estágio) → categoria → assunto → dados + anexos
           → protocolo TEA-2026-000123 (por e-mail)
           → acompanha e responde em /consulta

RH → login em /rh/login → fila → assume → responde (ou nota interna) → resolve
```

O catálogo de assuntos é o do processo desenhado pelo RH:

- **PJ**: Contratos · Distratos · Mudança de chave Pix · Pagamentos
- **CLT**: Benefícios · Pagamento · Afastamento · Férias · Auxílio creche ·
  Ponto eletrônico (atestados)
- **Estágio**: Benefícios · Bolsa Auxílio · Descanso Remunerado · Contrato
- **Todos**: Outros assuntos — dúvida geral, declaração/documento, atualização cadastral,
  sugestão ou elogio. É a garantia de que ninguém fica sem caminho por não achar o assunto
  exato na lista, como promete a comunicação do canal.

Tudo isso está em [`src/lib/catalogo.ts`](src/lib/catalogo.ts). Para criar um novo tipo de
chamado, com campos próprios e anexo obrigatório, basta acrescentar um item nesse arquivo —
formulário, painel e filtros se ajustam sozinhos.

---

## 2. Instalação (passo a passo)

### 2.1 Criar o projeto no Supabase

1. Crie uma conta em <https://supabase.com> e um projeto novo (região **South America
   (São Paulo)**).
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e
   execute. Isso cria as tabelas, o gerador de protocolo, as regras de segurança (RLS) e o
   bucket privado `anexos`.
3. Em **Project Settings › API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**segredo**: só no servidor, nunca no
     navegador, nunca no Git)

### 2.2 Cadastrar a equipe de RH (5 a 7 pessoas)

Em **Authentication › Users › Add user**, crie um usuário por pessoa do RH com e-mail e
senha. Marque *Auto Confirm User*. O sistema cria o perfil automaticamente e a pessoa já
entra em `/rh/login`.

Não existe autocadastro: quem não for criado aqui não entra no painel.

Para tirar o acesso de alguém sem apagar o histórico de atendimentos, rode no SQL Editor:

```sql
update public.rh_usuarios set ativo = false where email = 'pessoa@empresa.com.br';
```

Para deixar alguém como administrador (hoje o papel é informativo, usado para futuras
permissões):

```sql
update public.rh_usuarios set papel = 'admin' where email = 'pessoa@empresa.com.br';
```

### 2.3 Configurar o e-mail (opcional, mas recomendado)

1. Crie a conta gratuita em <https://resend.com>.
2. Gere uma API key → `RESEND_API_KEY`.
3. Enquanto o domínio da empresa não estiver validado no Resend, use o remetente de teste
   `RH Grupo TEA <onboarding@resend.dev>`. Para chegar na caixa de entrada de todo mundo,
   valide o domínio em **Domains** e troque `EMAIL_REMETENTE` para algo como
   `RH Grupo TEA <rh@suaempresa.com.br>`.
4. `EMAIL_AVISO_RH` recebe o aviso de chamado novo (aceita vários e-mails separados por
   vírgula).

Sem `RESEND_API_KEY` o sistema continua funcionando normalmente — apenas não envia e-mails,
e o colaborador acompanha pelo protocolo.

### 2.4 Publicar na Vercel

1. Importe o repositório em <https://vercel.com/new>.
2. Em **Root Directory**, selecione `rh-atendimento`.
3. Em **Environment Variables**, cadastre as chaves do arquivo
   [`.env.example`](.env.example).
4. Deploy. Depois ajuste `NEXT_PUBLIC_URL_BASE` para o endereço final (é ele que aparece nos
   links dos e-mails).

### 2.5 Rodar na sua máquina

```bash
cd rh-atendimento
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev                  # http://localhost:3000
```

---

## 3. Endereços do sistema

| Endereço | Para quem | O que faz |
|---|---|---|
| `/` | Colaborador | Boas-vindas e explicação do canal |
| `/abrir` | Colaborador | Abertura do chamado em 4 passos |
| `/consulta` | Colaborador | Acompanhar e responder (protocolo + CPF) |
| `/rh/login` | RH | Entrada no painel |
| `/rh` | RH | Fila com filtros e busca |
| `/rh/indicadores` | RH | Painel de indicadores do atendimento |
| `/rh/chamados/[id]` | RH | Atendimento do chamado, com prazos de SLA |
| `/rh/sla` | RH | Calculadora de SLA, prazos por assunto e regras |
| `/rh/conta` | RH | Troca de senha, resumo diário e destinatários dos avisos |
| `/rh/recuperar` | RH | "Esqueci minha senha" |
| `/api/resumo-diario` | Rotina | Resumo da manhã por e-mail (dias úteis, 7h30) |
| `/diagnostico` | Implantação | Confere chaves, banco e armazenamento |

---

### Como os anexos trafegam

Os arquivos **não passam pelo servidor do site**: a Vercel recusa requisições acima de
~4,5 MB, e uma foto de atestado tirada no celular passa disso facilmente. O fluxo é:

1. o navegador pede autorização ao servidor (`src/actions/upload.ts`);
2. o servidor confere tipo e tamanho e devolve um endereço temporário de gravação;
3. o navegador envia o arquivo direto para o Supabase;
4. ao registrar a solicitação, o servidor move o arquivo do rascunho para a pasta do
   chamado e guarda a referência.

O bucket também tem limite próprio de 8 MB por arquivo e lista de formatos aceitos, para
valer mesmo que alguém contorne a tela.

Tanto o colaborador quanto o RH podem anexar arquivos — o RH anexa junto da resposta ou de
uma nota interna. **Arquivo preso a uma nota interna não aparece para o colaborador**: ele
acompanha o sigilo da nota.

### Retenção: anexos somem em 30 dias

Documento pessoal não deve ficar guardado além do necessário — é princípio da LGPD e é o
que mantém o armazenamento dentro do plano gratuito. Por isso:

- uma rotina diária (`/api/limpeza-anexos`, agendada em `vercel.json` às 3h da manhã)
  apaga os arquivos com mais de 30 dias e os uploads abandonados;
- na tela de atendimento, cada anexo tem **Baixar** e **Apagar arquivo** — o RH baixa,
  guarda onde precisa e apaga na hora;
- o **registro** do anexo continua no chamado, com quem apagou e quando. Some o arquivo,
  não o histórico.

Para a rotina rodar, cadastre na Vercel a variável **`CRON_SECRET`** com qualquer texto
longo e aleatório. Sem ela, a rota só aceita chamadas da própria Vercel.

Para testar a limpeza na hora, sem esperar a madrugada:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://seu-endereco/api/limpeza-anexos
```

### Quanto o sistema aguenta

| Recurso | Cota gratuita | Consumo por chamado | Capacidade |
|---|---|---|---|
| Banco (chamados, mensagens, histórico) | 500 MB | ~4 KB | **~100 mil chamados** |
| Arquivos (anexos) | 1 GB | ~1,5 MB quando tem anexo | **~650 chamados com anexo por vez** |

O banco não é o gargalo: com 1.000 pessoas abrindo uma média de um chamado por mês, os
500 MB dariam para mais de oito anos de histórico completo.

O limite real está nos **anexos**, e é por isso que a retenção de 30 dias importa: o
armazenamento não acumula para sempre, ele se estabiliza no volume de um mês. Cabem cerca
de 650 chamados com anexo dentro de cada janela de 30 dias — bem acima da expectativa de
atestados de um grupo desse tamanho. A aba **Indicadores** mostra o quanto está em uso.

Acessos simultâneos não são preocupação: o site é servido sem estado e o banco responde
por HTTP, então dezenas de pessoas preenchendo o formulário ao mesmo tempo não competem
entre si.

## 4. Segurança e LGPD

O sistema lida com CPF e atestados médicos, que são dados sensíveis. O que já está feito:

- **RLS ligado em todas as tabelas.** O navegador do colaborador não fala com o banco: toda
  abertura e consulta passa pelo servidor, que valida antes de gravar.
- **Bucket de anexos privado.** Atestados não têm URL pública; o acesso é por link assinado
  que expira em 30 minutos.
- **Consulta protegida por protocolo + CPF**, com limite de 12 tentativas a cada 15 minutos
  por IP (e 15 aberturas por hora), para evitar tentativa de adivinhação.
- **Notas internas** do RH nunca são devolvidas para o colaborador — a consulta pública
  filtra `interna = false` no próprio servidor.
- **Histórico de alterações** por chamado: quem mudou status, prioridade e responsável.
- **Papel e acesso protegidos**: cada pessoa do RH só consegue alterar o próprio nome e a
  preferência de resumo. Ninguém se promove a administrador nem reativa o próprio acesso.
- **Senhas**: ficam só no Supabase Auth, guardadas como hash. O portal nunca grava, registra
  em log ou envia senha por e-mail; guarda apenas que a senha mudou, por quem e quando.
- As páginas do sistema pedem para não serem indexadas por buscadores.

O que depende de você:

- Guardar a `SUPABASE_SERVICE_ROLE_KEY` só nas variáveis de ambiente da Vercel.
- Definir por quanto tempo o RH guarda atestados e comprovantes, e apagar o que passar do
  prazo (sugestão de rotina na seção 7).
- Avisar a equipe que nota interna é registro de trabalho e pode ser pedida pelo titular dos
  dados em uma solicitação de acesso.

---

## 5. Operação do dia a dia

**Fila**: por padrão `/rh` mostra os chamados em aberto, dos mais recentemente atualizados
para os mais antigos. Os filtros combinam status, vínculo, responsável (meus / sem
responsável) e busca por protocolo, nome, e-mail ou CPF.

**Status**:

| Status | Quando usar |
|---|---|
| Aberto | Chegou e ninguém pegou ainda |
| Em andamento | Alguém do RH assumiu e está tratando |
| Aguardando colaborador | Respondemos e dependemos de um retorno (é o padrão ao responder) |
| Resolvido | Assunto encerrado — dispara e-mail de encerramento |
| Cancelado | Duplicado, aberto por engano ou desistência |

Se o colaborador responde um chamado resolvido ou aguardando retorno, ele **volta
automaticamente para "Aberto"** — nada é encerrado por esquecimento.

---

## 6. Estrutura do código

```
src/
  app/
    page.tsx                    página inicial do colaborador
    abrir/                      formulário de abertura
    consulta/                   acompanhamento por protocolo + CPF
    rh/                         login, fila e tela de atendimento
  actions/
    publico.ts                  abrir, consultar e responder (sem login)
    rh.ts                       login, resposta, status, atribuição
  components/                   formulários e blocos de interface
  lib/
    catalogo.ts                 categorias e assuntos (edite aqui)
    dominio.ts                  status, prioridades, limites de anexo
    email.ts                    modelos de e-mail (Resend)
    validacao.ts                validação dos formulários (zod)
    limite.ts                   freio contra spam e força bruta
    supabase/                   clientes de banco (admin, servidor, navegador)
  middleware.ts                 renova a sessão e protege /rh
supabase/schema.sql             banco, RLS e bucket - rode uma vez
```

---

## 7. Chamados de teste

Chamados abertos em homologação ou treinamento não devem sujar os indicadores. Por isso
existe a marcação **de teste**: o chamado continua guardado e acessível, o colaborador
segue vendo o dele, mas ele sai da fila e não conta em nenhum número.

- **Um a um**: na tela de atendimento, botão *Marcar como teste* (e *Voltar a contar*).
- **Na virada para a operação real**: rode no SQL Editor do Supabase, no dia em que o canal
  entrar no ar, para separar tudo o que veio antes:

```sql
update public.chamados set de_teste = true where criado_em < now();
```

Depois disso, a fila e os indicadores passam a mostrar apenas o que entrar a partir dali.
Para reconferir o que foi separado, use o filtro **Base › Somente testes** na tela de
chamados.

## 8. Manutenção

**Espaço dos anexos.** O plano gratuito do Supabase dá 1 GB. Um atestado fotografado tem
~1 MB, então cabem cerca de mil documentos. Para acompanhar, veja **Storage › anexos** no
painel do Supabase. Quando chegar perto do limite, apague os anexos de chamados encerrados
há mais de X meses (defina o prazo com o jurídico) ou mova para o Google Drive da empresa.

**Backup.** O Supabase gratuito não faz backup automático de longo prazo. Uma vez por mês,
exporte os chamados em **Table Editor › chamados › Export CSV**, ou rode:

```sql
select protocolo, criado_em, vinculo, categoria, subcategoria, status,
       solicitante_nome, solicitante_email
from public.chamados
order by criado_em desc;
```

**Projeto pausado por inatividade.** Projetos gratuitos do Supabase pausam após 7 dias sem
uso. Com chamados entrando toda semana isso não acontece; se acontecer, é só despausar pelo
painel.

**Novos assuntos no catálogo.** Edite `src/lib/catalogo.ts` e faça o deploy. Chamados
antigos continuam válidos, porque cada chamado guarda o título do assunto no momento da
abertura.

---

## 9. Identidade visual

O sistema usa a paleta oficial do Grupo TEA. As cores estão declaradas em um único lugar,
[`src/app/globals.css`](src/app/globals.css), e todo o resto se serve delas.

| Cor | Hex | Onde aparece |
|---|---|---|
| Azul | `#26a3d0` | Vínculo PJ, status "Aberto", indicador "Na fila" |
| Turquesa | `#09a497` | Cor de ação (botões e links), vínculo CLT, status "Resolvido" |
| Âmbar | `#f9a50f` | Vínculo Estágio, status "Em andamento", notas internas |
| Laranja | `#ec562a` | Status "Aguardando colaborador", prioridade Alta, avisos |
| Vinho | `#901845` | Prioridade Urgente |

Cada cor tem tons pastéis (`50`, `100`, `200`) para fundos e tons escuros (`600`, `700`,
`800`) para texto e botões. Os pares usados foram conferidos para ter contraste mínimo de
4.5:1 — é o que garante leitura para quem enxerga pouco ou está no celular sob sol.
Se for criar telas novas, mantenha a dupla "fundo pastel + texto escuro da mesma cor".

**Logo.** A marca oficial do Grupo TEA está em `public/`, com o fundo branco já removido:

| Arquivo | Onde é usado |
|---|---|
| `logo-grupo-tea.png` | Página inicial e tela de login (logo completo) |
| `simbolo-grupo-tea.png` | Cabeçalho de todas as páginas (só o círculo) |
| `logo-grupo-tea.svg` | Reserva: aparece se o PNG for removido |
| `icone.svg` | Ícone da aba do navegador |

Para trocar a arte no futuro, basta substituir os PNGs mantendo os mesmos nomes — não é
preciso mexer em código. Use sempre fundo transparente; o `simbolo-` deve ser um recorte
quadrado só do círculo, porque no cabeçalho ele aparece com cerca de 40 px de altura e o
logo completo ficaria ilegível nesse tamanho.

## 10. Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm start          # sobe o build
npm run typecheck  # checagem de tipos
```

## 11. SLA, avisos por e-mail e conta do RH

### Como o SLA funciona

Todo chamado novo chega com uma **prévia de SLA**: prioridade (Crítica, Alta, Normal ou
Planejada), prazo da 1ª resposta e prazo de resolução. A prévia usa:

1. o **assunto** escolhido no portal, que define a prioridade base e o prazo de resolução;
2. os **campos do formulário** (motivo do afastamento, datas de início, retorno e vigência);
3. **palavras-chave do relato** (por exemplo "assédio", "não caiu", "todos da unidade"), que
   sugerem os agravantes; e
4. o **histórico**: o mesmo CPF com o mesmo assunto nos últimos 30 dias conta como reincidência.

A triagem confirma (**Confirmar SLA**) ou ajusta (**Salvar revisão**) no quadro ao lado do
chamado. Os prazos contam desde a abertura, não desde a confirmação. Enquanto o chamado está
"Aguardando colaborador" (ou resolvido), o relógio da resolução para, e o prazo é estendido
quando o chamado volta a andar.

A prévia fica guardada. Na primeira confirmação, o portal registra se ela acertou o nível e os
agravantes. A aba **Indicadores** mostra a taxa de acerto por assunto e indica quando um
assunto pode dispensar a confirmação humana: pelo menos 30 confirmados, 95% de acerto e
nenhuma prévia abaixo do nível oficial. Chamados Críticos sempre passam por uma pessoa.

| Onde mudar | Arquivo |
|---|---|
| Prioridade, prazos e "o que conta como resolvido" de cada assunto | `src/lib/sla/regras.ts` |
| Palavras-chave dos agravantes | `src/lib/sla/palavras.ts` |
| Expediente (8h às 18h) e feriados | `src/lib/sla/calendario.ts` |

Um assunto novo no catálogo sem regra própria entra como Normal com 5 dias úteis até ganhar a
sua regra. A calculadora em `/rh/sla` usa as mesmas regras da fila; o arquivo
`ferramentas/calculadora-sla.html` é a versão avulsa usada antes da integração e não acompanha
mudanças feitas aqui.

### Avisos por e-mail

| Aviso | Quem recebe | Quando |
|---|---|---|
| Resumo pessoal | Cada pessoa do RH com chamado atribuído | Dias úteis, 7h30 |
| Resumo da gestão | Destinatários "gestão" | Dias úteis, 7h30 (às segundas, com a semana) |
| Pendências de triagem | Destinatários "triagem" | Dias úteis, 7h30, se houver pendência |
| Chamado Crítico | Gestão e triagem | Na hora em que o chamado chega ou é reclassificado |
| Senha alterada | A própria pessoa | Na hora da troca |

Os e-mails levam só números e links para a fila já filtrada, nunca nomes de colaboradores ou
o texto dos chamados. Quem não tem nada pendente não recebe e-mail. Cada pessoa do RH pode
desligar o próprio resumo em **Minha conta**. Os destinatários de gestão e triagem não precisam
ter login: um administrador os cadastra em **Minha conta › Quem recebe os avisos**.

A rotina é a `/api/resumo-diario`, agendada em `vercel.json` (`30 10 * * 1-5`, ou seja, 7h30
de Brasília em dias de semana; no plano gratuito da Vercel o horário pode variar dentro da
hora). Feriados são pulados. Um registro por destinatário e dia evita e-mail duplicado.

Para conferir sem enviar nada:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" "https://seu-endereco/api/resumo-diario?simular=1"
```

### Troca e recuperação de senha

- **Minha conta › Alterar senha**: pede a senha atual, exige 10 caracteres com letras e
  números, desconecta os outros aparelhos e envia um aviso por e-mail. Limite de 5 tentativas
  a cada 15 minutos.
- **Esqueci minha senha** (tela de login): envia um link para o e-mail de cadastro. A resposta
  na tela é sempre a mesma, para não revelar quais e-mails existem.

### Passo a passo para colocar no ar

1. **Antes do deploy**, rode de novo o `supabase/schema.sql` inteiro no SQL Editor. Ele só
   acrescenta colunas e tabelas e pode ser executado mais de uma vez. (Se o deploy acontecer
   antes, o portal continua funcionando: abrir e responder chamados não depende do SLA, e a
   fila mostra um aviso até a migração rodar.)
2. Defina quem é administrador:
   ```sql
   update public.rh_usuarios set papel = 'admin' where email = 'pessoa@empresa.com.br';
   ```
3. Entre no portal como administrador e cadastre os destinatários de gestão e triagem em
   **Minha conta**.
4. Confira se `CRON_SECRET` e `RESEND_API_KEY` estão nas variáveis da Vercel e se o
   remetente (`EMAIL_REMETENTE`) é de um domínio validado no Resend.
5. Para o "Esqueci minha senha", no painel do Supabase:
   - **Authentication › URL Configuration**: em *Site URL*, o endereço do portal; em
     *Redirect URLs*, acrescente `https://seu-endereco/rh/auth/confirmar`.
   - **Project Settings › Authentication › SMTP Settings**: configure o envio pelo Resend
     (host `smtp.resend.com`, porta 465, usuário `resend`, senha = a API key). O envio padrão do
     Supabase manda pouquíssimos e-mails por hora e não serve para uso real.
   - Opcional: em **Authentication › Email Templates › Reset Password**, troque o link para
     `{{ .SiteURL }}/rh/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery`. Assim o link
     funciona mesmo se a pessoa abrir o e-mail em outro aparelho.
6. Chamados abertos antes da atualização aparecem "Sem prazos calculados". Na tela do chamado,
   o botão **Calcular prazos** calcula a partir da data de abertura.
