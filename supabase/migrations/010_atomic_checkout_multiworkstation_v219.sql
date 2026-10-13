-- Beb's: primeira etapa de operacao multiposto: checkout transacional.
-- A funcao nao apaga nem migra registros legados: le o snapshot atual
-- com bloqueio exclusivo no nivel da empresa, revalida estoque e acrescenta
-- venda, financeiro, caixa e auditoria na MESMA transacao.
CREATE SCHEMA IF NOT EXISTS bebs_private;
REVOKE ALL ON SCHEMA bebs_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION bebs_private.consume_stock(
  p_products jsonb,
  p_product_id text,
  p_quantity numeric,
  p_dose_ml numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_position integer;
  v_product jsonb;
  v_stock numeric;
  v_volume numeric;
  v_open numeric;
  v_remaining numeric;
  v_new_stock numeric;
  v_new_open numeric;
  v_updated text;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 100000 THEN
    RAISE EXCEPTION 'Quantidade invalida.';
  END IF;
  SELECT (q.idx - 1)::integer, q.product INTO v_position, v_product
    FROM jsonb_array_elements(p_products) WITH ORDINALITY q(product,idx)
    WHERE q.product->>'id' = p_product_id LIMIT 1;
  IF v_product IS NULL OR v_product->>'deletedAt' IS NOT NULL
     OR v_product->>'active' <> 'true' THEN
    RAISE EXCEPTION 'Produto inexistente, excluido ou inativo: %', p_product_id;
  END IF;
  v_stock := COALESCE((v_product->>'stock')::numeric, 0);
  IF p_dose_ml IS NOT NULL THEN
    IF v_product->>'kind' <> 'volume' OR p_dose_ml <= 0 OR p_dose_ml > 100000 THEN
      RAISE EXCEPTION 'Produto ou quantidade em ml invalida: %', p_product_id;
    END IF;
    v_volume := COALESCE((v_product->>'bottleVolumeMl')::numeric, 0);
    v_open := COALESCE((v_product->>'openVolumeMl')::numeric, 0);
    IF v_volume <= 0 OR v_open < 0 OR v_open >= v_volume OR v_stock < 0 THEN
      RAISE EXCEPTION 'Garrafa com saldo inconsistente: %', p_product_id;
    END IF;
    v_remaining := v_stock * v_volume + v_open - p_quantity * p_dose_ml;
    IF v_remaining < -0.00000001 THEN
      RAISE EXCEPTION 'Volume insuficiente no produto %', p_product_id;
    END IF;
    v_remaining := GREATEST(0, v_remaining);
    v_new_stock := floor(v_remaining / v_volume);
    v_new_open := v_remaining - v_new_stock * v_volume;
  ELSE
    IF v_product->>'kind' = 'combo'
       OR NULLIF(v_product->>'doseSourceProductId','') IS NOT NULL THEN
      RAISE EXCEPTION 'Produto nao admite baixa por unidade: %', p_product_id;
    END IF;
    IF v_stock < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente no produto %', p_product_id;
    END IF;
    v_new_stock := v_stock - p_quantity;
    v_new_open := COALESCE((v_product->>'openVolumeMl')::numeric, 0);
  END IF;
  v_updated := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  p_products := jsonb_set(p_products, ARRAY[v_position::text,'stock'], to_jsonb(v_new_stock));
  IF p_dose_ml IS NOT NULL THEN
    p_products := jsonb_set(p_products, ARRAY[v_position::text,'openVolumeMl'], to_jsonb(v_new_open));
  END IF;
  p_products := jsonb_set(p_products, ARRAY[v_position::text,'updatedAt'], to_jsonb(v_updated));
  RETURN p_products;
END;
$$;

REVOKE ALL ON FUNCTION bebs_private.consume_stock(jsonb,text,numeric,numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bebs_finalize_sale_atomic(
  p_items jsonb,
  p_discount numeric,
  p_payments jsonb,
  p_idempotency_key text,
  p_operator text DEFAULT NULL,
  p_customer_id text DEFAULT NULL,
  p_channel text DEFAULT 'Balcão',
  p_external_id text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS TABLE (
  sale_id text,
  sale_number integer,
  remote_version bigint,
  company_state jsonb,
  saved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_company uuid;
  v_state jsonb;
  v_version bigint;
  v_product jsonb;
  v_component jsonb;
  v_target jsonb;
  v_item jsonb;
  v_line jsonb;
  v_payment jsonb;
  v_items_with_cost jsonb := '[]'::jsonb;
  v_products jsonb;
  v_sold_product_id text;
  v_qty numeric;
  v_unit_price numeric;
  v_dose_ml numeric;
  v_subtotal numeric := 0;
  v_discount numeric;
  v_total numeric;
  v_paid numeric := 0;
  v_cash numeric := 0;
  v_unit_cost numeric;
  v_component_qty numeric;
  v_component_ml numeric;
  v_comp_cost numeric;
  v_session jsonb;
  v_now timestamptz := clock_timestamp();
  v_time text;
  v_sale_number integer;
  v_sale_id text;
  v_sale jsonb;
  v_fin jsonb;
  v_cash_movement jsonb;
  v_audit jsonb;
  v_operator text;
  v_existing jsonb;
  v_event_id text;
  v_hash text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessao nao autenticada'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'Identificador unico da venda invalido';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 120
    OR jsonb_typeof(p_payments) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payments) NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Itens ou pagamentos invalidos';
  END IF;
  IF p_discount IS NULL OR p_discount < 0 OR p_discount > 100000000 THEN
    RAISE EXCEPTION 'Desconto invalido';
  END IF;
  IF p_channel NOT IN ('Balcão','iFood','99Food') THEN
    RAISE EXCEPTION 'Canal invalido';
  END IF;

  SELECT pr.company_id INTO v_company FROM public.profiles pr
    WHERE pr.id = v_user AND pr.active IS TRUE LIMIT 1;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Operador sem perfil ativo'; END IF;

  -- Compartilha o mesmo bloqueio de empresa da RPC legada de CAS:
  -- cinco PCs nao conseguem passar no mesmo saldo ao mesmo tempo.
  PERFORM 1 FROM public.companies co WHERE co.id = v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa inexistente'; END IF;
  SELECT cs.state, cs.version INTO v_state, v_version FROM public.company_state cs
    WHERE cs.company_id=v_company FOR UPDATE;
  IF v_state IS NULL THEN RAISE EXCEPTION 'Cadastro operacional inexistente'; END IF;

  SELECT value INTO v_existing FROM jsonb_array_elements(COALESCE(v_state->'sales','[]'::jsonb))
    WHERE value->>'idempotencyKey'=p_idempotency_key LIMIT 1;
  IF FOUND THEN
    -- Retentativa nao faz outra baixa de estoque, movimento ou lancamento.
    IF v_existing->>'status' IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Venda com esse identificador ja processada';
    END IF;
    RETURN QUERY SELECT v_existing->>'id', (v_existing->>'number')::integer,
      v_version, v_state, (SELECT updated_at FROM public.company_state WHERE company_id=v_company);
    RETURN;
  END IF;

  v_session := v_state->'cashSession';
  IF COALESCE(v_session->>'status','') <> 'open' THEN RAISE EXCEPTION 'Abra o caixa antes da venda'; END IF;
  v_products := COALESCE(v_state->'products','[]'::jsonb);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_sold_product_id := v_item->>'productId';
    v_product := NULL;
    SELECT value INTO v_product FROM jsonb_array_elements(v_products)
      WHERE value->>'id' = v_sold_product_id LIMIT 1;
    IF v_product IS NULL OR v_product->>'deletedAt' IS NOT NULL OR v_product->>'active'<>'true' THEN
      RAISE EXCEPTION 'Produto inativo ou inexistente %', v_sold_product_id;
    END IF;
    IF jsonb_typeof(v_item->'quantity') <> 'number'
       OR jsonb_typeof(v_item->'unitPrice') <> 'number' THEN
      RAISE EXCEPTION 'Quantidade ou preco invalido';
    END IF;
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unitPrice')::numeric;
    IF v_qty<=0 OR v_qty<>floor(v_qty) OR v_qty>100000 OR v_unit_price<0 OR v_unit_price>10000000 THEN
      RAISE EXCEPTION 'Quantidade ou preco fora dos limites';
    END IF;
    v_subtotal := v_subtotal + v_qty * v_unit_price;
    v_unit_cost := COALESCE((v_product->>'cost')::numeric,0);

    CASE v_item->>'mode'
      WHEN 'unit' THEN
        v_products := bebs_private.consume_stock(v_products, v_sold_product_id,v_qty,NULL);
      WHEN 'dose' THEN
        IF jsonb_typeof(v_item->'doseMl') <> 'number' THEN RAISE EXCEPTION 'Informe ml'; END IF;
        v_dose_ml := (v_item->>'doseMl')::numeric;
        IF v_dose_ml<=0 THEN RAISE EXCEPTION 'Quantidade em ml invalida'; END IF;
        v_unit_cost := v_unit_cost*v_dose_ml/NULLIF((v_product->>'bottleVolumeMl')::numeric,0);
        v_products := bebs_private.consume_stock(v_products,v_sold_product_id,v_qty,v_dose_ml);
      WHEN 'combo' THEN
        IF v_product->>'kind'<>'combo'
           OR jsonb_typeof(v_product->'comboItems')<>'array'
           OR jsonb_array_length(v_product->'comboItems')=0 THEN
          RAISE EXCEPTION 'Combo sem composicao valida';
        END IF;
        v_unit_cost := 0;
        FOR v_component IN SELECT value FROM jsonb_array_elements(v_product->'comboItems')
        LOOP
          v_target := NULL;
          SELECT value INTO v_target FROM jsonb_array_elements(v_products)
            WHERE value->>'id'=v_component->>'productId' LIMIT 1;
          IF v_target IS NULL OR v_target->>'active'<>'true' OR v_target->>'deletedAt' IS NOT NULL THEN
            RAISE EXCEPTION 'Componente indisponivel no combo';
          END IF;
          IF jsonb_typeof(v_component->'quantity')<>'number' THEN
            RAISE EXCEPTION 'Quantidade de componente invalida';
          END IF;
          v_component_qty := (v_component->>'quantity')::numeric;
          IF v_component_qty<=0 OR v_component_qty>100000 THEN RAISE EXCEPTION 'Componente invalido'; END IF;
          v_component_ml := NULL;
          IF v_component ? 'doseMl' AND v_component->>'doseMl' IS NOT NULL THEN
            v_component_ml := (v_component->>'doseMl')::numeric;
            IF v_component_ml<=0 THEN RAISE EXCEPTION 'Dose de combo invalida'; END IF;
          END IF;
          v_comp_cost := COALESCE((v_target->>'cost')::numeric,0);
          IF v_component_ml IS NOT NULL THEN
            v_comp_cost := v_comp_cost*v_component_ml/NULLIF((v_target->>'bottleVolumeMl')::numeric,0);
          END IF;
          v_unit_cost := v_unit_cost + v_comp_cost*v_component_qty;
          v_products := bebs_private.consume_stock(v_products, v_component->>'productId',
            v_component_qty*v_qty,v_component_ml);
        END LOOP;
      ELSE
        RAISE EXCEPTION 'Modo de venda invalido';
    END CASE;
    IF v_unit_cost IS NULL THEN RAISE EXCEPTION 'Custo do item invalido'; END IF;
    v_line := v_item || jsonb_build_object('unitCost',v_unit_cost);
    v_items_with_cost := v_items_with_cost || jsonb_build_array(v_line);
  END LOOP;

  v_discount := LEAST(v_discount+p_discount,v_subtotal);
  v_total := v_subtotal - v_discount;
  FOR v_payment IN SELECT value FROM jsonb_array_elements(p_payments)
  LOOP
    IF v_payment->>'method' NOT IN ('Dinheiro','PIX','Débito','Crédito','Outro')
       OR jsonb_typeof(v_payment->'amount')<>'number' THEN
      RAISE EXCEPTION 'Forma de pagamento invalida';
    END IF;
    IF (v_payment->>'amount')::numeric<0 THEN RAISE EXCEPTION 'Pagamento negativo'; END IF;
    v_paid := v_paid + (v_payment->>'amount')::numeric;
    IF v_payment->>'method'='Dinheiro' THEN
      v_cash := v_cash + (v_payment->>'amount')::numeric;
    END IF;
  END LOOP;
  IF abs(v_paid-v_total)>0.009 THEN RAISE EXCEPTION 'Pagamento nao corresponde ao valor da venda'; END IF;

  SELECT COALESCE(max((value->>'number')::integer),1000)+1 INTO v_sale_number
    FROM jsonb_array_elements(COALESCE(v_state->'sales','[]'::jsonb));
  v_sale_id := 'sale_' || replace(gen_random_uuid()::text,'-','');
  v_time := to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_operator := left(COALESCE(NULLIF(btrim(p_operator),''),v_state#>>'{currentOperator,name}','Operador'),100);
  v_sale := jsonb_build_object(
    'id',v_sale_id,'number',v_sale_number,'channel',p_channel,
    'externalId',p_external_id,'customerId',p_customer_id,
    'items',v_items_with_cost,'subtotal',v_subtotal,'discount',v_discount,'total',v_total,
    'payments',p_payments,'status','completed','createdAt',v_time,'operator',v_operator,
    'note',NULLIF(btrim(p_note),''),'idempotencyKey',p_idempotency_key
  );
  v_fin := jsonb_build_object(
    'id','fin_'||replace(gen_random_uuid()::text,'-',''),'type','income',
    'category','Vendas '||p_channel,'description','Venda #'||v_sale_number,
    'amount',v_total,'date',v_time,'status','paid','paidAt',v_time,
    'channel',p_channel,'saleId',v_sale_id
  );
  v_audit := jsonb_build_object(
    'id','audit_'||replace(gen_random_uuid()::text,'-',''),'action','Finalizou',
    'entity','Venda','entityId',v_sale_id,'details',
    'Venda #'||v_sale_number||' · '||p_channel||' · '||v_total::text,
    'createdAt',v_time,'operator',v_operator
  );
  IF v_cash>0 THEN
    v_cash_movement := jsonb_build_object(
      'id','mov_'||replace(gen_random_uuid()::text,'-',''),'saleId',v_sale_id,
      'type','sale','amount',v_cash,'description','Venda #'||v_sale_number||' · dinheiro',
      'createdAt',v_time,'operator',v_operator
    );
    v_session := jsonb_set(v_session, '{movements}',
      jsonb_build_array(v_cash_movement)||COALESCE(v_session->'movements','[]'::jsonb));
  END IF;
  v_state := jsonb_set(v_state,'{products}',v_products);
  v_state := jsonb_set(v_state,'{sales}',jsonb_build_array(v_sale)||COALESCE(v_state->'sales','[]'::jsonb));
  v_state := jsonb_set(v_state,'{financialEntries}',jsonb_build_array(v_fin)||COALESCE(v_state->'financialEntries','[]'::jsonb));
  v_state := jsonb_set(v_state,'{cashSession}',v_session);
  v_state := jsonb_set(v_state,'{auditLogs}',jsonb_build_array(v_audit)||COALESCE(v_state->'auditLogs','[]'::jsonb));
  v_version := v_version + 1;
  v_event_id := 'sale:'||p_idempotency_key;
  v_hash := md5(v_state::text);
  INSERT INTO public.company_state_events(
    company_id,event_id,client_id,reason,state_hash,state_size_bytes,applied_version,created_by
  ) VALUES (
    v_company,v_event_id,'checkout-atomic','Venda #'||v_sale_number,
    v_hash,octet_length(v_state::text),v_version,v_user
  );
  UPDATE public.company_state
    SET state=v_state,version=v_version,updated_at=v_now,updated_by=v_user
    WHERE company_id=v_company;
  RETURN QUERY SELECT v_sale_id,v_sale_number,v_version,v_state,v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.bebs_finalize_sale_atomic(jsonb,numeric,jsonb,text,text,text,text,text,text)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bebs_finalize_sale_atomic(jsonb,numeric,jsonb,text,text,text,text,text,text)
 TO authenticated;

COMMENT ON FUNCTION public.bebs_finalize_sale_atomic(jsonb,numeric,jsonb,text,text,text,text,text,text)
 IS 'Checkout transacional: bloqueio da empresa, saldo do estoque, idempotencia, numero unico, financeiro e caixa.';
