-- Beb's Gestão 3.0 — banco normalizado.
-- Regras:
--  * cada operação grava só o que mudou, numa transação no servidor;
--  * vendas e consumos têm id gerado no aparelho: reenviar nunca duplica;
--  * escrita SOMENTE por funções (RPC) que conferem o perfil do usuário;
--  * leitura liberada para funcionários ativos (RLS).

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- TABELAS
-- ============================================================

create table public.funcionarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  papel text not null check (papel in ('dono', 'atendente')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  categoria text not null default '',
  tipo text not null default 'unidade' check (tipo in ('unidade', 'combo')),
  preco numeric(12,2) not null default 0 check (preco >= 0),
  custo numeric(12,2) not null default 0 check (custo >= 0),
  estoque integer not null default 0,
  estoque_minimo integer not null default 0 check (estoque_minimo >= 0),
  favorito boolean not null default false,
  ativo boolean not null default true,
  arquivado boolean not null default false,
  sku text,
  legado_id text unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index produtos_nome_idx on public.produtos (lower(nome));

create table public.produto_codigos (
  codigo text primary key check (length(btrim(codigo)) > 0),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  multiplicador integer not null default 1 check (multiplicador > 0),
  descricao text not null default 'Unidade',
  criado_em timestamptz not null default now()
);
create index produto_codigos_produto_idx on public.produto_codigos (produto_id);

create table public.combo_itens (
  combo_id uuid not null references public.produtos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  primary key (combo_id, produto_id)
);
create index combo_itens_produto_idx on public.combo_itens (produto_id);

create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  aberto_em timestamptz not null default now(),
  aberto_por uuid references public.funcionarios(id) on delete set null,
  aberto_por_nome text not null default '',
  valor_abertura numeric(12,2) not null default 0 check (valor_abertura >= 0),
  fechado_em timestamptz,
  fechado_por uuid references public.funcionarios(id) on delete set null,
  fechado_por_nome text,
  valor_esperado numeric(12,2),
  valor_contado numeric(12,2),
  diferenca numeric(12,2),
  observacao text,
  legado_id text unique
);
-- Só pode existir UM caixa aberto na loja (compartilhado por todos os aparelhos).
create unique index caixas_um_aberto on public.caixas ((true)) where status = 'aberto';
create index caixas_aberto_em_idx on public.caixas (aberto_em desc);

create table public.caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria', 'suprimento')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text not null default '',
  criado_em timestamptz not null default now(),
  criado_por uuid references public.funcionarios(id) on delete set null,
  criado_por_nome text not null default '',
  legado_id text unique
);
create index caixa_movimentos_caixa_idx on public.caixa_movimentos (caixa_id);

create sequence public.venda_numero_seq start 1;

create table public.vendas (
  id uuid primary key,
  numero bigint not null unique default nextval('public.venda_numero_seq'),
  criado_em timestamptz not null default now(),
  recebido_em timestamptz not null default now(),
  caixa_id uuid references public.caixas(id) on delete set null,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null default '',
  subtotal numeric(12,2) not null,
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  total numeric(12,2) not null check (total >= 0),
  troco numeric(12,2) not null default 0 check (troco >= 0),
  status text not null default 'concluida' check (status in ('concluida', 'cancelada')),
  cancelada_em timestamptz,
  cancelada_por_nome text,
  motivo_cancelamento text,
  dispositivo text,
  legado_id text unique
);
alter sequence public.venda_numero_seq owned by public.vendas.numero;
create index vendas_criado_em_idx on public.vendas (criado_em desc);
create index vendas_caixa_idx on public.vendas (caixa_id);
create index vendas_funcionario_idx on public.vendas (funcionario_id);

create table public.venda_itens (
  id bigint generated always as identity primary key,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  custo_unitario numeric(12,2) not null default 0,
  total numeric(12,2) not null
);
create index venda_itens_venda_idx on public.venda_itens (venda_id);
create index venda_itens_produto_idx on public.venda_itens (produto_id);

create table public.venda_pagamentos (
  id bigint generated always as identity primary key,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  forma text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito', 'outro')),
  valor numeric(12,2) not null check (valor >= 0)
);
create index venda_pagamentos_venda_idx on public.venda_pagamentos (venda_id);

