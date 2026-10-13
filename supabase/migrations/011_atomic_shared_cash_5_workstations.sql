-- Beb's multiposto: todas as estacoes compartilham UM unico caixa.
-- Complementa 010. Abrir, sangria, suprimento e fechamento serializados
-- com as vendas, sob bloqueio da mesma empresa.
CREATE OR REPLACE FUNCTION public.bebs_cash_action_atomic(
  p_action text,
  p_amount numeric,
  p_expected_amount numeric DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_operator text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_client_id text DEFAULT NULL
)
RETURNS TABLE (remote_version bigint, company_state jsonb, saved_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_role text;
  v_state jsonb;
  v_session jsonb;
  v_version bigint;
  v_time timestamptz := clock_timestamp();
  v_time_text text;
  v_actor text;
  v_event text;
  v_action_label text;
  v_cash_id text;
  v_mov jsonb;
  v_audit jsonb;
  v_expected numeric;
  v_difference numeric;
  v_closing_summary jsonb;
  v_sales jsonb;
  v_payments jsonb;
  v_sales_count int;
  v_cancelled int;
  v_deleted int;
  v_gross numeric;
  v_discount numeric;
  v_withdrawals numeric;
  v_supplies numeric;
  v_new_state jsonb;
  v_hash text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessao nao autenticada'; END IF;
  SELECT pr.company_id,pr.role INTO v_company,v_role
  FROM public.profiles pr WHERE pr.id=v_user AND pr.active IS TRUE LIMIT 1;
  IF v_company IS NULL OR v_role NOT IN ('admin','manager','cashier') THEN
    RAISE EXCEPTION 'Usuario nao autorizado para operacoes do caixa';
  END IF;
  IF p_action NOT IN ('open','withdrawal','supply','close') THEN
    RAISE EXCEPTION 'Operacao de caixa invalida';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
    RAISE EXCEPTION 'Valor invalido para o caixa';
  END IF;
  IF p_action IN ('withdrawal','supply') AND p_amount <= 0 THEN
    RAISE EXCEPTION 'Sangria e suprimento devem ter valor positivo';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'Identificador da operacao do caixa invalido';
  END IF;
  v_event := 'cash:'||p_idempotency_key;
  v_actor := left(COALESCE(NULLIF(btrim(p_operator),''),'Operador'),100);
  v_time_text := to_char(v_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  -- Compartilha exatamente o mesmo lock com as vendas e gravacoes legadas.
  PERFORM 1 FROM public.companies c WHERE c.id=v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa nao encontrada'; END IF;
  SELECT s.state,s.version INTO v_state,v_version
    FROM public.company_state s WHERE s.company_id=v_company FOR UPDATE;
  v_time := clock_timestamp();
  v_time_text := to_char(v_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  IF v_state IS NULL THEN RAISE EXCEPTION 'Estado operacional ausente'; END IF;
  IF EXISTS(SELECT 1 FROM public.company_state_events e
     WHERE e.company_id=v_company AND e.event_id=v_event AND e.applied_version IS NOT NULL) THEN
    RETURN QUERY SELECT v_version,v_state,
       (SELECT updated_at FROM public.company_state WHERE company_id=v_company);
    RETURN;
  END IF;
  v_session := v_state->'cashSession';

  IF p_action='open' THEN
    IF v_session->>'status'='open' THEN
      RAISE EXCEPTION 'Ja existe um caixa aberto, compartilhado por todos os computadores';
    END IF;
    v_cash_id := 'cash_'||replace(gen_random_uuid()::text,'-','');
    v_mov := jsonb_build_object('id','mov_'||replace(gen_random_uuid()::text,'-',''),
      'type','opening','amount',p_amount,'description','Abertura de caixa',
      'createdAt',v_time_text,'operator',v_actor);
    v_session := jsonb_build_object('id',v_cash_id,'status','open',
      'openedAt',v_time_text,'openingAmount',p_amount,'operator',v_actor,
      'movements',jsonb_build_array(v_mov));
    v_action_label := 'Abriu';
  ELSE
    IF v_session IS NULL OR v_session->>'status'<>'open' THEN
      RAISE EXCEPTION 'O caixa compartilhado ja foi fechado ou nao foi aberto';
    END IF;
    IF p_session_id IS NULL OR p_session_id<>v_session->>'id' THEN
      RAISE EXCEPTION 'A sessao do caixa mudou em outro computador. Atualize os dados';
    END IF;
    v_cash_id := v_session->>'id';
    IF p_action IN ('withdrawal','supply') THEN
      IF length(btrim(COALESCE(p_description,'')))<3 THEN
        RAISE EXCEPTION 'Descreva o motivo do suprimento ou sangria';
      END IF;
      v_mov := jsonb_build_object('id','mov_'||replace(gen_random_uuid()::text,'-',''),
        'type',p_action,'amount',p_amount,'description',left(btrim(p_description),240),
        'createdAt',v_time_text,'operator',v_actor);
      v_session := jsonb_set(v_session,'{movements}',
        jsonb_build_array(v_mov)||COALESCE(v_session->'movements','[]'::jsonb));
      v_action_label := CASE WHEN p_action='withdrawal' THEN 'Sangria' ELSE 'Suprimento' END;
    ELSE
      v_expected := COALESCE((v_session->>'openingAmount')::numeric,0);
      SELECT COALESCE(sum(
        CASE WHEN m.value->>'type' IN ('sale','supply') THEN (m.value->>'amount')::numeric
             WHEN m.value->>'type' IN ('withdrawal','expense') THEN -(m.value->>'amount')::numeric
             ELSE 0 END
      ),0) INTO v_expected
        FROM jsonb_array_elements(COALESCE(v_session->'movements','[]'::jsonb)) m(value);
      v_expected := v_expected + COALESCE((v_session->>'openingAmount')::numeric,0);
      IF p_expected_amount IS NULL OR abs(p_expected_amount-v_expected)>0.009 THEN
        RAISE EXCEPTION 'Outro computador movimentou o caixa; atualize a conferencia antes de fechar';
      END IF;
      v_difference := p_amount-v_expected;
      IF abs(v_difference)>=0.01 AND length(btrim(COALESCE(p_reason,'')))<3 THEN
        RAISE EXCEPTION 'Informe o motivo da diferenca no fechamento';
      END IF;
      -- Resumo de TODOS os terminais no mesmo periodo do unico caixa.
      SELECT COALESCE(jsonb_agg(s.value),'[]'::jsonb) INTO v_sales
      FROM jsonb_array_elements(COALESCE(v_state->'sales','[]'::jsonb)) s(value)
      WHERE (s.value->>'createdAt')::timestamptz >= (v_session->>'openedAt')::timestamptz
        AND (s.value->>'createdAt')::timestamptz <= v_time;
      SELECT COUNT(*) FILTER(WHERE x.value->>'status'='completed'),
        COUNT(*) FILTER(WHERE x.value->>'status'='cancelled'),
        COUNT(*) FILTER(WHERE x.value->>'status'='deleted'),
        COALESCE(SUM((x.value->>'total')::numeric) FILTER(WHERE x.value->>'status'='completed'),0),
        COALESCE(SUM((x.value->>'discount')::numeric) FILTER(WHERE x.value->>'status'='completed'),0)
      INTO v_sales_count,v_cancelled,v_deleted,v_gross,v_discount
      FROM jsonb_array_elements(v_sales) x(value);
      SELECT jsonb_build_object('Dinheiro',COALESCE(sum(CASE WHEN line.value->>'method'='Dinheiro' THEN (line.value->>'amount')::numeric ELSE 0 END),0),
        'PIX',COALESCE(sum(CASE WHEN line.value->>'method'='PIX' THEN (line.value->>'amount')::numeric ELSE 0 END),0),
        'Débito',COALESCE(sum(CASE WHEN line.value->>'method'='Débito' THEN (line.value->>'amount')::numeric ELSE 0 END),0),
        'Crédito',COALESCE(sum(CASE WHEN line.value->>'method'='Crédito' THEN (line.value->>'amount')::numeric ELSE 0 END),0),
        'Outro',COALESCE(sum(CASE WHEN line.value->>'method'='Outro' THEN (line.value->>'amount')::numeric ELSE 0 END),0))
      INTO v_payments
      FROM jsonb_array_elements(v_sales) sale(value)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sale.value->'payments','[]'::jsonb)) line(value)
      WHERE sale.value->>'status'='completed';
      SELECT COALESCE(SUM((m.value->>'amount')::numeric) FILTER(WHERE m.value->>'type'='withdrawal'),0),
        COALESCE(SUM((m.value->>'amount')::numeric) FILTER(WHERE m.value->>'type'='supply'),0)
      INTO v_withdrawals,v_supplies
      FROM jsonb_array_elements(COALESCE(v_session->'movements','[]'::jsonb)) m(value);
      v_closing_summary := jsonb_build_object(
        'salesCount',v_sales_count,'grossSales',v_gross,'discountTotal',v_discount,
        'cancelledSales',v_cancelled,'deletedSales',v_deleted,'payments',v_payments,
        'withdrawals',v_withdrawals,'supplies',v_supplies,'expectedCash',v_expected
      );
      v_session := v_session || jsonb_build_object(
        'status','closed','closedAt',v_time_text,'closingAmount',p_amount,
        'expectedAtClose',v_expected,'difference',v_difference,
        'closeReason',NULLIF(btrim(p_reason),''),'closingSummary',v_closing_summary);
      v_state := jsonb_set(v_state,'{cashHistory}',
        jsonb_build_array(v_session)||COALESCE(v_state->'cashHistory','[]'::jsonb));
      v_action_label := 'Fechou';
    END IF;
  END IF;

  v_audit := jsonb_build_object('id','audit_'||replace(gen_random_uuid()::text,'-',''),
    'action',v_action_label,'entity','Caixa','entityId',v_cash_id,
    'details',left(p_action||': '||p_amount::text||
      CASE WHEN p_action='close' THEN ' | esperado '||v_expected::text ELSE '' END,240),
    'createdAt',v_time_text,'operator',v_actor);
  v_new_state := jsonb_set(v_state,'{cashSession}',v_session);
  v_new_state := jsonb_set(v_new_state,'{auditLogs}',
    jsonb_build_array(v_audit)||COALESCE(v_new_state->'auditLogs','[]'::jsonb));
  IF octet_length(v_new_state::text)>8388608 THEN RAISE EXCEPTION 'Estado excede 8MB'; END IF;
  v_version := v_version + 1;
  v_hash := md5(v_new_state::text);
  INSERT INTO public.company_state_events(
    company_id,event_id,client_id,reason,state_hash,state_size_bytes,applied_version,created_by)
  VALUES(v_company,v_event,COALESCE(NULLIF(left(btrim(p_client_id),200),''),'cash-atomic'),v_action_label||' caixa '||v_cash_id,
    v_hash,octet_length(v_new_state::text),v_version,v_user);
  UPDATE public.company_state
    SET state=v_new_state,version=v_version,updated_at=v_time,updated_by=v_user
  WHERE company_id=v_company;
  RETURN QUERY SELECT v_version,v_new_state,v_time;
END;
$$;
REVOKE ALL ON FUNCTION public.bebs_cash_action_atomic(text,numeric,numeric,text,text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bebs_cash_action_atomic(text,numeric,numeric,text,text,text,text,text,text)
  TO authenticated;
COMMENT ON FUNCTION public.bebs_cash_action_atomic(text,numeric,numeric,text,text,text,text,text,text)
  IS 'Unico caixa compartilhado: abertura, suprimento, sangria e fechamento atomicos com checkout e snapshot.';
