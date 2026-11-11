-- Fotos dos produtos e base de referência de códigos de barras.

alter table public.produtos add column imagem_url text;

-- Base pública de códigos (consulta ao bipar um código que a loja ainda não cadastrou).
create table public.catalogo_referencia (
  codigo text primary key,
  nome text not null,
  categoria text not null default '',
  categoria_fonte text,
  fabricante text,
  volume_ml integer,
  embalagem text,
  unidades integer not null default 1 check (unidades > 0),
  codigo_unidade text,
  imagem_url text,
  fonte text
);
alter table public.catalogo_referencia enable row level security;
revoke all on table public.catalogo_referencia from anon, public;
revoke insert, update, delete, truncate on table public.catalogo_referencia from authenticated;
grant select on table public.catalogo_referencia to authenticated;
create policy ler_catalogo_referencia on public.catalogo_referencia for select to authenticated using ((select public.sou_ativo()));

-- Carga da base (somente dono). p = [{codigo, nome, categoria, ...}]
create function public.importar_referencia(p jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_n integer;
begin
  insert into public.catalogo_referencia (codigo, nome, categoria, categoria_fonte, fabricante, volume_ml, embalagem, unidades, codigo_unidade, imagem_url, fonte)
  select btrim(x->>'codigo'), btrim(x->>'nome'), coalesce(x->>'categoria', ''), x->>'categoria_fonte', nullif(x->>'fabricante', ''),
         nullif(x->>'volume_ml', '')::integer, nullif(x->>'embalagem', ''), greatest(coalesce(nullif(x->>'unidades', '')::integer, 1), 1),
         nullif(x->>'codigo_unidade', ''), nullif(x->>'imagem_url', ''), nullif(x->>'fonte', '')
    from jsonb_array_elements(p) x
   where coalesce(btrim(x->>'codigo'), '') <> '' and coalesce(btrim(x->>'nome'), '') <> ''
  on conflict (codigo) do update set
    nome = excluded.nome, categoria = excluded.categoria, categoria_fonte = excluded.categoria_fonte,
    fabricante = excluded.fabricante, volume_ml = excluded.volume_ml, embalagem = excluded.embalagem,
    unidades = excluded.unidades, codigo_unidade = excluded.codigo_unidade,
    imagem_url = coalesce(excluded.imagem_url, public.catalogo_referencia.imagem_url), fonte = excluded.fonte;
  get diagnostics v_n = row_count;
  perform public._auditar(v_eu, 'Atualizou base de códigos', v_n || ' código(s)');
  return v_n;
end $$;

-- Define fotos em lote (somente dono). p = [{produto_id, imagem_url}]
create function public.definir_imagens(p jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_eu public.funcionarios := public._eu(true); v_n integer;
begin
  update public.produtos pr set imagem_url = nullif(x->>'imagem_url', ''), atualizado_em = now()
    from jsonb_array_elements(p) x
   where pr.id = (x->>'produto_id')::uuid and pr.imagem_url is distinct from nullif(x->>'imagem_url', '');
  get diagnostics v_n = row_count;
  perform public._auditar(v_eu, 'Definiu fotos de produtos', v_n || ' produto(s)');
  return v_n;
end $$;

revoke execute on function public.importar_referencia(jsonb), public.definir_imagens(jsonb) from public, anon;
grant execute on function public.importar_referencia(jsonb), public.definir_imagens(jsonb) to authenticated;

-- salvar_produto passa a gravar a foto (chave "imagem_url"; ausente = mantém).
create or replace function public.salvar_produto(p jsonb) returns uuid
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
    insert into public.produtos (nome, categoria, tipo, preco, custo, estoque_minimo, favorito, ativo, imagem_url)
    values (btrim(p->>'nome'), coalesce(btrim(p->>'categoria'), ''), coalesce(nullif(p->>'tipo', ''), 'unidade'),
            round((p->>'preco')::numeric, 2), round(coalesce((p->>'custo')::numeric, 0), 2),
            coalesce((p->>'estoque_minimo')::integer, 0), coalesce((p->>'favorito')::boolean, false),
            coalesce((p->>'ativo')::boolean, true), nullif(p->>'imagem_url', ''))
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
      imagem_url = case when p ? 'imagem_url' then nullif(p->>'imagem_url', '') else imagem_url end,
      atualizado_em = now()
    where id = v_id;
    if v_antes.preco <> round((p->>'preco')::numeric, 2) then
      perform public._auditar(v_eu, 'Alterou preço', v_antes.nome || ' · R$ ' || v_antes.preco || ' → R$ ' || round((p->>'preco')::numeric, 2));
    end if;
  end if;
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

-- Armazenamento das fotos: leitura pública (exibição no PDV), envio só pelo dono.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy produtos_fotos_dono_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and (select public.sou_dono()));
create policy produtos_fotos_dono_alterar on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and (select public.sou_dono()));
create policy produtos_fotos_dono_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (select public.sou_dono()));
-- Necessária para o envio com substituição (upsert) do Storage.
create policy produtos_fotos_dono_ler on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and (select public.sou_dono()));
