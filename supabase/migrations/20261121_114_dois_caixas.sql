alter table public.caixas add column terminal integer not null default 1 check (terminal in (1, 2));
drop index public.caixas_um_aberto;
create unique index caixas_um_aberto_por_terminal on public.caixas(terminal) where status = 'aberto';

CREATE OR REPLACE FUNCTION public.abrir_caixa(p_valor numeric, p_terminal integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(); v_id uuid;
begin
  if p_valor is null or p_valor < 0 then raise exception 'Valor inicial inválido.' using errcode = 'P0001'; end if;
  begin
    insert into public.caixas (terminal, aberto_por, aberto_por_nome, valor_abertura)
    values (p_terminal, v_eu.id, v_eu.nome, round(p_valor, 2)) returning id into v_id;
  exception when unique_violation then
    raise exception 'Este caixa já está aberto.' using errcode = 'P0001';
  end;
  perform public._auditar(v_eu, 'Abriu caixa', 'Valor inicial R$ ' || round(p_valor, 2));
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.movimentar_caixa(p_tipo text, p_valor numeric, p_descricao text, p_caixa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_disp numeric;
begin
  if p_tipo not in ('sangria', 'suprimento') then raise exception 'Tipo inválido.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where id = p_caixa and status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  if p_tipo = 'sangria' then
    v_disp := (public._resumo_caixa(v_caixa)->>'dinheiro_esperado')::numeric;
    if round(p_valor, 2) > v_disp then
      if v_eu.papel = 'dono' then
        raise exception 'Sangria maior que o dinheiro no caixa (R$ %).', v_disp using errcode = 'P0001';
      end if;
      raise exception 'Sangria maior que o dinheiro no caixa.' using errcode = 'P0001';
    end if;
  end if;
  insert into public.caixa_movimentos (caixa_id, tipo, valor, descricao, criado_por, criado_por_nome)
  values (v_caixa, p_tipo, round(p_valor, 2), coalesce(btrim(p_descricao), ''), v_eu.id, v_eu.nome);
  perform public._auditar(v_eu, case p_tipo when 'sangria' then 'Sangria' else 'Suprimento' end,
    'R$ ' || round(p_valor, 2) || ' · ' || coalesce(btrim(p_descricao), ''));
end $function$
;
CREATE OR REPLACE FUNCTION public.movimentar_caixa(p_tipo text, p_valor numeric, p_descricao text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_disp numeric;
begin
  if p_tipo not in ('sangria', 'suprimento') then raise exception 'Tipo inválido.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where terminal = 1 and status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  if p_tipo = 'sangria' then
    v_disp := (public._resumo_caixa(v_caixa)->>'dinheiro_esperado')::numeric;
    if round(p_valor, 2) > v_disp then
      if v_eu.papel = 'dono' then
        raise exception 'Sangria maior que o dinheiro no caixa (R$ %).', v_disp using errcode = 'P0001';
      end if;
      raise exception 'Sangria maior que o dinheiro no caixa.' using errcode = 'P0001';
    end if;
  end if;
  insert into public.caixa_movimentos (caixa_id, tipo, valor, descricao, criado_por, criado_por_nome)
  values (v_caixa, p_tipo, round(p_valor, 2), coalesce(btrim(p_descricao), ''), v_eu.id, v_eu.nome);
  perform public._auditar(v_eu, case p_tipo when 'sangria' then 'Sangria' else 'Suprimento' end,
    'R$ ' || round(p_valor, 2) || ' · ' || coalesce(btrim(p_descricao), ''));
end $function$
;

CREATE OR REPLACE FUNCTION public.fechar_caixa(p_contado numeric, p_observacao text, p_caixa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_esperado numeric; v_res jsonb;
begin
  if p_contado is null or p_contado < 0 then raise exception 'Valor contado inválido.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where id = p_caixa and status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  v_res := public._resumo_caixa(v_caixa);
  v_esperado := (v_res->>'dinheiro_esperado')::numeric;
  update public.caixas set status = 'fechado', fechado_em = now(), fechado_por = v_eu.id, fechado_por_nome = v_eu.nome,
         valor_esperado = v_esperado, valor_contado = round(p_contado, 2), diferenca = round(p_contado, 2) - v_esperado,
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = v_caixa;
  perform public._auditar(v_eu, 'Fechou caixa', 'Esperado R$ ' || v_esperado || ' · contado R$ ' || round(p_contado, 2)
    || ' · diferença R$ ' || (round(p_contado, 2) - v_esperado) || ' · ' || (v_res->>'vendas') || ' venda(s)');
  if v_eu.papel <> 'dono' then return jsonb_build_object('fechado', true); end if;
  return v_res || jsonb_build_object('diferenca', round(p_contado, 2) - v_esperado);
end $function$
;
CREATE OR REPLACE FUNCTION public.fechar_caixa(p_contado numeric, p_observacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(); v_caixa uuid; v_esperado numeric; v_res jsonb;
begin
  if p_contado is null or p_contado < 0 then raise exception 'Valor contado inválido.' using errcode = 'P0001'; end if;
  select id into v_caixa from public.caixas where terminal = 1 and status = 'aberto' for update;
  if v_caixa is null then raise exception 'Não há caixa aberto.' using errcode = 'P0001'; end if;
  v_res := public._resumo_caixa(v_caixa);
  v_esperado := (v_res->>'dinheiro_esperado')::numeric;
  update public.caixas set status = 'fechado', fechado_em = now(), fechado_por = v_eu.id, fechado_por_nome = v_eu.nome,
         valor_esperado = v_esperado, valor_contado = round(p_contado, 2), diferenca = round(p_contado, 2) - v_esperado,
         observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = v_caixa;
  perform public._auditar(v_eu, 'Fechou caixa', 'Esperado R$ ' || v_esperado || ' · contado R$ ' || round(p_contado, 2)
    || ' · diferença R$ ' || (round(p_contado, 2) - v_esperado) || ' · ' || (v_res->>'vendas') || ' venda(s)');
  if v_eu.papel <> 'dono' then return jsonb_build_object('fechado', true); end if;
  return v_res || jsonb_build_object('diferenca', round(p_contado, 2) - v_esperado);
end $function$
;
CREATE OR REPLACE FUNCTION public.reabrir_caixa(p_caixa uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_eu public.funcionarios := public._eu(true); v public.caixas;
begin
  select * into v from public.caixas where id = p_caixa for update;
  if not found or v.status <> 'fechado' then raise exception 'Caixa não encontrado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.caixas where terminal = v.terminal and status = 'aberto') then
    raise exception 'Já existe um caixa aberto. Feche-o antes de reabrir outro.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.caixas where terminal = v.terminal and aberto_em > v.aberto_em) then
    raise exception 'Só é possível reabrir o último caixa.' using errcode = 'P0001';
  end if;
  update public.caixas set status = 'aberto', fechado_em = null, fechado_por = null, fechado_por_nome = null,
         valor_esperado = null, valor_contado = null, diferenca = null where id = p_caixa;
  perform public._auditar(v_eu, 'Reabriu caixa', 'Aberto em ' || to_char(v.aberto_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    || ' · contado antes R$ ' || coalesce(v.valor_contado::text, '—'));
end $function$
;
-- Vendas offline mantêm a sessão de origem mesmo se a gaveta já fechou.
do $$
declare definicao text := pg_get_functiondef('public.finalizar_venda(jsonb)'::regprocedure);
  anterior text := $antes$  select id into v_caixa from public.caixas where id = nullif(p->>'caixa_id', '')::uuid;
  if v_caixa is null then select id into v_caixa from public.caixas where status = 'aberto'; end if;$antes$;
begin
  if strpos(definicao, anterior) = 0 then raise exception 'Definição de finalizar_venda inesperada'; end if;
  execute replace(definicao, anterior, $novo$  if nullif(p->>'caixa_id', '') is not null then
    select id into strict v_caixa from public.caixas where id = (p->>'caixa_id')::uuid for share;
  else
    select id into v_caixa from public.caixas where terminal = 1 and status = 'aberto' for share;
  end if;$novo$);
end $$;
revoke execute on function public.abrir_caixa(numeric, integer), public.movimentar_caixa(text, numeric, text, uuid), public.fechar_caixa(numeric, text, uuid) from public, anon;
grant execute on function public.abrir_caixa(numeric, integer), public.movimentar_caixa(text, numeric, text, uuid), public.fechar_caixa(numeric, text, uuid) to authenticated;
notify pgrst, 'reload schema';