create table public.consumos (
  id uuid primary key,
  numero bigint generated by default as identity unique,
  criado_em timestamptz not null default now(),
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null,
  registrado_por uuid references public.funcionarios(id) on delete set null,
  registrado_por_nome text not null default '',
  observacao text,
  valor_referencia numeric(12,2) not null default 0,
  custo_total numeric(12,2) not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'cancelado')),
  legado_id text unique
);
create index consumos_criado_em_idx on public.consumos (criado_em desc);
create index consumos_funcionario_idx on public.consumos (funcionario_id);
create index consumos_registrado_por_idx on public.consumos (registrado_por);

create table public.consumo_itens (
  id bigint generated always as identity primary key,
  consumo_id uuid not null references public.consumos(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  quantidade integer not null check (quantidade > 0),
  preco_referencia numeric(12,2) not null default 0,
  custo_unitario numeric(12,2) not null default 0
);
create index consumo_itens_consumo_idx on public.consumo_itens (consumo_id);
create index consumo_itens_produto_idx on public.consumo_itens (produto_id);

create table public.estoque_movimentos (
  id bigint generated always as identity primary key,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('implantacao', 'venda', 'cancelamento_venda', 'consumo',
    'cancelamento_consumo', 'entrada', 'ajuste')),
  quantidade integer not null,
  saldo_apos integer not null,
  referencia_id uuid,
  observacao text,
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null default ''
);
create index estoque_movimentos_produto_idx on public.estoque_movimentos (produto_id, criado_em desc);
create index estoque_movimentos_criado_idx on public.estoque_movimentos (criado_em desc);
create index estoque_movimentos_funcionario_idx on public.estoque_movimentos (funcionario_id);

create table public.auditoria (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  funcionario_id uuid references public.funcionarios(id) on delete set null,
  funcionario_nome text not null default '',
  acao text not null,
  detalhes text not null default ''
);
create index auditoria_criado_idx on public.auditoria (criado_em desc);
create index auditoria_funcionario_idx on public.auditoria (funcionario_id);
create index caixas_aberto_por_idx on public.caixas (aberto_por);
create index caixas_fechado_por_idx on public.caixas (fechado_por);
create index caixa_movimentos_criado_por_idx on public.caixa_movimentos (criado_por);

-- ============================================================
-- SEGURANÇA
-- ============================================================

create function public.sou_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.funcionarios f where f.id = auth.uid() and f.ativo);
$$;

create function public.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.funcionarios f where f.id = auth.uid() and f.ativo and f.papel = 'dono');
$$;

-- Funcionário logado; lança erro se não tiver acesso.
create function public._eu(p_somente_dono boolean default false) returns public.funcionarios
language plpgsql stable security definer set search_path = '' as $$
declare v public.funcionarios;
begin
  select * into v from public.funcionarios f where f.id = auth.uid() and f.ativo;
  if not found then raise exception 'Usuário sem acesso. Entre novamente.' using errcode = 'P0001'; end if;
  if p_somente_dono and v.papel <> 'dono' then
    raise exception 'Somente o dono pode fazer isso.' using errcode = 'P0001';
  end if;
  return v;
end $$;

create function public._auditar(p_eu public.funcionarios, p_acao text, p_detalhes text) returns void
language sql security definer set search_path = '' as $$
  insert into public.auditoria (funcionario_id, funcionario_nome, acao, detalhes)
  values (p_eu.id, p_eu.nome, p_acao, coalesce(p_detalhes, ''));
$$;

-- Movimenta o estoque de um produto (ou dos componentes, se for combo).
create function public._mover_estoque(
  p_produto uuid, p_delta integer, p_tipo text, p_ref uuid, p_obs text, p_eu public.funcionarios
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text;
  v_saldo integer;
  c record;
begin
  if p_delta = 0 then return; end if;
  select tipo into v_tipo from public.produtos where id = p_produto;
  if not found then return; end if;
  if v_tipo = 'combo' then
    for c in select produto_id, quantidade from public.combo_itens where combo_id = p_produto order by produto_id loop
      perform public._mover_estoque(c.produto_id, p_delta * c.quantidade, p_tipo, p_ref, p_obs, p_eu);
    end loop;
    return;
  end if;
  update public.produtos set estoque = estoque + p_delta, atualizado_em = now()
   where id = p_produto returning estoque into v_saldo;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, referencia_id, observacao, funcionario_id, funcionario_nome)
  values (p_produto, p_tipo, p_delta, v_saldo, p_ref, p_obs, p_eu.id, coalesce(p_eu.nome, ''));
