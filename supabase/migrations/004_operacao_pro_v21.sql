-- Beb's Gestão - Operação Pro v2.1
-- Execute após 003_mega_update_v2.sql.
-- Adiciona persistência centralizada opcional para o front-end com controle otimista
-- de concorrência. O modo local continua disponível para demonstração.

create table if not exists public.company_state (
  company_id uuid primary key references public.companies(id) on delete cascade,
  state jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.company_state enable row level security;

drop policy if exists "company state select own company" on public.company_state;
create policy "company state select own company" on public.company_state
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "company state insert own company" on public.company_state;
create policy "company state insert own company" on public.company_state
  for insert to authenticated
  with check (company_id = public.current_company_id());

drop policy if exists "company state update own company" on public.company_state;
create policy "company state update own company" on public.company_state
  for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

grant select, insert, update on public.company_state to authenticated;

create or replace function public.save_company_state(p_state jsonb, p_expected_version bigint)
returns table(success boolean, new_version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_current bigint;
begin
  select company_id into v_company
  from public.profiles
  where id = auth.uid() and active = true;

  if v_company is null then
    raise exception 'Usuário sem perfil ativo vinculado à empresa';
  end if;

  select version into v_current
  from public.company_state
  where company_id = v_company
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      return query select false, 0::bigint;
      return;
    end if;

    insert into public.company_state(company_id, state, version, updated_at, updated_by)
    values(v_company, p_state, 1, now(), auth.uid());

    return query select true, 1::bigint;
    return;
  end if;

  if v_current <> coalesce(p_expected_version, 0) then
    return query select false, v_current;
    return;
  end if;

  update public.company_state
  set state = p_state,
      version = v_current + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where company_id = v_company;

  return query select true, v_current + 1;
end;
$$;

revoke execute on function public.save_company_state(jsonb, bigint) from public, anon;
grant execute on function public.save_company_state(jsonb, bigint) to authenticated;

create index if not exists company_state_updated_idx on public.company_state(updated_at desc);

-- Segurança adicional da função usada pelas policies.
revoke execute on function public.current_company_id() from public, anon;
grant execute on function public.current_company_id() to authenticated;
