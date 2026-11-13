-- Combos e doses compostas: um produto vendido dá baixa em vários itens.
-- Cada item pode ser: produto por unidade (copo, gelo, energético), uma dose, ou ml direto de uma garrafa.

create function pg_temp.trocar(p_funcao regprocedure, p_de text, p_para text) returns void language plpgsql as $$
declare v text := pg_get_functiondef(p_funcao);
begin
  if position(p_de in v) = 0 then raise exception 'Trecho não encontrado em %: %', p_funcao, left(p_de, 80); end if;
  execute replace(v, p_de, p_para);
end $$;

alter table public.combo_itens add column ml integer check (ml is null or ml > 0);

select pg_temp.trocar('public._mover_estoque(uuid, integer, text, uuid, text, public.funcionarios)'::regprocedure,
  '    for c in select produto_id, quantidade from public.combo_itens where combo_id = p_produto order by produto_id loop
      perform public._mover_estoque(c.produto_id, p_delta * c.quantidade, p_tipo, p_ref, p_obs, p_eu);
    end loop;',
  '    for c in select produto_id, quantidade, ml from public.combo_itens where combo_id = p_produto order by produto_id loop
      if c.ml is not null then
        perform public._mover_ml(c.produto_id, p_delta * c.quantidade * c.ml, p_tipo, p_ref, p_obs, p_eu);
      else
        perform public._mover_estoque(c.produto_id, p_delta * c.quantidade, p_tipo, p_ref, p_obs, p_eu);
      end if;
    end loop;');

select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  '      insert into public.combo_itens (combo_id, produto_id, quantidade)
      select v_id, (x->>''produto_id'')::uuid, sum((x->>''quantidade'')::integer)
        from jsonb_array_elements(p->''combo'') x
       where (x->>''produto_id'')::uuid <> v_id and (x->>''quantidade'')::integer > 0
       group by 2;',
  '      insert into public.combo_itens (combo_id, produto_id, quantidade, ml)
      select v_id, (x->>''produto_id'')::uuid, sum(greatest(coalesce((x->>''quantidade'')::integer, 1), 1)),
             max(nullif((x->>''ml'')::integer, 0))
        from jsonb_array_elements(p->''combo'') x
       where (x->>''produto_id'')::uuid <> v_id and coalesce((x->>''quantidade'')::integer, 1) > 0
       group by 2;
      if exists (select 1 from public.combo_itens ci join public.produtos pr on pr.id = ci.produto_id
                  where ci.combo_id = v_id and pr.tipo = ''combo'') then
        raise exception ''Um combo não pode ter outro combo dentro. Use os itens dele.'' using errcode = ''P0001'';
      end if;
      if exists (select 1 from public.combo_itens ci where ci.combo_id = v_id and ci.ml is not null
                  and not exists (select 1 from public.garrafas g where g.produto_id = ci.produto_id)) then
        raise exception ''Itens em ml precisam ser garrafas cadastradas em Garrafas.'' using errcode = ''P0001'';
      end if;');
