-- Consumo interno liberado novamente para funcionários ativos.
-- Entradas, ajustes e cancelamentos continuam exclusivos do dono.
do $$
declare definicao text := pg_get_functiondef('public.registrar_consumo(jsonb)'::regprocedure);
begin
  if position('v_eu public.funcionarios := public._eu(true);' in definicao) = 0 then
    raise exception 'Verificação de acesso inesperada em registrar_consumo';
  end if;
  execute replace(definicao,
    'v_eu public.funcionarios := public._eu(true);',
    'v_eu public.funcionarios := public._eu();');
end $$;
