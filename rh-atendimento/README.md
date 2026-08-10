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
- **CLT e Estágio**: Benefícios · Pagamento · Afastamento · Férias · Auxílio creche ·
  Ponto eletrônico (atestados)
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
| `/rh` | RH | Fila com filtros, busca e indicadores |
| `/rh/chamados/[id]` | RH | Atendimento do chamado |

---

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

## 7. Manutenção

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

## 8. Identidade visual

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

## 9. Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm start          # sobe o build
npm run typecheck  # checagem de tipos
```
