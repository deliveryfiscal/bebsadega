-- Funcionários movimentam estoque somente ao vender.
-- Entrada de mercadoria e consumo interno ficam exclusivos do dono.
-- Preserva as implementações atuais, incluindo custos, doses e combos.
do $$
declare
  f regprocedure;
  definicao text;
begin
  foreach f in array array[
    'public.entrada_estoque(jsonb,text)'::regprocedure,
    'public.registrar_consumo(jsonb)'::regprocedure
  ] loop
    definicao := pg_get_functiondef(f);
    if position('v_eu public.funcionarios := public._eu();' in definicao) = 0 then
      raise exception 'Verificação de acesso inesperada em %', f;
    end if;
    execute replace(definicao,
      'v_eu public.funcionarios := public._eu();',
      'v_eu public.funcionarios := public._eu(true);');
  end loop;
end $$;
