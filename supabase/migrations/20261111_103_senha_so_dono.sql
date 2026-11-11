-- Somente o dono altera senha/login de funcionários. Atendente não troca a própria senha
-- (nem pelo sistema, nem chamando a API do Supabase Auth diretamente).
create function public._proteger_login_funcionario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.encrypted_password is distinct from old.encrypted_password
      or new.email is distinct from old.email
      or new.phone is distinct from old.phone)
     and exists (select 1 from public.funcionarios f where f.id = new.id and f.papel <> 'dono')
     and coalesce(current_setting('bebs.alteracao_pelo_dono', true), '') <> '1' then
    raise exception 'Somente o dono pode alterar senha ou login.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public._proteger_login_funcionario() from public, anon, authenticated;

create trigger proteger_login_funcionario
before update on auth.users
for each row execute function public._proteger_login_funcionario();

create or replace function public.redefinir_senha(p_funcionario uuid, p_senha text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.funcionarios;
begin
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres.' using errcode = 'P0001'; end if;
  select * into v from public.funcionarios where id = p_funcionario;
  if not found then raise exception 'Funcionário não encontrado.' using errcode = 'P0001'; end if;
  perform set_config('bebs.alteracao_pelo_dono', '1', true);
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now()
   where id = p_funcionario;
  if p_funcionario <> v_eu.id then
    delete from auth.sessions where user_id = p_funcionario;
  end if;
  perform public._auditar(v_eu, 'Redefiniu senha', v.nome);
end $$;
