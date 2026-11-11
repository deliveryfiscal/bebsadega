-- Beb's Gestão 3.0 — logins individuais.
-- Login = usuário + senha. Internamente o Supabase Auth usa <usuario>@bebs.local.
-- O dono cria atendentes, troca senhas e desativa acessos pelo próprio sistema.

create function public._criar_login(p_usuario text, p_senha text, p_nome text, p_papel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_usuario text := lower(btrim(p_usuario));
  v_email text := lower(btrim(p_usuario)) || '@bebs.local';
begin
  if v_usuario !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Usuário deve ter de 3 a 30 letras minúsculas, números, ponto, traço ou sublinhado (sem espaço e sem acento).' using errcode = 'P0001';
  end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres.' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'Informe o nome.' using errcode = 'P0001'; end if;
  if p_papel not in ('dono', 'atendente') then raise exception 'Perfil inválido.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.funcionarios where usuario = v_usuario) or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Já existe alguém com o usuário "%".', v_usuario using errcode = 'P0001';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nome', btrim(p_nome)), now(), now(),
    '', '', '', '', '', '', '', '', false, false);

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    now(), now(), now());

  insert into public.funcionarios (id, nome, usuario, papel) values (v_id, btrim(p_nome), v_usuario, p_papel);
  return v_id;
end $$;
revoke execute on function public._criar_login(text, text, text, text) from public, anon, authenticated;

create function public.criar_funcionario(p_nome text, p_usuario text, p_senha text, p_papel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_id uuid;
begin
  v_id := public._criar_login(p_usuario, p_senha, p_nome, coalesce(p_papel, 'atendente'));
  perform public._auditar(v_eu, 'Criou acesso', btrim(p_nome) || ' (' || lower(btrim(p_usuario)) || ') · ' || coalesce(p_papel, 'atendente'));
  return v_id;
end $$;

create function public.redefinir_senha(p_funcionario uuid, p_senha text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.funcionarios;
begin
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres.' using errcode = 'P0001'; end if;
  select * into v from public.funcionarios where id = p_funcionario;
  if not found then raise exception 'Funcionário não encontrado.' using errcode = 'P0001'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now()
   where id = p_funcionario;
  if p_funcionario <> v_eu.id then
    delete from auth.sessions where user_id = p_funcionario;
  end if;
  perform public._auditar(v_eu, 'Redefiniu senha', v.nome);
end $$;

create function public.definir_acesso(p_funcionario uuid, p_ativo boolean, p_papel text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.funcionarios;
begin
  select * into v from public.funcionarios where id = p_funcionario for update;
  if not found then raise exception 'Funcionário não encontrado.' using errcode = 'P0001'; end if;
  if p_funcionario = v_eu.id and (not p_ativo or p_papel <> 'dono') then
    raise exception 'Você não pode remover o seu próprio acesso de dono.' using errcode = 'P0001';
  end if;
  if p_papel not in ('dono', 'atendente') then raise exception 'Perfil inválido.' using errcode = 'P0001'; end if;
  update public.funcionarios set ativo = p_ativo, papel = p_papel where id = p_funcionario;
  if not p_ativo then delete from auth.sessions where user_id = p_funcionario; end if;
  perform public._auditar(v_eu, case when p_ativo then 'Alterou acesso' else 'Bloqueou acesso' end, v.nome || ' · ' || p_papel);
end $$;

revoke execute on function public.criar_funcionario(text, text, text, text), public.redefinir_senha(uuid, text),
  public.definir_acesso(uuid, boolean, text) from public, anon;
grant execute on function public.criar_funcionario(text, text, text, text), public.redefinir_senha(uuid, text),
  public.definir_acesso(uuid, boolean, text) to authenticated;
