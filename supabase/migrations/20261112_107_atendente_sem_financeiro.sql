-- Atendente sem acesso a vendas nem a dados financeiros.
-- Vendas, pagamentos, totais e histórico de caixa, sangrias e custos: somente o dono.
-- O atendente continua vendendo, abrindo/fechando caixa (fechamento cego) e registrando sangria.

-- Troca um trecho no corpo de uma função; falha se o trecho não existir (evita alteração silenciosa errada).
create function pg_temp.trocar(p_funcao regprocedure, p_de text, p_para text) returns void language plpgsql as $$
declare v text := pg_get_functiondef(p_funcao);
begin
  if position(p_de in v) = 0 then raise exception 'Trecho não encontrado em %: %', p_funcao, left(p_de, 80); end if;
  execute replace(v, p_de, p_para);
end $$;

-- ------------------------------------------------------------------
-- 1) Custo dos produtos em tabela própria, legível só pelo dono
-- ------------------------------------------------------------------
create table public.produto_custos (
  produto_id uuid primary key references public.produtos(id) on delete cascade,
  custo numeric(12,2) not null default 0 check (custo >= 0),
  atualizado_em timestamptz not null default now()
);
insert into public.produto_custos (produto_id, custo) select id, custo from public.produtos where custo > 0;
alter table public.produto_custos enable row level security;
revoke all on table public.produto_custos from anon, public;
revoke insert, update, delete, truncate on table public.produto_custos from authenticated;
grant select on table public.produto_custos to authenticated;
create policy ler_produto_custos on public.produto_custos for select to authenticated using ((select public.sou_dono()));

create function public._custo(p_produto uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select custo from public.produto_custos where produto_id = p_produto), 0);
$$;
revoke execute on function public._custo(uuid) from public, anon, authenticated;

select pg_temp.trocar('public.finalizar_venda(jsonb)'::regprocedure, 'coalesce(v_prod.custo, 0)', 'public._custo(v_prod.id)');
select pg_temp.trocar('public.registrar_consumo(jsonb)'::regprocedure, 'v_prod.preco, v_prod.custo);', 'v_prod.preco, public._custo(v_prod.id));');
select pg_temp.trocar('public.registrar_consumo(jsonb)'::regprocedure, 'v_custo := v_custo + v_prod.custo *', 'v_custo := v_custo + public._custo(v_prod.id) *');
select pg_temp.trocar('public.entrada_estoque(jsonb, text)'::regprocedure,
  'update public.produtos set custo = round((i->>''custo'')::numeric, 2) where id = (i->>''produto_id'')::uuid;',
  'insert into public.produto_custos (produto_id, custo) values ((i->>''produto_id'')::uuid, round((i->>''custo'')::numeric, 2)) on conflict (produto_id) do update set custo = excluded.custo, atualizado_em = now();');
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  'insert into public.produtos (nome, categoria, tipo, preco, custo, estoque_minimo, favorito, ativo, imagem_url)',
  'insert into public.produtos (nome, categoria, tipo, preco, estoque_minimo, favorito, ativo, imagem_url)');
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  'round((p->>''preco'')::numeric, 2), round(coalesce((p->>''custo'')::numeric, 0), 2),
            coalesce((p->>''estoque_minimo'')::integer, 0)',
  'round((p->>''preco'')::numeric, 2),
            coalesce((p->>''estoque_minimo'')::integer, 0)');
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  'preco = round((p->>''preco'')::numeric, 2), custo = round(coalesce((p->>''custo'')::numeric, 0), 2),',
  'preco = round((p->>''preco'')::numeric, 2),');
-- Custo só é gravado quando enviado (vincular código, por exemplo, não mexe no custo).
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  '  if p ? ''codigos'' then',
  '  if p ? ''custo'' then
    insert into public.produto_custos (produto_id, custo) values (v_id, round(greatest(coalesce((p->>''custo'')::numeric, 0), 0), 2))
    on conflict (produto_id) do update set custo = excluded.custo, atualizado_em = now();
  end if;
  if p ? ''codigos'' then');
