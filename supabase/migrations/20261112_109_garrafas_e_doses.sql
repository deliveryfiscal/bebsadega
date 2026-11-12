-- Garrafas e doses (controle visível só para o dono).
-- Garrafa: produto com volume (ml). Estoque = garrafas fechadas; ml_aberto = o que resta na garrafa aberta.
-- Dose: produto tipo 'dose' ligado a uma garrafa. Vender dose tira dose_ml da garrafa aberta;
-- só abre uma garrafa nova (estoque - 1) quando o que sobrou não dá para a dose.

create function pg_temp.trocar(p_funcao regprocedure, p_de text, p_para text) returns void language plpgsql as $$
declare v text := pg_get_functiondef(p_funcao);
begin
  if position(p_de in v) = 0 then raise exception 'Trecho não encontrado em %: %', p_funcao, left(p_de, 80); end if;
  execute replace(v, p_de, p_para);
end $$;

alter table public.produtos drop constraint produtos_tipo_check;
alter table public.produtos add constraint produtos_tipo_check check (tipo in ('unidade', 'combo', 'dose'));

create table public.garrafas (
  produto_id uuid primary key references public.produtos(id) on delete cascade,
  volume_ml integer not null check (volume_ml > 0),
  ml_aberto integer not null default 0 check (ml_aberto >= 0),
  atualizado_em timestamptz not null default now()
);

create table public.doses (
  produto_id uuid primary key references public.produtos(id) on delete cascade,
  garrafa_id uuid not null references public.garrafas(produto_id) on delete cascade,
  dose_ml integer not null default 100 check (dose_ml > 0)
);
create index doses_garrafa_idx on public.doses (garrafa_id);

alter table public.estoque_movimentos add column ml integer, add column ml_apos integer;
alter table public.estoque_movimentos drop constraint estoque_movimentos_tipo_check;
alter table public.estoque_movimentos add constraint estoque_movimentos_tipo_check check (tipo in ('implantacao', 'venda',
  'cancelamento_venda', 'consumo', 'cancelamento_consumo', 'entrada', 'ajuste', 'ajuste_ml'));

do $$
declare t text;
begin
  foreach t in array array['garrafas', 'doses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.sou_dono()))', 'ler_' || t, t);
  end loop;
end $$;
alter publication supabase_realtime add table public.garrafas;

-- Tira (p_ml < 0) ou devolve (p_ml > 0) ml da garrafa aberta, abrindo/fechando garrafas inteiras quando preciso.
create function public._mover_ml(p_garrafa uuid, p_ml integer, p_tipo text, p_ref uuid, p_obs text, p_eu public.funcionarios) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.garrafas; v_aberto integer; v_garrafas integer := 0; v_saldo integer;
begin
  if p_ml = 0 then return; end if;
  select * into g from public.garrafas where produto_id = p_garrafa for update;
  if not found then return; end if;
  v_aberto := g.ml_aberto + p_ml;
  while v_aberto < 0 loop               -- não deu: abre outra garrafa
    v_aberto := v_aberto + g.volume_ml;
    v_garrafas := v_garrafas - 1;
  end loop;
  while v_aberto > g.volume_ml loop     -- devolução encheu uma garrafa inteira: volta para o estoque fechado
    v_aberto := v_aberto - g.volume_ml;
    v_garrafas := v_garrafas + 1;
  end loop;
  update public.garrafas set ml_aberto = v_aberto, atualizado_em = now() where produto_id = p_garrafa;
  update public.produtos set estoque = estoque + v_garrafas, atualizado_em = now() where id = p_garrafa returning estoque into v_saldo;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, ml, ml_apos, referencia_id, observacao, funcionario_id, funcionario_nome)
  values (p_garrafa, p_tipo, v_garrafas, v_saldo, p_ml, v_aberto, p_ref,
          concat_ws(' · ', p_obs, case when v_garrafas < 0 then 'abriu ' || (-v_garrafas) || ' garrafa(s)' end),
          p_eu.id, coalesce(p_eu.nome, ''));
end $$;
revoke execute on function public._mover_ml(uuid, integer, text, uuid, text, public.funcionarios) from public, anon, authenticated;

