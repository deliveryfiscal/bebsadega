-- Beb's v2.1.8 — concorrência otimista, sem alteração de dados existentes.
-- Migracao aditiva: mantem a RPC anterior enquanto clientes antigos finalizam.
create or replace function public.save_company_state_guarded(
  p_state jsonb,
  p_event_id text,
  p_expected_version bigint,
  p_client_id text default null,
  p_reason text default null
)
returns table(success boolean, new_version bigint, saved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_event_id text;
  v_existing_event public.company_state_events%rowtype;
  v_actual bigint;
  v_saved_at timestamptz;
  v_next bigint;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao autenticada';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Estado invalido';
  end if;
  if octet_length(p_state::text) > 8388608 then
    raise exception 'Estado excede 8MB';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'Versao esperada invalida';
  end if;
  v_event_id := nullif(btrim(coalesce(p_event_id, '')), '');
  if v_event_id is null or length(v_event_id) > 200 then
    raise exception 'event_id invalido';
  end if;
  v_hash := md5(p_state::text);

  select p.company_id into v_company
    from public.profiles p
    where p.id = auth.uid() and p.active is true
    limit 1;
  if v_company is null then
    raise exception 'Perfil ativo sem empresa';
  end if;

  -- Exclusao mutua para todas as gravacoes que usam esta RPC.
  perform 1 from public.companies c where c.id = v_company for update;
  if not found then raise exception 'Empresa inexistente'; end if;

  -- Idempotencia: retries de um mesmo evento devem responder sem regravar.
  select e.* into v_existing_event
    from public.company_state_events e
    where e.company_id = v_company and e.event_id = v_event_id;
  if found then
    if v_existing_event.state_hash <> v_hash then
      raise exception 'Mesmo evento com conteudo diferente';
    end if;
    if v_existing_event.applied_version is not null then
      select cs.updated_at into v_saved_at from public.company_state cs
        where cs.company_id = v_company;
      return query select true, v_existing_event.applied_version, coalesce(v_saved_at, now());
      return;
    end if;
    return query select false, -1::bigint, now();
    return;
  end if;

  select cs.version, cs.updated_at
    into v_actual, v_saved_at
    from public.company_state cs where cs.company_id = v_company for update;
  v_actual := coalesce(v_actual, 0);

  -- Protecao contra dois navegadores editarem o mesmo snapshot.
  if v_actual <> p_expected_version then
    return query select false, v_actual, coalesce(v_saved_at, now());
    return;
  end if;

  v_next := v_actual + 1;
  v_saved_at := now();

  insert into public.company_state_events(
    company_id, event_id, client_id, reason, state_hash,
    state_size_bytes, applied_version, created_by
  ) values (
    v_company, v_event_id,
    nullif(left(btrim(coalesce(p_client_id, '')), 200), ''),
    nullif(left(btrim(coalesce(p_reason, '')), 240), ''),
    v_hash, octet_length(p_state::text), v_next, auth.uid()
  );

  insert into public.company_state(company_id, state, version, updated_at, updated_by)
  values(v_company, p_state, v_next, v_saved_at, auth.uid())
  on conflict (company_id) do update
    set state = excluded.state,
        version = excluded.version,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  return query select true, v_next, v_saved_at;
end;
$$;

revoke all on function public.save_company_state_guarded(jsonb, text, bigint, text, text)
  from public, anon;
grant execute on function public.save_company_state_guarded(jsonb, text, bigint, text, text)
  to authenticated;

comment on function public.save_company_state_guarded(jsonb, text, bigint, text, text)
  is 'CAS da versao do snapshot; rejeita gravacoes desatualizadas sem sobrescrever o estado.';