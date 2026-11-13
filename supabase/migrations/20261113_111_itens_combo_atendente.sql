-- Funcionários também podem definir o que sai do estoque em cada combo
-- (e transformar um produto existente, como um copão, em combo).
-- Preço, nome, custo e criação de produto continuam só com o dono.

create function public.salvar_itens_combo(p_combo uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(); v public.produtos; v_antes text; v_depois text;
begin
  select * into v from public.produtos where id = p_combo and not arquivado for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
  if v.tipo = 'dose' then raise exception 'Doses são configuradas em Garrafas.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.garrafas where produto_id = p_combo) then
    raise exception 'Este produto é uma garrafa e não pode virar combo.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um item.' using errcode = 'P0001';
  end if;

  select string_agg(coalesce(ci.ml || ' ml de ', ci.quantidade || ' × ') || pr.nome, ' + ' order by pr.nome) into v_antes
    from public.combo_itens ci join public.produtos pr on pr.id = ci.produto_id where ci.combo_id = p_combo;

  delete from public.combo_itens where combo_id = p_combo;
  insert into public.combo_itens (combo_id, produto_id, quantidade, ml)
  select p_combo, (x->>'produto_id')::uuid, sum(greatest(coalesce((x->>'quantidade')::integer, 1), 1)),
         max(nullif((x->>'ml')::integer, 0))
    from jsonb_array_elements(p_itens) x
   where (x->>'produto_id')::uuid <> p_combo and coalesce((x->>'quantidade')::integer, 1) > 0
   group by 2;
  if exists (select 1 from public.combo_itens ci join public.produtos pr on pr.id = ci.produto_id
              where ci.combo_id = p_combo and pr.tipo = 'combo') then
    raise exception 'Um combo não pode ter outro combo dentro. Use os itens dele.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.combo_itens ci where ci.combo_id = p_combo and ci.ml is not null
              and not exists (select 1 from public.garrafas g where g.produto_id = ci.produto_id)) then
    raise exception 'Itens em ml precisam ser garrafas cadastradas em Garrafas.' using errcode = 'P0001';
  end if;

  if v.tipo <> 'combo' then
    update public.produtos set tipo = 'combo', atualizado_em = now() where id = p_combo;
  else
    update public.produtos set atualizado_em = now() where id = p_combo;
  end if;

  select string_agg(coalesce(ci.ml || ' ml de ', ci.quantidade || ' × ') || pr.nome, ' + ' order by pr.nome) into v_depois
    from public.combo_itens ci join public.produtos pr on pr.id = ci.produto_id where ci.combo_id = p_combo;
  perform public._auditar(v_eu, case when v.tipo <> 'combo' then 'Transformou em combo' else 'Alterou itens do combo' end,
    v.nome || ' · ' || coalesce(v_antes, '—') || ' → ' || coalesce(v_depois, '—'));
end $$;

-- Quais produtos são garrafas (para oferecer itens em ml). Sem ml aberto nem estoque: só o necessário.
create function public.garrafas_para_combo() returns table (produto_id uuid, volume_ml integer)
language sql stable security definer set search_path = '' as $$
  select g.produto_id, g.volume_ml from public.garrafas g where public.sou_ativo();
$$;

revoke execute on function public.salvar_itens_combo(uuid, jsonb), public.garrafas_para_combo() from public, anon;
grant execute on function public.salvar_itens_combo(uuid, jsonb), public.garrafas_para_combo() to authenticated;
