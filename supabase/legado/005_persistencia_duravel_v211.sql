-- Beb's Gestão v2.1.1 — Persistência Durável / Write-through
-- Execute DEPOIS do 004_operacao_pro_v21.sql.
--
-- Objetivos:
-- 1) cada alteração confirmada pelo front-end é gravada no Supabase imediatamente;
-- 2) cada gravação recebe um event_id idempotente e fica registrada em histórico;
-- 3) company_state continua sendo o snapshot atual usado no carregamento rápido;
-- 4) em caso de F5/reload antes da resposta da nuvem, o front-end preserva o estado
--    local e reenvia automaticamente na próxima abertura.

create extension if not exists pgcrypto;

-- ============================================================
-- HISTÓRICO DE PERSISTÊNCIA
-- ============================================================

create table if not exists public.company_state_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id text not null,
  client_id text,
  reason text,
  state_hash text not null,
  state_size_bytes integer not null default 0,
  applied_version bigint,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique(company_id, event_id)
);

create index if not exists company_state_events_company_created_idx
  on public.company_state_events(company_id, created_at desc);

create index if not exists company_state_events_company_version_idx
  on public.company_state_events(company_id, applied_version desc);

alter table public.company_state_events enable row level security;

-- O histórico é escrito somente pela RPC SECURITY DEFINER.
-- Nenhum usuário comum precisa inserir/alterar/excluir diretamente.
revoke all on table public.company_state_events from public, anon, authenticated;

-- ============================================================
-- RPC DE GRAVAÇÃO DURÁVEL
-- ============================================================

create or replace function public.save_company_state_durable(
  p_state jsonb,
  p_event_id text,
  p_client_id text default null,
  p_reason text default null
)
returns table(
  success boolean,
  new_version bigint,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_event uuid;
  v_existing_version bigint;
  v_new_version bigint;
  v_saved_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sessão não autenticada';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Estado inválido';
  end if;

  if nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'event_id obrigatório';
  end if;

  select p.company_id
    into v_company
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true;

  if v_company is null then
    raise exception 'Usuário sem perfil ativo vinculado à empresa';
  end if;

  -- Serializa gravações por empresa, inclusive o primeiro snapshot, evitando
  -- corrida de INSERT quando dois dispositivos salvam pela primeira vez.
  perform 1
  from public.companies c
  where c.id = v_company
  for update;

  -- Reserva o event_id. Se ele já existir, esta chamada é uma repetição segura
  -- (por exemplo, retry após timeout) e não gera uma segunda alteração.
  insert into public.company_state_events(
    company_id,
    event_id,
    client_id,
    reason,
    state_hash,
    state_size_bytes,
    created_by
  ) values (
    v_company,
    btrim(p_event_id),
    nullif(btrim(coalesce(p_client_id, '')), ''),
    nullif(left(btrim(coalesce(p_reason, '')), 240), ''),
    encode(digest(p_state::text, 'sha256'), 'hex'),
    octet_length(p_state::text),
    auth.uid()
  )
  on conflict (company_id, event_id) do nothing
  returning id into v_event;

  if v_event is null then
    select e.applied_version
      into v_existing_version
    from public.company_state_events e
    where e.company_id = v_company
      and e.event_id = btrim(p_event_id);

    if v_existing_version is null then
      -- Uma transação concorrente com o mesmo event_id ainda não concluiu.
      -- Retorna falha transitória; o cliente pode reenviar com segurança.
      return query
      select false, 0::bigint, now();
      return;
    end if;

    select cs.updated_at
      into v_saved_at
    from public.company_state cs
    where cs.company_id = v_company;

    return query
    select true, v_existing_version, coalesce(v_saved_at, now());
    return;
  end if;

  -- Serializa alterações do snapshot da mesma empresa.
  select cs.version
    into v_existing_version
  from public.company_state cs
  where cs.company_id = v_company
  for update;

  if not found then
    v_new_version := 1;
    v_saved_at := now();

    insert into public.company_state(
      company_id,
      state,
      version,
      updated_at,
      updated_by
    ) values (
      v_company,
      p_state,
      v_new_version,
      v_saved_at,
      auth.uid()
    );
  else
    v_new_version := v_existing_version + 1;
    v_saved_at := now();

    update public.company_state
       set state = p_state,
           version = v_new_version,
           updated_at = v_saved_at,
           updated_by = auth.uid()
     where company_id = v_company;
  end if;

  update public.company_state_events
     set applied_version = v_new_version
   where id = v_event;

  return query
  select true, v_new_version, v_saved_at;
end;
$$;

revoke execute on function public.save_company_state_durable(jsonb, text, text, text)
  from public, anon;

grant execute on function public.save_company_state_durable(jsonb, text, text, text)
  to authenticated;

-- Mantém o snapshot atual acessível somente à empresa do usuário via RLS já
-- criada no 004. Reforça as permissões esperadas sem abrir acesso anônimo.
revoke all on table public.company_state from anon;
revoke insert, update, delete on table public.company_state from authenticated;
grant select on table public.company_state to authenticated;

-- ============================================================
-- VERIFICAÇÃO OPCIONAL APÓS EXECUÇÃO
-- ============================================================
-- select to_regclass('public.company_state') as company_state,
--        to_regclass('public.company_state_events') as company_state_events,
--        to_regprocedure('public.save_company_state_durable(jsonb,text,text,text)') as durable_rpc;
