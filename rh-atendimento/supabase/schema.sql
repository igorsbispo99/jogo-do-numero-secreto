-- =====================================================================
-- Central de Atendimento de RH - Grupo TEA
-- Execute este arquivo inteiro no SQL Editor do Supabase (uma única vez).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type vinculo_tipo as enum ('pj', 'clt', 'estagio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chamado_status as enum (
    'aberto',
    'em_andamento',
    'aguardando_colaborador',
    'resolvido',
    'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type chamado_prioridade as enum ('baixa', 'normal', 'alta', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type autor_tipo as enum ('colaborador', 'rh', 'sistema');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rh_papel as enum ('admin', 'agente');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Usuários do RH (espelha auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.rh_usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  papel rh_papel not null default 'agente',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Todo usuário criado no Supabase Auth vira automaticamente um agente de RH.
-- Como o cadastro é feito só por convite no painel do Supabase, isso é seguro:
-- ninguém consegue se auto-registrar.
create or replace function public.handle_novo_usuario_rh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rh_usuarios (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario_rh();

-- Helper usado pelas policies: o usuário logado é um agente de RH ativo?
create or replace function public.e_rh()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rh_usuarios u
    where u.id = auth.uid() and u.ativo
  );
$$;

-- ---------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------
create sequence if not exists public.protocolo_seq start 1;

create or replace function public.gerar_protocolo()
returns text
language sql
volatile
as $$
  select 'TEA-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' ||
         lpad(nextval('public.protocolo_seq')::text, 6, '0');
$$;

create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique default public.gerar_protocolo(),

  -- quem abriu
  solicitante_nome text not null,
  solicitante_email text not null,
  solicitante_cpf text not null,          -- somente dígitos
  solicitante_telefone text,
  unidade text,
  vinculo vinculo_tipo not null,

  -- o que é
  categoria text not null,
  subcategoria text not null,
  assunto text not null,
  descricao text not null,
  dados_extras jsonb not null default '{}'::jsonb,

  -- tratativa
  status chamado_status not null default 'aberto',
  prioridade chamado_prioridade not null default 'normal',
  responsavel_id uuid references public.rh_usuarios (id) on delete set null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primeira_resposta_em timestamptz,
  resolvido_em timestamptz
);

create index if not exists chamados_status_idx on public.chamados (status, criado_em desc);
create index if not exists chamados_cpf_idx on public.chamados (solicitante_cpf);
create index if not exists chamados_protocolo_idx on public.chamados (protocolo);
create index if not exists chamados_responsavel_idx on public.chamados (responsavel_id);
create index if not exists chamados_email_idx on public.chamados (lower(solicitante_email));

create or replace function public.touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists chamados_touch on public.chamados;
create trigger chamados_touch
  before update on public.chamados
  for each row execute function public.touch_atualizado_em();

-- ---------------------------------------------------------------------
-- Mensagens (conversa do chamado)
-- ---------------------------------------------------------------------
create table if not exists public.chamado_mensagens (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  autor_tipo autor_tipo not null,
  autor_nome text not null,
  autor_id uuid references public.rh_usuarios (id) on delete set null,
  corpo text not null,
  interna boolean not null default false,   -- nota interna: o colaborador nunca vê
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_chamado_idx
  on public.chamado_mensagens (chamado_id, criado_em);

-- ---------------------------------------------------------------------
-- Anexos (atestados, comprovantes, notas fiscais...)
-- ---------------------------------------------------------------------
create table if not exists public.chamado_anexos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  mensagem_id uuid references public.chamado_mensagens (id) on delete set null,
  caminho text not null,           -- path dentro do bucket "anexos"
  nome_arquivo text not null,
  tipo_mime text,
  tamanho_bytes bigint,
  criado_em timestamptz not null default now()
);

create index if not exists anexos_chamado_idx on public.chamado_anexos (chamado_id);