end $$;

-- ============================================================
-- VENDA
-- ============================================================
-- p = { id, criado_em, caixa_id, desconto, troco, dispositivo,
--       itens: [{produto_id, nome, quantidade, preco_unitario}],
--       pagamentos: [{forma, valor}] }
create function public.finalizar_venda(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_eu public.funcionarios := public._eu();
  v_id uuid := (p->>'id')::uuid;
  v_existente public.vendas;
  v_criado timestamptz := coalesce((p->>'criado_em')::timestamptz, now());
  v_caixa uuid;
  v_subtotal numeric(12,2) := 0;
  v_desconto numeric(12,2) := round(coalesce((p->>'desconto')::numeric, 0), 2);
  v_total numeric(12,2);
  v_pago numeric(12,2) := 0;
  v_numero bigint;
  i jsonb;
  v_prod public.produtos;
begin
  if v_id is null then raise exception 'Venda sem identificador.' using errcode = 'P0001'; end if;

  -- Reenvio da mesma venda: devolve a já gravada, sem duplicar nada.
  select * into v_existente from public.vendas where id = v_id;
  if found then
    return jsonb_build_object('id', v_existente.id, 'numero', v_existente.numero, 'duplicada', true);
  end if;

  if jsonb_typeof(p->'itens') <> 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'A venda não tem itens.' using errcode = 'P0001';
  end if;
  if v_criado > now() + interval '5 minutes' then v_criado := now(); end if;

  for i in select * from jsonb_array_elements(p->'itens') loop
    if coalesce((i->>'quantidade')::integer, 0) <= 0 or coalesce((i->>'preco_unitario')::numeric, -1) < 0 then
      raise exception 'Item inválido na venda.' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + round((i->>'quantidade')::integer * (i->>'preco_unitario')::numeric, 2);
  end loop;
  if v_desconto < 0 or v_desconto > v_subtotal then
    raise exception 'Desconto inválido.' using errcode = 'P0001';
  end if;
  if v_desconto > 0 and v_eu.papel <> 'dono' then
    raise exception 'Somente o dono pode dar desconto.' using errcode = 'P0001';
  end if;
  v_total := v_subtotal - v_desconto;

  select coalesce(sum(round((x->>'valor')::numeric, 2)), 0) into v_pago
    from jsonb_array_elements(coalesce(p->'pagamentos', '[]'::jsonb)) x;
  if abs(v_pago - v_total) > 0.009 then
    raise exception 'Pagamentos (%) diferentes do total (%).', v_pago, v_total using errcode = 'P0001';
  end if;

  -- Caixa: o informado pelo aparelho (se existir) ou o aberto agora.
  select id into v_caixa from public.caixas where id = nullif(p->>'caixa_id', '')::uuid;
  if v_caixa is null then select id into v_caixa from public.caixas where status = 'aberto'; end if;

  begin
    insert into public.vendas (id, criado_em, caixa_id, funcionario_id, funcionario_nome, subtotal, desconto, total, troco, dispositivo)
    values (v_id, v_criado, v_caixa, v_eu.id, v_eu.nome, v_subtotal, v_desconto, v_total,
            greatest(round(coalesce((p->>'troco')::numeric, 0), 2), 0), left(p->>'dispositivo', 120))
    returning numero into v_numero;
  exception when unique_violation then
    -- Outro envio simultâneo da mesma venda chegou primeiro.
    select * into v_existente from public.vendas where id = v_id;
    return jsonb_build_object('id', v_existente.id, 'numero', v_existente.numero, 'duplicada', true);
  end;

  for i in select * from jsonb_array_elements(p->'itens') order by (value->>'produto_id') loop
    select * into v_prod from public.produtos where id = nullif(i->>'produto_id', '')::uuid for update;
    insert into public.venda_itens (venda_id, produto_id, nome, quantidade, preco_unitario, custo_unitario, total)
    values (v_id, v_prod.id, coalesce(nullif(i->>'nome', ''), v_prod.nome, 'Produto'),
            (i->>'quantidade')::integer, round((i->>'preco_unitario')::numeric, 2), coalesce(v_prod.custo, 0),
            round((i->>'quantidade')::integer * (i->>'preco_unitario')::numeric, 2));
    if v_prod.id is not null then
      perform public._mover_estoque(v_prod.id, -(i->>'quantidade')::integer, 'venda', v_id, 'Venda #' || v_numero, v_eu);
    end if;
  end loop;

  insert into public.venda_pagamentos (venda_id, forma, valor)
  select v_id, x->>'forma', round((x->>'valor')::numeric, 2)
    from jsonb_array_elements(p->'pagamentos') x
   where round((x->>'valor')::numeric, 2) > 0;

  return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', false);
end $$;

create function public.cancelar_venda(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_eu public.funcionarios := public._eu(true);
  v public.vendas;
  i record;
begin
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo.' using errcode = 'P0001'; end if;
  select * into v from public.vendas where id = p_id for update;
  if not found then raise exception 'Venda não encontrada.' using errcode = 'P0001'; end if;
  if v.status = 'cancelada' then return; end if;
  update public.vendas set status = 'cancelada', cancelada_em = now(), cancelada_por_nome = v_eu.nome,
         motivo_cancelamento = btrim(p_motivo) where id = p_id;
  for i in select produto_id, quantidade from public.venda_itens where venda_id = p_id and produto_id is not null order by produto_id loop
    perform public._mover_estoque(i.produto_id, i.quantidade, 'cancelamento_venda', p_id, 'Cancelamento venda #' || v.numero, v_eu);
  end loop;
  perform public._auditar(v_eu, 'Cancelou venda', '#' || v.numero || ' · R$ ' || v.total || ' · ' || btrim(p_motivo));
end $$;

-- ============================================================
-- CAIXA
-- ============================================================

create function public.resumo_caixa(p_caixa uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select * from public.caixas where id = p_caixa),
  v as (select * from public.vendas where caixa_id = p_caixa and status = 'concluida'),
  pg as (select forma, sum(valor) total from public.venda_pagamentos where venda_id in (select id from v) group by forma),
  m as (select tipo, sum(valor) total from public.caixa_movimentos where caixa_id = p_caixa group by tipo)
  select jsonb_build_object(
    'vendas', (select count(*) from v),
    'total_vendas', coalesce((select sum(total) from v), 0),
    'canceladas', (select count(*) from public.vendas where caixa_id = p_caixa and status = 'cancelada'),
    'dinheiro', coalesce((select total from pg where forma = 'dinheiro'), 0),
    'pix', coalesce((select total from pg where forma = 'pix'), 0),
    'debito', coalesce((select total from pg where forma = 'debito'), 0),
    'credito', coalesce((select total from pg where forma = 'credito'), 0),
    'outro', coalesce((select total from pg where forma = 'outro'), 0),
    'sangrias', coalesce((select total from m where tipo = 'sangria'), 0),
    'suprimentos', coalesce((select total from m where tipo = 'suprimento'), 0),
    'dinheiro_esperado', (select valor_abertura from c)
        + coalesce((select total from pg where forma = 'dinheiro'), 0)
        + coalesce((select total from m where tipo = 'suprimento'), 0)
        - coalesce((select total from m where tipo = 'sangria'), 0)
  ) where public.sou_ativo();
$$;

create function public.abrir_caixa(p_valor numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(); v_id uuid;
begin
  if p_valor is null or p_valor < 0 then raise exception 'Valor inicial inválido.' using errcode = 'P0001'; end if;
  begin
    insert into public.caixas (aberto_por, aberto_por_nome, valor_abertura)
    values (v_eu.id, v_eu.nome, round(p_valor, 2)) returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe um caixa aberto.' using errcode = 'P0001';
  end;
  perform public._auditar(v_eu, 'Abriu caixa', 'Valor inicial R$ ' || round(p_valor, 2));
  return v_id;
end $$;

create function public.movimentar_caixa(p_tipo text, p_valor numeric, p_descricao text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_disp numeric;
begin
  if p_tipo not in ('sangria', 'suprimento') then raise exception 'Tipo inválido.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  if p_tipo = 'sangria' then
    v_disp := (public.resumo_caixa(v_caixa)->>'dinheiro_esperado')::numeric;
    if round(p_valor, 2) > v_disp then
      raise exception 'Sangria maior que o dinheiro no caixa (R$ %).', v_disp using errcode = 'P0001';
    end if;
  end if;
  insert into public.caixa_movimentos (caixa_id, tipo, valor, descricao, criado_por, criado_por_nome)
  values (v_caixa, p_tipo, round(p_valor, 2), coalesce(btrim(p_descricao), ''), v_eu.id, v_eu.nome);
  perform public._auditar(v_eu, case p_tipo when 'sangria' then 'Sangria' else 'Suprimento' end,
    'R$ ' || round(p_valor, 2) || ' · ' || coalesce(btrim(p_descricao), ''));
end $$;

create function public.fechar_caixa(p_contado numeric, p_observacao text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_esperado numeric; v_res jsonb;
begin
  if p_contado is null or p_contado < 0 then raise exception 'Valor contado inválido.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  v_res := public.resumo_caixa(v_caixa);
  v_esperado := (v_res->>'dinheiro_esperado')::numeric;
  update public.caixas set status = 'fechado', fechado_em = now(), fechado_por = v_eu.id, fechado_por_nome = v_eu.nome,
         valor_esperado = v_esperado, valor_contado = round(p_contado, 2), diferenca = round(p_contado, 2) - v_esperado,
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = v_caixa;
  perform public._auditar(v_eu, 'Fechou caixa', 'Esperado R$ ' || v_esperado || ' · contado R$ ' || round(p_contado, 2)
    || ' · diferença R$ ' || (round(p_contado, 2) - v_esperado) || ' · ' || (v_res->>'vendas') || ' venda(s)');
  return v_res || jsonb_build_object('diferenca', round(p_contado, 2) - v_esperado);
end $$;

-- ============================================================
-- CONSUMO INTERNO
-- ============================================================
-- p = { id, criado_em, funcionario_id, funcionario_nome, observacao, itens: [{produto_id, nome, quantidade, preco_referencia}] }
create function public.registrar_consumo(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_eu public.funcionarios := public._eu();
  v_id uuid := (p->>'id')::uuid;
  v_numero bigint;
  v_func public.funcionarios;
  v_nome text;
  v_criado timestamptz := coalesce((p->>'criado_em')::timestamptz, now());
  i jsonb;
  v_prod public.produtos;
  v_ref numeric(12,2) := 0;
  v_custo numeric(12,2) := 0;
begin
  if v_id is null then raise exception 'Consumo sem identificador.' using errcode = 'P0001'; end if;
  select numero into v_numero from public.consumos where id = v_id;
  if found then return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', true); end if;
  if jsonb_typeof(p->'itens') <> 'array' or jsonb_array_length(p->'itens') = 0 then
    raise exception 'O consumo não tem itens.' using errcode = 'P0001';
  end if;
  if v_criado > now() + interval '5 minutes' then v_criado := now(); end if;
  select * into v_func from public.funcionarios where id = nullif(p->>'funcionario_id', '')::uuid;
  v_nome := coalesce(v_func.nome, nullif(btrim(p->>'funcionario_nome'), ''));
  if v_nome is null then raise exception 'Informe quem consumiu.' using errcode = 'P0001'; end if;

  begin
    insert into public.consumos (id, criado_em, funcionario_id, funcionario_nome, registrado_por, registrado_por_nome, observacao)
    values (v_id, v_criado, v_func.id, v_nome, v_eu.id, v_eu.nome, nullif(btrim(coalesce(p->>'observacao', '')), ''))
    returning numero into v_numero;
  exception when unique_violation then
    select numero into v_numero from public.consumos where id = v_id;
    return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', true);
  end;

  for i in select * from jsonb_array_elements(p->'itens') order by (value->>'produto_id') loop
    if coalesce((i->>'quantidade')::integer, 0) <= 0 then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;
    select * into v_prod from public.produtos where id = nullif(i->>'produto_id', '')::uuid for update;
    if v_prod.id is null then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
    insert into public.consumo_itens (consumo_id, produto_id, nome, quantidade, preco_referencia, custo_unitario)
    values (v_id, v_prod.id, v_prod.nome, (i->>'quantidade')::integer, v_prod.preco, v_prod.custo);
    v_ref := v_ref + v_prod.preco * (i->>'quantidade')::integer;
    v_custo := v_custo + v_prod.custo * (i->>'quantidade')::integer;
    perform public._mover_estoque(v_prod.id, -(i->>'quantidade')::integer, 'consumo', v_id, 'Consumo #' || v_numero || ' · ' || v_nome, v_eu);
  end loop;
  update public.consumos set valor_referencia = v_ref, custo_total = v_custo where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'duplicada', false);
end $$;

create function public.cancelar_consumo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.consumos; i record;
begin
  select * into v from public.consumos where id = p_id for update;
  if not found then raise exception 'Consumo não encontrado.' using errcode = 'P0001'; end if;
  if v.status = 'cancelado' then return; end if;
  update public.consumos set status = 'cancelado' where id = p_id;
  for i in select produto_id, quantidade from public.consumo_itens where consumo_id = p_id and produto_id is not null order by produto_id loop
    perform public._mover_estoque(i.produto_id, i.quantidade, 'cancelamento_consumo', p_id, 'Cancelamento consumo #' || v.numero, v_eu);
  end loop;
  perform public._auditar(v_eu, 'Cancelou consumo', '#' || v.numero || ' · ' || v.funcionario_nome);
end $$;

-- ============================================================
-- PRODUTOS E ESTOQUE
-- ============================================================
-- p = { id?, nome, categoria, tipo, preco, custo, estoque_minimo, favorito, ativo, estoque_inicial?,
--       codigos: [{codigo, multiplicador, descricao}], combo: [{produto_id, quantidade}] }
create function public.salvar_produto(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_eu public.funcionarios := public._eu(true);
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_antes public.produtos;
  v_novo boolean := v_id is null;
  c jsonb;
  v_dono text;
  v_codigo text;
begin
  if coalesce(btrim(p->>'nome'), '') = '' then raise exception 'Informe o nome do produto.' using errcode = 'P0001'; end if;
  if coalesce((p->>'preco')::numeric, -1) < 0 then raise exception 'Preço inválido.' using errcode = 'P0001'; end if;

  if v_novo then
    insert into public.produtos (nome, categoria, tipo, preco, custo, estoque_minimo, favorito, ativo)
    values (btrim(p->>'nome'), coalesce(btrim(p->>'categoria'), ''), coalesce(nullif(p->>'tipo', ''), 'unidade'),
            round((p->>'preco')::numeric, 2), round(coalesce((p->>'custo')::numeric, 0), 2),
            coalesce((p->>'estoque_minimo')::integer, 0), coalesce((p->>'favorito')::boolean, false),
            coalesce((p->>'ativo')::boolean, true))
    returning id into v_id;
  else
    select * into v_antes from public.produtos where id = v_id for update;
    if not found then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
    update public.produtos set
      nome = btrim(p->>'nome'), categoria = coalesce(btrim(p->>'categoria'), ''),
      tipo = coalesce(nullif(p->>'tipo', ''), 'unidade'),
      preco = round((p->>'preco')::numeric, 2), custo = round(coalesce((p->>'custo')::numeric, 0), 2),
      estoque_minimo = coalesce((p->>'estoque_minimo')::integer, 0),
      favorito = coalesce((p->>'favorito')::boolean, false), ativo = coalesce((p->>'ativo')::boolean, true),
      atualizado_em = now()
    where id = v_id;
    if v_antes.preco <> round((p->>'preco')::numeric, 2) then
      perform public._auditar(v_eu, 'Alterou preço', v_antes.nome || ' · R$ ' || v_antes.preco || ' → R$ ' || round((p->>'preco')::numeric, 2));
    end if;
  end if;

  -- Códigos de barras: a lista enviada substitui a anterior.
  if p ? 'codigos' then
    delete from public.produto_codigos where produto_id = v_id
      and codigo not in (select btrim(x->>'codigo') from jsonb_array_elements(p->'codigos') x);
    for c in select * from jsonb_array_elements(p->'codigos') loop
      v_codigo := btrim(c->>'codigo');
      if v_codigo = '' then continue; end if;
      select pr.nome into v_dono from public.produto_codigos pc join public.produtos pr on pr.id = pc.produto_id
       where pc.codigo = v_codigo and pc.produto_id <> v_id;
      if found then raise exception 'O código % já está no produto "%".', v_codigo, v_dono using errcode = 'P0001'; end if;
      insert into public.produto_codigos (codigo, produto_id, multiplicador, descricao)
      values (v_codigo, v_id, greatest(coalesce((c->>'multiplicador')::integer, 1), 1), coalesce(nullif(btrim(c->>'descricao'), ''), 'Unidade'))
      on conflict (codigo) do update set multiplicador = excluded.multiplicador, descricao = excluded.descricao;
    end loop;
  end if;

  if p ? 'combo' then
    delete from public.combo_itens where combo_id = v_id;
    if coalesce(p->>'tipo', 'unidade') = 'combo' then
      insert into public.combo_itens (combo_id, produto_id, quantidade)
      select v_id, (x->>'produto_id')::uuid, sum((x->>'quantidade')::integer)
        from jsonb_array_elements(p->'combo') x
       where (x->>'produto_id')::uuid <> v_id and (x->>'quantidade')::integer > 0
       group by 2;
    end if;
  end if;

  if v_novo then
    if coalesce((p->>'estoque_inicial')::integer, 0) <> 0 and coalesce(p->>'tipo', 'unidade') <> 'combo' then
      perform public._mover_estoque(v_id, (p->>'estoque_inicial')::integer, 'implantacao', null, 'Estoque inicial', v_eu);
    end if;
    perform public._auditar(v_eu, 'Cadastrou produto', btrim(p->>'nome') || ' · R$ ' || round((p->>'preco')::numeric, 2));
  end if;
  return v_id;
end $$;

create function public.arquivar_produto(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_nome text;
begin
  update public.produtos set arquivado = true, ativo = false, favorito = false, atualizado_em = now()
   where id = p_id returning nome into v_nome;
  if v_nome is null then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
  delete from public.produto_codigos where produto_id = p_id;
  perform public._auditar(v_eu, 'Excluiu produto', v_nome);
end $$;

-- Entrada de mercadoria. itens = [{produto_id, quantidade, custo?}]
create function public.entrada_estoque(p_itens jsonb, p_observacao text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(); i jsonb; v_ref uuid := gen_random_uuid(); v_n integer := 0;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item na entrada.' using errcode = 'P0001';
  end if;
  for i in select * from jsonb_array_elements(p_itens) order by (value->>'produto_id') loop
    if coalesce((i->>'quantidade')::integer, 0) <= 0 then raise exception 'Quantidade inválida.' using errcode = 'P0001'; end if;
    if not exists (select 1 from public.produtos where id = (i->>'produto_id')::uuid and tipo = 'unidade') then
      raise exception 'Produto inválido para entrada.' using errcode = 'P0001';
    end if;
    if v_eu.papel = 'dono' and coalesce((i->>'custo')::numeric, 0) > 0 then
      update public.produtos set custo = round((i->>'custo')::numeric, 2) where id = (i->>'produto_id')::uuid;
    end if;
    perform public._mover_estoque((i->>'produto_id')::uuid, (i->>'quantidade')::integer, 'entrada', v_ref,
      nullif(btrim(coalesce(p_observacao, '')), ''), v_eu);
    v_n := v_n + (i->>'quantidade')::integer;
  end loop;
  perform public._auditar(v_eu, 'Entrada de mercadoria', v_n || ' unidade(s) · ' || coalesce(p_observacao, ''));
end $$;

-- Ajuste / inventário: define o saldo contado.
create function public.ajustar_estoque(p_produto uuid, p_novo_saldo integer, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.produtos;
begin
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do ajuste.' using errcode = 'P0001'; end if;
  select * into v from public.produtos where id = p_produto and tipo = 'unidade' for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
  perform public._mover_estoque(p_produto, p_novo_saldo - v.estoque, 'ajuste', null, btrim(p_motivo), v_eu);
  perform public._auditar(v_eu, 'Ajustou estoque', v.nome || ' · ' || v.estoque || ' → ' || p_novo_saldo || ' · ' || btrim(p_motivo));
end $$;

-- ============================================================
-- RELATÓRIO (somente dono)
-- ============================================================
create function public.relatorio(p_inicio date, p_fim date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_eu public.funcionarios := public._eu(true);
  v_ini timestamptz := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  v_fim timestamptz := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');
begin
  return (
    with v as (select * from public.vendas where criado_em >= v_ini and criado_em < v_fim),
    ok as (select * from v where status = 'concluida'),
    it as (select i.* from public.venda_itens i join ok on ok.id = i.venda_id),
    pg as (select p.* from public.venda_pagamentos p join ok on ok.id = p.venda_id),
    co as (select * from public.consumos where criado_em >= v_ini and criado_em < v_fim and status = 'ativo')
    select jsonb_build_object(
      'vendas', (select count(*) from ok),
      'faturamento', coalesce((select sum(total) from ok), 0),
      'descontos', coalesce((select sum(desconto) from ok), 0),
      'canceladas', (select count(*) from v where status = 'cancelada'),
      'valor_cancelado', coalesce((select sum(total) from v where status = 'cancelada'), 0),
      'itens', coalesce((select sum(quantidade) from it), 0),
      'custo', coalesce((select sum(custo_unitario * quantidade) from it), 0),
      'itens_sem_custo', coalesce((select sum(quantidade) from it where custo_unitario = 0), 0),
      'formas', coalesce((select jsonb_object_agg(forma, total) from (select forma, sum(valor) total from pg group by forma) f), '{}'::jsonb),
      'por_dia', coalesce((select jsonb_agg(d order by d.dia) from (
          select (ok.criado_em at time zone 'America/Sao_Paulo')::date dia, count(*) vendas, sum(total) total,
                 coalesce(sum(desconto), 0) descontos
            from ok group by 1) d), '[]'::jsonb),
      'por_dia_forma', coalesce((select jsonb_agg(d) from (
          select (ok.criado_em at time zone 'America/Sao_Paulo')::date dia, p.forma, sum(p.valor) total
            from ok join public.venda_pagamentos p on p.venda_id = ok.id group by 1, 2) d), '[]'::jsonb),
      'por_hora', coalesce((select jsonb_agg(d order by d.hora) from (
          select extract(hour from ok.criado_em at time zone 'America/Sao_Paulo')::int hora, count(*) vendas, sum(total) total
            from ok group by 1) d), '[]'::jsonb),
      'produtos', coalesce((select jsonb_agg(d order by d.total desc) from (
          select coalesce(it.produto_id::text, it.nome) chave, max(it.nome) nome, sum(it.quantidade) quantidade,
                 sum(it.total) total, sum(it.custo_unitario * it.quantidade) custo
            from it group by 1) d), '[]'::jsonb),
      'funcionarios', coalesce((select jsonb_agg(d order by d.total desc) from (
          select funcionario_nome nome, count(*) vendas, sum(total) total from ok group by 1) d), '[]'::jsonb),
      'consumos', (select count(*) from co),
      'consumo_valor', coalesce((select sum(valor_referencia) from co), 0),
      'consumo_por_funcionario', coalesce((select jsonb_agg(d order by d.valor desc) from (
          select funcionario_nome nome, count(*) consumos, sum(valor_referencia) valor from co group by 1) d), '[]'::jsonb)
    )
  );
end $$;

-- ============================================================
-- PERMISSÕES
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['funcionarios','produtos','produto_codigos','combo_itens','caixas','caixa_movimentos',
    'vendas','venda_itens','venda_pagamentos','consumos','consumo_itens','estoque_movimentos','auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.sou_ativo()))', 'ler_' || t, t);
  end loop;
end $$;

-- Auditoria e movimentos de estoque: só o dono lê.
drop policy ler_auditoria on public.auditoria;
create policy ler_auditoria on public.auditoria for select to authenticated using ((select public.sou_dono()));
drop policy ler_estoque_movimentos on public.estoque_movimentos;
create policy ler_estoque_movimentos on public.estoque_movimentos for select to authenticated using ((select public.sou_dono()));

revoke all on sequence public.venda_numero_seq from anon, authenticated, public;

-- Funções internas: ninguém chama direto pela API.
revoke execute on function public._eu(boolean), public._auditar(public.funcionarios, text, text),
  public._mover_estoque(uuid, integer, text, uuid, text, public.funcionarios)
  from public, anon, authenticated;

-- Funções da API: somente usuários logados (cada uma confere o perfil).
do $$
declare f text;
begin
  foreach f in array array[
    'sou_ativo()', 'sou_dono()', 'finalizar_venda(jsonb)', 'cancelar_venda(uuid, text)', 'resumo_caixa(uuid)',
    'abrir_caixa(numeric)', 'movimentar_caixa(text, numeric, text)', 'fechar_caixa(numeric, text)',
    'registrar_consumo(jsonb)', 'cancelar_consumo(uuid)', 'salvar_produto(jsonb)', 'arquivar_produto(uuid)',
    'entrada_estoque(jsonb, text)', 'ajustar_estoque(uuid, integer, text)', 'relatorio(date, date)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Tempo real: todos os aparelhos recebem as mudanças.
alter publication supabase_realtime add table public.produtos, public.produto_codigos, public.combo_itens,
  public.caixas, public.caixa_movimentos, public.vendas, public.consumos, public.funcionarios;