-- Dose passa pela garrafa.
select pg_temp.trocar('public._mover_estoque(uuid, integer, text, uuid, text, public.funcionarios)'::regprocedure,
  '  if v_tipo = ''combo'' then',
  '  if v_tipo = ''dose'' then
    perform public._mover_ml(d.garrafa_id, p_delta * d.dose_ml, p_tipo, p_ref, p_obs, p_eu)
       from public.doses d where d.produto_id = p_produto;
    return;
  end if;
  if v_tipo = ''combo'' then');

-- ------------------------------------------------------------------
-- Funções do dono
-- ------------------------------------------------------------------
-- Liga/atualiza o controle de garrafa de um produto (p_volume_ml null = desliga).
create function public.configurar_garrafa(p_produto uuid, p_volume_ml integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_nome text;
begin
  select nome into v_nome from public.produtos where id = p_produto and tipo = 'unidade';
  if v_nome is null then raise exception 'Escolha um produto comum (garrafa).' using errcode = 'P0001'; end if;
  if p_volume_ml is null then
    if exists (select 1 from public.doses where garrafa_id = p_produto) then
      raise exception 'Há doses ligadas a esta garrafa. Desligue as doses antes.' using errcode = 'P0001';
    end if;
    delete from public.garrafas where produto_id = p_produto;
    perform public._auditar(v_eu, 'Desligou controle de garrafa', v_nome);
    return;
  end if;
  if p_volume_ml <= 0 then raise exception 'Volume inválido.' using errcode = 'P0001'; end if;
  insert into public.garrafas (produto_id, volume_ml) values (p_produto, p_volume_ml)
  on conflict (produto_id) do update set volume_ml = excluded.volume_ml,
    ml_aberto = least(public.garrafas.ml_aberto, excluded.volume_ml), atualizado_em = now();
  perform public._auditar(v_eu, 'Configurou garrafa', v_nome || ' · ' || p_volume_ml || ' ml');
end $$;

-- Ajusta os ml da garrafa aberta (conferência).
create function public.ajustar_ml_aberto(p_produto uuid, p_ml integer, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); g public.garrafas; v_nome text; v_saldo integer;
begin
  select * into g from public.garrafas where produto_id = p_produto for update;
  if not found then raise exception 'Garrafa não encontrada.' using errcode = 'P0001'; end if;
  if p_ml is null or p_ml < 0 or p_ml > g.volume_ml then
    raise exception 'Informe entre 0 e % ml.', g.volume_ml using errcode = 'P0001';
  end if;
  update public.garrafas set ml_aberto = p_ml, atualizado_em = now() where produto_id = p_produto;
  select nome, estoque into v_nome, v_saldo from public.produtos where id = p_produto;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, saldo_apos, ml, ml_apos, observacao, funcionario_id, funcionario_nome)
  values (p_produto, 'ajuste_ml', 0, v_saldo, p_ml - g.ml_aberto, p_ml, coalesce(nullif(btrim(p_motivo), ''), 'Conferência'), v_eu.id, v_eu.nome);
  perform public._auditar(v_eu, 'Ajustou ml da garrafa aberta', v_nome || ' · ' || g.ml_aberto || ' → ' || p_ml || ' ml');
end $$;

-- Cria ou altera uma dose. p = { id?, garrafa_id, nome, preco, dose_ml }.
-- Com id de um produto já existente, transforma esse produto em dose da garrafa.
create function public.salvar_dose(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_id uuid := nullif(p->>'id', '')::uuid; v_garrafa uuid := (p->>'garrafa_id')::uuid;
  v_ml integer := coalesce((p->>'dose_ml')::integer, 100); v_nome_garrafa text;
begin
  if not exists (select 1 from public.garrafas where produto_id = v_garrafa) then
    raise exception 'Garrafa não encontrada.' using errcode = 'P0001';
  end if;
  if v_ml <= 0 then raise exception 'Informe os ml da dose.' using errcode = 'P0001'; end if;
  if coalesce(btrim(p->>'nome'), '') = '' then raise exception 'Informe o nome da dose.' using errcode = 'P0001'; end if;
  if coalesce((p->>'preco')::numeric, -1) < 0 then raise exception 'Preço inválido.' using errcode = 'P0001'; end if;
  select nome into v_nome_garrafa from public.produtos where id = v_garrafa;
  if v_id is null then
    insert into public.produtos (nome, categoria, tipo, preco, imagem_url, favorito)
    select btrim(p->>'nome'), 'Doses', 'dose', round((p->>'preco')::numeric, 2), g.imagem_url, true
      from public.produtos g where g.id = v_garrafa
    returning id into v_id;
  else
    if v_id = v_garrafa then raise exception 'A dose não pode ser a própria garrafa.' using errcode = 'P0001'; end if;
    if exists (select 1 from public.garrafas where produto_id = v_id) then
      raise exception 'Este produto é uma garrafa. Escolha outro.' using errcode = 'P0001';
    end if;
    update public.produtos set nome = btrim(p->>'nome'), tipo = 'dose', preco = round((p->>'preco')::numeric, 2),
           arquivado = false, ativo = true, atualizado_em = now()
     where id = v_id and tipo <> 'combo';
    if not found then raise exception 'Produto inválido para dose.' using errcode = 'P0001'; end if;
  end if;
  insert into public.doses (produto_id, garrafa_id, dose_ml) values (v_id, v_garrafa, v_ml)
  on conflict (produto_id) do update set garrafa_id = excluded.garrafa_id, dose_ml = excluded.dose_ml;
  perform public._auditar(v_eu, 'Salvou dose', btrim(p->>'nome') || ' · ' || v_ml || ' ml de ' || v_nome_garrafa || ' · R$ ' || round((p->>'preco')::numeric, 2));
  return v_id;
end $$;

-- Desliga a dose (volta a ser produto comum, sem mexer em garrafa).
create function public.desligar_dose(p_produto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_nome text;
begin
  delete from public.doses where produto_id = p_produto;
  update public.produtos set tipo = 'unidade', atualizado_em = now() where id = p_produto and tipo = 'dose' returning nome into v_nome;
  if v_nome is null then raise exception 'Dose não encontrada.' using errcode = 'P0001'; end if;
  perform public._auditar(v_eu, 'Desligou dose', v_nome);
end $$;

revoke execute on function public.configurar_garrafa(uuid, integer), public.ajustar_ml_aberto(uuid, integer, text),
  public.salvar_dose(jsonb), public.desligar_dose(uuid) from public, anon;
grant execute on function public.configurar_garrafa(uuid, integer), public.ajustar_ml_aberto(uuid, integer, text),
  public.salvar_dose(jsonb), public.desligar_dose(uuid) to authenticated;

-- salvar_produto não pode transformar produto em dose (isso é feito em Garrafas) nem desfazer uma dose.
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  '      tipo = coalesce(nullif(p->>''tipo'', ''''), ''unidade''),',
  '      tipo = case when v_antes.tipo = ''dose'' then ''dose'' when p->>''tipo'' = ''combo'' then ''combo'' else ''unidade'' end,');
select pg_temp.trocar('public.salvar_produto(jsonb)'::regprocedure,
  'coalesce(btrim(p->>''categoria''), ''''), coalesce(nullif(p->>''tipo'', ''''), ''unidade''),',
  'coalesce(btrim(p->>''categoria''), ''''), case when p->>''tipo'' = ''combo'' then ''combo'' else ''unidade'' end,');

-- ------------------------------------------------------------------
-- Importa garrafas e doses do sistema antigo (copões ficam de fora)
-- ------------------------------------------------------------------
insert into public.garrafas (produto_id, volume_ml, ml_aberto)
select pr.id,
       case when (x->>'bottleVolumeMl')::int < 100 then 1000 else (x->>'bottleVolumeMl')::int end,
       least(greatest(coalesce((x->>'openVolumeMl')::numeric, 0), 0)::int,
             case when (x->>'bottleVolumeMl')::int < 100 then 1000 else (x->>'bottleVolumeMl')::int end)
  from public.company_state cs, jsonb_array_elements(cs.state->'products') x
  join public.produtos pr on pr.legado_id = x->>'id'
 where x->>'kind' = 'volume' and x->>'deletedAt' is null and not pr.arquivado
   and x->>'name' !~* '^\s*cop[aã]o' and x->>'name' !~* 'dose'
on conflict do nothing;

insert into public.doses (produto_id, garrafa_id, dose_ml)
select d.id, g.produto_id, 100
  from public.company_state cs, jsonb_array_elements(cs.state->'products') x
  join public.produtos d on d.legado_id = x->>'id'
  join public.produtos gp on gp.legado_id = x->>'doseSourceProductId'
  join public.garrafas g on g.produto_id = gp.id
 where x ? 'doseSourceProductId' and x->>'deletedAt' is null and not d.arquivado
on conflict do nothing;
update public.produtos set tipo = 'dose' where id in (select produto_id from public.doses);
