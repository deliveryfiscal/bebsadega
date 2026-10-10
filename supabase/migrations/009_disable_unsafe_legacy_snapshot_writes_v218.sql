-- Beb's v2.1.8 — executar SOMENTE APÓS a publicação e validação do
-- novo cliente que usa save_company_state_guarded.
-- Evita que sessões desatualizadas sobrescrevam o snapshot sem CAS.
revoke execute on function public.save_company_state_durable(jsonb,text,text,text)
  from authenticated;
-- A rotina save_company_state(jsonb,bigint) continua porque usa
-- verificacao de versao e nao permite sobrescrita incondicional.
