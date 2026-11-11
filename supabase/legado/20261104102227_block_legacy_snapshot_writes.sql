-- Apply after the production client starts sending bebs-sync-v2 event IDs.
create function public.require_bebs_sync_v2()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if left(new.event_id, length('bebs-sync-v2:')) is distinct from 'bebs-sync-v2:'
     or new.reason in ('Recuperação automática após recarregar', 'Reenvio após reconexão') then
    raise exception 'Versão antiga do sistema. Preserve o backup local e atualize a página.';
  end if;
  return new;
end;
$$;

revoke execute on function public.require_bebs_sync_v2() from public, anon, authenticated;

create trigger require_bebs_sync_v2
before insert on public.company_state_events
for each row execute function public.require_bebs_sync_v2();

revoke insert, update, delete, truncate on public.company_state, public.company_state_events
  from public, anon, authenticated;
revoke execute on function public.save_company_state(jsonb, bigint)
  from public, anon, authenticated;
