-- Autonomia total do dono: corrigir pagamento de venda, reabrir caixa, cancelar sangria/suprimento,
-- restaurar produto excluído. E trava de preço: só o dono vende com preço diferente do cadastrado.

create function pg_temp.trocar(p_funcao regprocedure, p_de text, p_para text) returns void language plpgsql as $$
declare v text := pg_get_functiondef(p_funcao);
begin
  if position(p_de in v) = 0 then raise exception 'Trecho não encontrado em %: %', p_funcao, left(p_de, 80); end if;
  execute replace(v, p_de, p_para);
end $$;

-- ------------------------------------------------------------------
-- Trava de preço na venda (atendente). Se o preço mudou depois que a venda foi feita
-- (venda guardada sem internet), aceita o preço da hora da venda.
-- ------------------------------------------------------------------
select pg_temp.trocar('public.finalizar_venda(jsonb)'::regprocedure,
  '    select * into v_prod from public.produtos where id = nullif(i->>''produto_id'', '''')::uuid for update;
',
  '    select * into v_prod from public.produtos where id = nullif(i->>''produto_id'', '''')::uuid for update;
    if v_eu.papel <> ''dono'' and v_prod.id is not null
       and round((i->>''preco_unitario'')::numeric, 2) <> v_prod.preco
       and v_prod.atualizado_em <= v_criado then
      raise exception ''Preço de "%" diferente do cadastrado. Somente o dono pode alterar preço na venda.'', v_prod.nome using errcode = ''P0001'';
    end if;
');

-- ------------------------------------------------------------------
-- Corrigir forma de pagamento de uma venda
-- ------------------------------------------------------------------
create function public.alterar_pagamento_venda(p_id uuid, p_pagamentos jsonb, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.vendas; v_pago numeric(12,2); v_antes text; v_depois text;
begin
  select * into v from public.vendas where id = p_id for update;
  if not found then raise exception 'Venda não encontrada.' using errcode = 'P0001'; end if;
  if v.status <> 'concluida' then raise exception 'Venda cancelada não pode ser alterada.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'Informe a forma de pagamento.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_pagamentos) x where x->>'forma' not in ('dinheiro', 'pix', 'debito', 'credito', 'outro')) then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001';
  end if;
  select coalesce(sum(round((x->>'valor')::numeric, 2)), 0) into v_pago from jsonb_array_elements(p_pagamentos) x;
  if abs(v_pago - v.total) > 0.009 then
    raise exception 'Os valores (R$ %) precisam somar o total da venda (R$ %).', v_pago, v.total using errcode = 'P0001';
  end if;
  select string_agg(forma || ' ' || valor, ' + ') into v_antes from public.venda_pagamentos where venda_id = p_id;
  delete from public.venda_pagamentos where venda_id = p_id;
  insert into public.venda_pagamentos (venda_id, forma, valor)
  select p_id, x->>'forma', round((x->>'valor')::numeric, 2) from jsonb_array_elements(p_pagamentos) x
   where round((x->>'valor')::numeric, 2) > 0;
  select string_agg(forma || ' ' || valor, ' + ') into v_depois from public.venda_pagamentos where venda_id = p_id;
  perform public._auditar(v_eu, 'Alterou pagamento', '#' || v.numero || ' · ' || coalesce(v_antes, '—') || ' → ' || coalesce(v_depois, '—')
    || coalesce(' · ' || nullif(btrim(p_motivo), ''), ''));
end $$;

-- ------------------------------------------------------------------
-- Reabrir o último caixa fechado (quando não há caixa aberto)
-- ------------------------------------------------------------------
create function public.reabrir_caixa(p_caixa uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.caixas;
begin
  if exists (select 1 from public.caixas where status = 'aberto') then
    raise exception 'Já existe um caixa aberto. Feche-o antes de reabrir outro.' using errcode = 'P0001';
  end if;
  select * into v from public.caixas where id = p_caixa for update;
  if not found or v.status <> 'fechado' then raise exception 'Caixa não encontrado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.caixas where aberto_em > v.aberto_em) then
    raise exception 'Só é possível reabrir o último caixa.' using errcode = 'P0001';
  end if;
  update public.caixas set status = 'aberto', fechado_em = null, fechado_por = null, fechado_por_nome = null,
         valor_esperado = null, valor_contado = null, diferenca = null where id = p_caixa;
  perform public._auditar(v_eu, 'Reabriu caixa', 'Aberto em ' || to_char(v.aberto_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    || ' · contado antes R$ ' || coalesce(v.valor_contado::text, '—'));
end $$;

-- ------------------------------------------------------------------
-- Cancelar sangria/suprimento (só do caixa aberto)
-- ------------------------------------------------------------------
alter table public.caixa_movimentos add column cancelado boolean not null default false;

select pg_temp.trocar('public._resumo_caixa(uuid)'::regprocedure,
  'm as (select tipo, sum(valor) total from public.caixa_movimentos where caixa_id = p_caixa group by tipo)',
  'm as (select tipo, sum(valor) total from public.caixa_movimentos where caixa_id = p_caixa and not cancelado group by tipo)');

create function public.cancelar_movimento_caixa(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); m public.caixa_movimentos;
begin
  select * into m from public.caixa_movimentos where id = p_id for update;
  if not found then raise exception 'Lançamento não encontrado.' using errcode = 'P0001'; end if;
  if m.cancelado then return; end if;
  if not exists (select 1 from public.caixas where id = m.caixa_id and status = 'aberto') then
    raise exception 'Só dá para cancelar lançamentos do caixa aberto.' using errcode = 'P0001';
  end if;
  update public.caixa_movimentos set cancelado = true where id = p_id;
  perform public._auditar(v_eu, 'Cancelou ' || m.tipo, 'R$ ' || m.valor || ' · ' || m.descricao || ' · lançado por ' || m.criado_por_nome);
end $$;

-- ------------------------------------------------------------------
-- Restaurar produto excluído (os códigos de barras precisam ser cadastrados de novo)
-- ------------------------------------------------------------------
create function public.restaurar_produto(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_nome text;
begin
  update public.produtos set arquivado = false, ativo = true, atualizado_em = now()
   where id = p_id and arquivado returning nome into v_nome;
  if v_nome is null then raise exception 'Produto não encontrado entre os excluídos.' using errcode = 'P0001'; end if;
  perform public._auditar(v_eu, 'Restaurou produto', v_nome);
end $$;

revoke execute on function public.alterar_pagamento_venda(uuid, jsonb, text), public.reabrir_caixa(uuid),
  public.cancelar_movimento_caixa(uuid), public.restaurar_produto(uuid) from public, anon;
grant execute on function public.alterar_pagamento_venda(uuid, jsonb, text), public.reabrir_caixa(uuid),
  public.cancelar_movimento_caixa(uuid), public.restaurar_produto(uuid) to authenticated;
