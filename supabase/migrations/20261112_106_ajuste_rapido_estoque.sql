-- Ajuste rápido de estoque (somente dono): soma/subtrai do saldo atual.
-- Usa delta (não saldo absoluto) para não sobrescrever vendas feitas ao mesmo tempo em outro aparelho.
create function public.movimentar_estoque(p_produto uuid, p_delta integer, p_motivo text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v public.produtos; v_saldo integer;
begin
  if p_delta is null or p_delta = 0 then raise exception 'Informe a quantidade.' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo.' using errcode = 'P0001'; end if;
  select * into v from public.produtos where id = p_produto and tipo = 'unidade' for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0001'; end if;
  perform public._mover_estoque(p_produto, p_delta, 'ajuste', null, btrim(p_motivo), v_eu);
  select estoque into v_saldo from public.produtos where id = p_produto;
  perform public._auditar(v_eu, 'Ajustou estoque', v.nome || ' · ' || case when p_delta > 0 then '+' else '' end || p_delta
    || ' (' || v.estoque || ' → ' || v_saldo || ') · ' || btrim(p_motivo));
  return v_saldo;
end $$;

revoke execute on function public.movimentar_estoque(uuid, integer, text) from public, anon;
grant execute on function public.movimentar_estoque(uuid, integer, text) to authenticated;
