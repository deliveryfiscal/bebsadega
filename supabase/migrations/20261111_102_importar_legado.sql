-- Beb's Gestão 3.0 — importação do sistema antigo (public.company_state).
-- Traz produtos, códigos de barras, estoque, combos, vendas (com itens e pagamentos),
-- consumos internos e caixas (com sangrias/suprimentos).
--
-- Pode rodar mais de uma vez: registros já importados são ignorados (legado_id).
-- select public.importar_legado();          -- acrescenta o que faltar
-- select public.importar_legado(true);      -- apaga os dados do sistema novo e importa do zero
--                                           -- (recusado se já houver vendas feitas no sistema novo)

create function public.importar_legado(p_recomecar boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s jsonb;
  p jsonb;
  b jsonb;
  c jsonb;
  m jsonb;
  it jsonb;
  pg jsonb;
  v_id uuid;
  v_caixa uuid;
  v_numero bigint;
  v_status text;
  n_prod int := 0; n_cod int := 0; n_combo int := 0; n_venda int := 0; n_item int := 0;
  n_pag int := 0; n_caixa int := 0; n_mov int := 0; n_cons int := 0;
begin
  select state into s from public.company_state limit 1;
  if s is null then raise exception 'Estado antigo não encontrado.'; end if;

  if p_recomecar then
    if exists (select 1 from public.vendas where legado_id is null) or exists (select 1 from public.consumos where legado_id is null) then
      raise exception 'Já existem vendas/consumos feitos no sistema novo. Importação do zero recusada para não apagar dados.';
    end if;
    truncate public.venda_pagamentos, public.venda_itens, public.vendas, public.consumo_itens, public.consumos,
             public.caixa_movimentos, public.caixas, public.estoque_movimentos, public.combo_itens,
             public.produto_codigos, public.produtos, public.auditoria;
    alter sequence public.venda_numero_seq restart with 1;
  end if;

  -- PRODUTOS ---------------------------------------------------------------
  for p in select * from jsonb_array_elements(s->'products') loop
    insert into public.produtos (nome, categoria, tipo, preco, custo, estoque, estoque_minimo, favorito, ativo, arquivado,
                                 sku, legado_id, criado_em, atualizado_em)
    values (
      btrim(p->>'name'),
      coalesce(btrim(p->>'category'), ''),
      case when p->>'kind' = 'combo' then 'combo' else 'unidade' end,
      round(coalesce((p->>'price')::numeric, 0), 2),
      round(greatest(coalesce((p->>'cost')::numeric, 0), 0), 2),
      case when p->>'kind' = 'combo' then 0 else round(coalesce((p->>'stock')::numeric, 0))::int end,
      greatest(round(coalesce((p->>'minStock')::numeric, 0))::int, 0),
      coalesce((p->>'favorite')::boolean, false) and p->>'deletedAt' is null,
      coalesce((p->>'active')::boolean, true) and p->>'deletedAt' is null,
      p->>'deletedAt' is not null,
      nullif(p->>'sku', ''),
      p->>'id',
      coalesce((p->>'createdAt')::timestamptz, now()),
      coalesce((p->>'updatedAt')::timestamptz, now())
    )
    on conflict (legado_id) do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    n_prod := n_prod + 1;

    if p->>'kind' <> 'combo' and round(coalesce((p->>'stock')::numeric, 0)) <> 0 then
      insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, observacao, funcionario_nome)
      values (v_id, 'implantacao', round((p->>'stock')::numeric)::int, round((p->>'stock')::numeric)::int,
              'Saldo importado do sistema antigo', 'Importação');
    end if;

    if p->>'deletedAt' is null then
      for b in select * from jsonb_array_elements(coalesce(p->'barcodes', '[]'::jsonb)) loop
        if coalesce(btrim(b->>'code'), '') = '' then continue; end if;
        insert into public.produto_codigos (codigo, produto_id, multiplicador, descricao, criado_em)
        values (btrim(b->>'code'), v_id, greatest(coalesce((b->>'multiplier')::int, 1), 1),
                coalesce(nullif(btrim(b->>'label'), ''), 'Unidade'), coalesce((b->>'createdAt')::timestamptz, now()))
        on conflict (codigo) do nothing;
        if found then n_cod := n_cod + 1; end if;
      end loop;
      if coalesce(btrim(p->>'barcode'), '') <> '' then
        insert into public.produto_codigos (codigo, produto_id) values (btrim(p->>'barcode'), v_id)
        on conflict (codigo) do nothing;
        if found then n_cod := n_cod + 1; end if;
      end if;
    end if;
  end loop;

  -- COMBOS (depois que todos os produtos existem)
  for p in select * from jsonb_array_elements(s->'products') where value->>'kind' = 'combo' loop
    for c in select * from jsonb_array_elements(coalesce(p->'comboItems', '[]'::jsonb)) loop
      if coalesce((c->>'quantity')::numeric, 0) <= 0 then continue; end if;
      insert into public.combo_itens (combo_id, produto_id, quantidade)
      select a.id, b2.id, round((c->>'quantity')::numeric)::int
        from public.produtos a, public.produtos b2
       where a.legado_id = p->>'id' and b2.legado_id = c->>'productId' and a.id <> b2.id
      on conflict do nothing;
      if found then n_combo := n_combo + 1; end if;
    end loop;
  end loop;

  -- CAIXAS -----------------------------------------------------------------
  for c in select * from jsonb_array_elements(coalesce(s->'cashHistory', '[]'::jsonb) ||
             case when jsonb_typeof(s->'cashSession') = 'object' then jsonb_build_array(s->'cashSession') else '[]'::jsonb end) loop
    v_status := case when c->>'status' = 'open' and not exists (select 1 from public.caixas where status = 'aberto') then 'aberto' else 'fechado' end;
    insert into public.caixas (status, aberto_em, aberto_por_nome, valor_abertura, fechado_em, fechado_por_nome,
                               valor_esperado, valor_contado, diferenca, legado_id)
    values (v_status, (c->>'openedAt')::timestamptz, coalesce(c->>'operator', ''), round(coalesce((c->>'openingAmount')::numeric, 0), 2),
            case when v_status = 'fechado' then coalesce((c->>'closedAt')::timestamptz, (c->>'openedAt')::timestamptz) end,
            case when v_status = 'fechado' then coalesce(c->>'operator', '') end,
            round((c->>'expectedAtClose')::numeric, 2), round((c->>'closingAmount')::numeric, 2), round((c->>'difference')::numeric, 2),
            c->>'id')
    on conflict do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    n_caixa := n_caixa + 1;
    for m in select * from jsonb_array_elements(coalesce(c->'movements', '[]'::jsonb)) where value->>'type' in ('withdrawal', 'supply') loop
      insert into public.caixa_movimentos (caixa_id, tipo, valor, descricao, criado_em, criado_por_nome, legado_id)
      values (v_id, case m->>'type' when 'withdrawal' then 'sangria' else 'suprimento' end,
              round((m->>'amount')::numeric, 2), coalesce(m->>'description', ''), (m->>'createdAt')::timestamptz,
              coalesce(m->>'operator', ''), m->>'id')
      on conflict do nothing;
      if found then n_mov := n_mov + 1; end if;
    end loop;
  end loop;

  -- VENDAS -----------------------------------------------------------------
  for p in select * from jsonb_array_elements(s->'sales') order by (value->>'number')::bigint loop
    select id into v_caixa from public.caixas where legado_id = p->>'cashSessionId';
    if v_caixa is null then
      select id into v_caixa from public.caixas
       where aberto_em <= (p->>'createdAt')::timestamptz
         and coalesce(fechado_em, 'infinity') >= (p->>'createdAt')::timestamptz
       order by aberto_em desc limit 1;
    end if;
    v_numero := (p->>'number')::bigint;
    if exists (select 1 from public.vendas where numero = v_numero) then v_numero := nextval('public.venda_numero_seq'); end if;

    insert into public.vendas (id, numero, criado_em, recebido_em, caixa_id, funcionario_nome, subtotal, desconto, total, status,
                               cancelada_em, motivo_cancelamento, dispositivo, legado_id)
    values (gen_random_uuid(), v_numero, (p->>'createdAt')::timestamptz, (p->>'createdAt')::timestamptz, v_caixa,
            coalesce(p->>'operator', ''), round((p->>'subtotal')::numeric, 2), round(coalesce((p->>'discount')::numeric, 0), 2),
            round((p->>'total')::numeric, 2), case when p->>'status' = 'completed' then 'concluida' else 'cancelada' end,
            (p->>'cancelledAt')::timestamptz, p->>'cancelReason', 'Sistema antigo', p->>'id')
    on conflict (legado_id) do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    n_venda := n_venda + 1;

    for it in select * from jsonb_array_elements(p->'items') loop
      insert into public.venda_itens (venda_id, produto_id, nome, quantidade, preco_unitario, custo_unitario, total)
      values (v_id, (select id from public.produtos where legado_id = it->>'productId'), coalesce(it->>'name', 'Produto'),
              greatest(round((it->>'quantity')::numeric)::int, 1), round((it->>'unitPrice')::numeric, 2),
              round(coalesce((it->>'unitCost')::numeric, 0), 2),
              round((it->>'quantity')::numeric * (it->>'unitPrice')::numeric, 2));
      n_item := n_item + 1;
    end loop;
    for pg in select * from jsonb_array_elements(p->'payments') loop
      insert into public.venda_pagamentos (venda_id, forma, valor)
      values (v_id, case pg->>'method' when 'Dinheiro' then 'dinheiro' when 'PIX' then 'pix' when 'Débito' then 'debito'
                                        when 'Crédito' then 'credito' else 'outro' end,
              round((pg->>'amount')::numeric, 2));
      n_pag := n_pag + 1;
    end loop;
  end loop;

  -- CONSUMOS ---------------------------------------------------------------
  for p in select * from jsonb_array_elements(coalesce(s->'consumptions', '[]'::jsonb)) loop
    insert into public.consumos (id, criado_em, funcionario_id, funcionario_nome, registrado_por_nome, observacao,
                                 valor_referencia, custo_total, status, legado_id)
    values (gen_random_uuid(), (p->>'createdAt')::timestamptz,
            (select f.id from public.funcionarios f where lower(f.nome) = lower(btrim(p->>'employeeName')) limit 1),
            coalesce(p->>'employeeName', 'Funcionário'), coalesce(p->>'operator', ''), p->>'note',
            round(coalesce((p->>'saleEquivalent')::numeric, 0), 2), round(coalesce((p->>'totalCost')::numeric, 0), 2),
            case when p->>'status' = 'active' then 'ativo' else 'cancelado' end, p->>'id')
    on conflict (legado_id) do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    n_cons := n_cons + 1;
    for it in select * from jsonb_array_elements(p->'items') loop
      insert into public.consumo_itens (consumo_id, produto_id, nome, quantidade, preco_referencia, custo_unitario)
      values (v_id, (select id from public.produtos where legado_id = it->>'productId'), coalesce(it->>'name', 'Produto'),
              greatest(round((it->>'quantity')::numeric)::int, 1), round(coalesce((it->>'unitPriceReference')::numeric, 0), 2),
              round(coalesce((it->>'unitCost')::numeric, 0), 2));
    end loop;
  end loop;

  perform setval('public.venda_numero_seq', greatest((select coalesce(max(numero), 0) from public.vendas), 1));

  return jsonb_build_object('produtos', n_prod, 'codigos', n_cod, 'combos', n_combo, 'caixas', n_caixa,
    'movimentos_caixa', n_mov, 'vendas', n_venda, 'itens_venda', n_item, 'pagamentos', n_pag, 'consumos', n_cons);
end $$;

revoke execute on function public.importar_legado(boolean) from public, anon, authenticated;