-- Retenção: o arquivo some do armazenamento depois de 30 dias (ou quando o RH
-- apaga manualmente), mas o registro de que existiu permanece no chamado.
alter table public.chamado_anexos
  add column if not exists removido_em timestamptz,
  add column if not exists removido_por text;

create index if not exists anexos_retencao_idx
  on public.chamado_anexos (criado_em)
  where removido_em is null;

-- ---------------------------------------------------------------------
-- Histórico de alterações (auditoria)
-- ---------------------------------------------------------------------
create table if not exists public.chamado_eventos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  autor_nome text not null,
  descricao text not null,
  criado_em timestamptz not null default now()
);

create index if not exists eventos_chamado_idx
  on public.chamado_eventos (chamado_id, criado_em);

-- Etapas marcadas como públicas aparecem para o colaborador no acompanhamento
-- do protocolo. As de bastidor (prioridade, remanejamento interno) ficam só
-- para o RH. Rodar este arquivo de novo acrescenta a coluna sem perder dados.
alter table public.chamado_eventos
  add column if not exists publico boolean not null default true;

-- ---------------------------------------------------------------------
-- Controle de tentativas de consulta pública (anti força-bruta de CPF)
-- ---------------------------------------------------------------------
create table if not exists public.consulta_tentativas (
  id bigserial primary key,
  chave text not null,             -- IP do solicitante
  sucesso boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists tentativas_chave_idx
  on public.consulta_tentativas (chave, criado_em desc);

-- ---------------------------------------------------------------------
-- Segurança: RLS ligado em tudo.
-- O público NUNCA fala direto com o banco - só o servidor (service role)
-- responde pelo formulário e pela consulta por protocolo.
-- O RH logado enxerga tudo através das policies abaixo.
-- ---------------------------------------------------------------------
alter table public.rh_usuarios          enable row level security;
alter table public.chamados             enable row level security;
alter table public.chamado_mensagens    enable row level security;
alter table public.chamado_anexos       enable row level security;
alter table public.chamado_eventos      enable row level security;
alter table public.consulta_tentativas  enable row level security;

drop policy if exists "rh le usuarios" on public.rh_usuarios;
create policy "rh le usuarios" on public.rh_usuarios
  for select to authenticated using (public.e_rh());

drop policy if exists "usuario edita a si mesmo" on public.rh_usuarios;
create policy "usuario edita a si mesmo" on public.rh_usuarios
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "rh le chamados" on public.chamados;
create policy "rh le chamados" on public.chamados
  for select to authenticated using (public.e_rh());

drop policy if exists "rh atualiza chamados" on public.chamados;
create policy "rh atualiza chamados" on public.chamados
  for update to authenticated using (public.e_rh()) with check (public.e_rh());

drop policy if exists "rh le mensagens" on public.chamado_mensagens;
create policy "rh le mensagens" on public.chamado_mensagens
  for select to authenticated using (public.e_rh());

drop policy if exists "rh escreve mensagens" on public.chamado_mensagens;
create policy "rh escreve mensagens" on public.chamado_mensagens
  for insert to authenticated with check (public.e_rh() and autor_id = auth.uid());

drop policy if exists "rh le anexos" on public.chamado_anexos;
create policy "rh le anexos" on public.chamado_anexos
  for select to authenticated using (public.e_rh());

drop policy if exists "rh le eventos" on public.chamado_eventos;
create policy "rh le eventos" on public.chamado_eventos
  for select to authenticated using (public.e_rh());

-- consulta_tentativas fica sem policy de propósito: só o service role acessa.

-- ---------------------------------------------------------------------
-- Storage: bucket privado para anexos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

-- Limites aplicados pelo próprio Supabase, independentemente do que o site
-- validar: no máximo 8 MB por arquivo e só formatos de documento e imagem.
update storage.buckets
   set file_size_limit = 8388608,
       allowed_mime_types = array[
         'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'
       ]
 where id = 'anexos';

drop policy if exists "rh le anexos storage" on storage.objects;
create policy "rh le anexos storage" on storage.objects
  for select to authenticated
  using (bucket_id = 'anexos' and public.e_rh());