select pg_temp.trocar('public.importar_legado(boolean)'::regprocedure,
  'insert into public.produtos (nome, categoria, tipo, preco, custo, estoque, estoque_minimo,',
  'insert into public.produtos (nome, categoria, tipo, preco, estoque, estoque_minimo,');
select pg_temp.trocar('public.importar_legado(boolean)'::regprocedure,
  '      round(greatest(coalesce((p->>''cost'')::numeric, 0), 0), 2),
', '');
select pg_temp.trocar('public.importar_legado(boolean)'::regprocedure,
  '    n_prod := n_prod + 1;
',
  '    n_prod := n_prod + 1;
    if coalesce((p->>''cost'')::numeric, 0) > 0 then
      insert into public.produto_custos (produto_id, custo) values (v_id, round((p->>''cost'')::numeric, 2)) on conflict do nothing;
    end if;
');

alter table public.produtos drop column custo;

-- ------------------------------------------------------------------
-- 2) Vendas: somente o dono lê
-- ------------------------------------------------------------------
drop policy ler_vendas on public.vendas;
create policy ler_vendas on public.vendas for select to authenticated using ((select public.sou_dono()));
drop policy ler_venda_itens on public.venda_itens;
create policy ler_venda_itens on public.venda_itens for select to authenticated using ((select public.sou_dono()));
drop policy ler_venda_pagamentos on public.venda_pagamentos;
create policy ler_venda_pagamentos on public.venda_pagamentos for select to authenticated using ((select public.sou_dono()));

-- ------------------------------------------------------------------
-- 3) Caixa: atendente só enxerga que há caixa aberto; totais e histórico só o dono
-- ------------------------------------------------------------------
drop policy ler_caixas on public.caixas;
create policy ler_caixas on public.caixas for select to authenticated
  using ((select public.sou_dono()) or (status = 'aberto' and (select public.sou_ativo())));
drop policy ler_caixa_movimentos on public.caixa_movimentos;
create policy ler_caixa_movimentos on public.caixa_movimentos for select to authenticated using ((select public.sou_dono()));

alter function public.resumo_caixa(uuid) rename to _resumo_caixa;
revoke execute on function public._resumo_caixa(uuid) from public, anon, authenticated;
select pg_temp.trocar('public.movimentar_caixa(text, numeric, text)'::regprocedure, 'public.resumo_caixa(', 'public._resumo_caixa(');
select pg_temp.trocar('public.movimentar_caixa(text, numeric, text)'::regprocedure,
  'raise exception ''Sangria maior que o dinheiro no caixa (R$ %).'', v_disp using errcode = ''P0001'';',
  'if v_eu.papel = ''dono'' then
        raise exception ''Sangria maior que o dinheiro no caixa (R$ %).'', v_disp using errcode = ''P0001'';
      end if;
      raise exception ''Sangria maior que o dinheiro no caixa.'' using errcode = ''P0001'';');
select pg_temp.trocar('public.fechar_caixa(numeric, text)'::regprocedure, 'public.resumo_caixa(', 'public._resumo_caixa(');
-- Fechamento cego: o atendente não vê esperado nem diferença.
select pg_temp.trocar('public.fechar_caixa(numeric, text)'::regprocedure,
  '  return v_res || jsonb_build_object(''diferenca'', round(p_contado, 2) - v_esperado);',
  '  if v_eu.papel <> ''dono'' then return jsonb_build_object(''fechado'', true); end if;
  return v_res || jsonb_build_object(''diferenca'', round(p_contado, 2) - v_esperado);');

create function public.resumo_caixa(p_caixa uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true);
begin
  return public._resumo_caixa(p_caixa);
end $$;
revoke execute on function public.resumo_caixa(uuid) from public, anon;
grant execute on function public.resumo_caixa(uuid) to authenticated;
