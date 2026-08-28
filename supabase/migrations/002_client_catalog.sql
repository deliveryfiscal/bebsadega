-- Beb's Gestão - catálogo real transcrito das listas do cliente
-- Execute após 001_initial_schema.sql.
alter table public.products alter column barcode drop not null;

do $$
declare
  v_company uuid;
begin
  select id into v_company from public.companies where name = 'Beb''s Adega e Tabacaria' order by created_at limit 1;
  if v_company is null then
    insert into public.companies(name, phone) values ('Beb''s Adega e Tabacaria','(11) 97527-0632') returning id into v_company;
  end if;
  insert into public.categories(company_id,name) values (v_company,'Artigos para churrasco') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Beats e Ice') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Bebidas quentes') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Combos') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Conveniência') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Gelo') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Porções e caldos') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Tabacaria') on conflict (company_id,name) do nothing;
  insert into public.categories(company_id,name) values (v_company,'Whisky') on conflict (company_id,name) do nothing;

  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Buchanan''s · 1 L',null,'WHI-001','','volume',199.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Black Label · 1 L',null,'WHI-002','','volume',199.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jim Beam Apple · 1 L',null,'WHI-003','','volume',164.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jim Beam Honey · 1 L',null,'WHI-004','','volume',193.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jack Daniel''s Honey · 1 L',null,'WHI-005','','volume',169.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jack Daniel''s Apple · 1 L',null,'WHI-006','','volume',169.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jack Daniel''s Fire · 1 L',null,'WHI-007','','volume',169.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Old Parr · 1 L',null,'WHI-008','','volume',165.00,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Old Star · 1 L',null,'WHI-009','','volume',17.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Passport · 1 L',null,'WHI-010','','volume',83.00,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Red Label · 1 L',null,'WHI-011','','volume',123.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'White Horse · 1 L',null,'WHI-012','','volume',83.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Jack Daniel''s · 700 ml',null,'WHI-013','','volume',119.00,0,0,0,700,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Whisky'),'Mansão Maromba',null,'WHI-014','','unit',20.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Campari · 1 L',null,'BEQ-001','','volume',70.00,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Canelinha · 1 L',null,'BEQ-002','','volume',19.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Corote · 1 L (conforme folha)',null,'BEQ-003','','volume',6.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Dreher · 1 L',null,'BEQ-004','','volume',28.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'José Cuervo · 1 L',null,'BEQ-005','','volume',147.00,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Kariri · 1 L',null,'BEQ-006','','volume',26.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Malibu · 1 L',null,'BEQ-007','','volume',71.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'São Francisco · 1 L',null,'BEQ-008','','volume',39.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Tequiloka · 1 L',null,'BEQ-009','','volume',28.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Velho Barreiro · 1 L',null,'BEQ-010','','volume',18.00,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'51 · 1 L',null,'BEQ-011','','volume',17.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Ypióca Ouro · 1 L',null,'BEQ-012','','volume',48.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Pitú Sabor · 1 L',null,'BEQ-013','','volume',8.50,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Pitú Tradicional · 1 L',null,'BEQ-014','','volume',8.35,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Contini · 1 L',null,'BEQ-015','','volume',32.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Velho Barreiro · 600 ml',null,'BEQ-016','','volume',12.00,0,0,0,600,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Askov · 1 L',null,'BEQ-017','','volume',29.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Conhaque São João · 1 L',null,'BEQ-018','','volume',24.90,0,0,0,1000,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Bebidas quentes'),'Caturbom',null,'BEQ-019','','unit',19.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Azeitona · Porção inteira ~300 g',null,'POR-001','','unit',25.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Azeitona · Meia porção',null,'POR-002','','unit',14.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Calabresa · Porção inteira ~300 g',null,'POR-003','','unit',35.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Calabresa · Meia porção',null,'POR-004','','unit',25.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo de Abóbora · Pote 300 ml',null,'POR-005','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo de Feijão · Pote 300 ml',null,'POR-006','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo Verde · Pote 300 ml',null,'POR-007','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo de Mandioquinha · Pote 300 ml',null,'POR-008','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo de Frango · Pote',null,'POR-009','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Caldo de Camarão · Pote',null,'POR-010','','unit',25.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Feijoada · Pote',null,'POR-011','','unit',25.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Produto manuscrito - linha 10',null,'POR-012','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Mocotó',null,'POR-013','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Carne Seca',null,'POR-014','','unit',25.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Coxinha Mista',null,'POR-015','','unit',1.20,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Porções e caldos'),'Coxinha Bandeja',null,'POR-016','','unit',10.40,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Gelo'),'Gelo Comum · Saco',null,'GEL-001','','unit',13.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Gelo'),'Gelo de Sabores',null,'GEL-002','','unit',2.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Bombom',null,'CON-001','','unit',2.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Bolacha Wafer',null,'CON-002','','unit',3.80,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Amendoim Ovinho Elma Chips · Saco',null,'CON-003','','unit',6.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Amendoim Vanguarda · Saco',null,'CON-004','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Batata Chips GEF · Saco',null,'CON-005','','unit',6.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Batata Chips Yokitos · Saco',null,'CON-006','','unit',4.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Barra de Cereal · Barra',null,'CON-007','','unit',4.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Balas',null,'CON-008','','unit',0.25,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Balas Fines · Saco',null,'CON-009','','unit',11.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Garoto · Barra',null,'CON-010','','unit',13.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Prestígio · Barra',null,'CON-011','','unit',12.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Neugebauer · Barra',null,'CON-012','','unit',8.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Io-Io · Barra',null,'CON-013','','unit',4.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Hershey''s · Barra',null,'CON-014','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Hershey''s Ovomalt · Barra',null,'CON-015','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chiclete',null,'CON-016','','unit',0.25,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Kit Kat · Barra',null,'CON-017','','unit',5.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Leite · Caixa',null,'CON-018','','unit',6.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Leite Condensado',null,'CON-019','','unit',7.99,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Mel · 1 L (conforme folha)',null,'CON-020','','unit',25.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Mid Suco · Saco',null,'CON-021','','unit',3.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Óleo · 1 L',null,'CON-022','','unit',9.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Pururuca GEF · Saco',null,'CON-023','','unit',4.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Pão de Mel',null,'CON-024','','unit',3.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Pirulito',null,'CON-025','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Paçoca',null,'CON-026','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Salgadinho Fofura · Saco',null,'CON-027','','unit',3.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Sal Grosso · Pote',null,'CON-028','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Trident',null,'CON-029','','unit',3.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Torresmo Gordo · Saco',null,'CON-030','','unit',11.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Torcida · Saco',null,'CON-031','','unit',3.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Halls',null,'CON-032','','unit',3.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Sal · Saco',null,'CON-033','','unit',4.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Torcida Costela · Saco',null,'CON-034','','unit',4.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Energellys Morango',null,'CON-035','','unit',2.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Salgadinho Chiquito Cebola',null,'CON-036','','unit',3.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Nestlé Charge',null,'CON-037','','unit',10.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Conveniência'),'Chocolate Lacta Caramelo',null,'CON-038','','unit',10.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Carvão 10 kg · Saco',null,'CHU-001','','unit',54.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Carvão 8 kg · Saco',null,'CHU-002','','unit',43.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Frango · Pacote',null,'CHU-003','','unit',41.88,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Frango com Bacon · Pacote',null,'CHU-004','','unit',43.62,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Kafta · Pacote',null,'CHU-005','','unit',52.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Linguiça · Pacote',null,'CHU-006','','unit',34.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Sal Grosso · Pote',null,'CHU-007','','unit',20.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto Carne Bovina · Pacote',null,'CHU-008','','unit',47.88,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Churrasqueira · Peça',null,'CHU-009','','unit',180.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Frango · Unidade',null,'CHU-010','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Frango com Bacon · Unidade',null,'CHU-011','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Carne · Unidade',null,'CHU-012','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Kafta · Unidade',null,'CHU-013','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Linguiça · Unidade',null,'CHU-014','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Coração · Unidade',null,'CHU-015','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Espeto de Kafta com Queijo · Unidade',null,'CHU-016','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Artigos para churrasco'),'Milho · Unidade',null,'CHU-017','','unit',8.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Fumo TR · Pacote',null,'TAB-001','','unit',12.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Winston Uva · Maço',null,'TAB-002','','unit',15.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Alumínio · Caixa com 50 folhas',null,'TAB-003','','unit',25.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Alumínio · Folha avulsa',null,'TAB-004','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Carvão Narguilé · Caixa',null,'TAB-005','','unit',33.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Carvão Narguilé · Unidade',null,'TAB-006','','unit',1.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Essência Zig',null,'TAB-007','','unit',0.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Essência Adalya',null,'TAB-008','','unit',23.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Isqueiro',null,'TAB-009','','unit',2.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Gudang · Maço',null,'TAB-010','','unit',30.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Dunhill · Maço',null,'TAB-011','','unit',16.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Chesterfield · Maço',null,'TAB-012','','unit',13.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Gudang · Solto',null,'TAB-013','','unit',3.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Winston · Maço',null,'TAB-014','','unit',13.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Winston · Solto',null,'TAB-015','','unit',1.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Egipt · Maço',null,'TAB-016','','unit',10.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Egipt · Solto',null,'TAB-017','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Gift · Maço',null,'TAB-018','','unit',10.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Gift · Solto',null,'TAB-019','','unit',1.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Marlboro · Maço',null,'TAB-020','','unit',14.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Rotmans · Maço',null,'TAB-021','','unit',13.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Rotmans · Solto',null,'TAB-022','','unit',1.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro de Palha · Maço',null,'TAB-023','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro de Palha · Solto',null,'TAB-024','','unit',2.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Seda Zomo · Pacote',null,'TAB-025','','unit',5.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Seda Zomo · Unidade',null,'TAB-026','','unit',0.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Tabaco Acrema · Pacote',null,'TAB-027','','unit',15.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Lucky Strike · Maço',null,'TAB-028','','unit',13.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Dunhill · Maço - anotação adicional',null,'TAB-029','','unit',15.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Rotmans Azul · Maço',null,'TAB-030','','unit',13.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Marlboro Azul · Maço',null,'TAB-031','','unit',14.90,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro LM Vermelho · Maço',null,'TAB-032','','unit',14.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro LM Azul · Maço',null,'TAB-033','','unit',14.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Tabacaria'),'Cigarro Villas · Maço',null,'TAB-034','','unit',6.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'Skol Beats Senses · Garrafa',null,'ICE-001','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'Skol Beats Remix · Garrafa',null,'ICE-002','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'Skol Beats GT · Garrafa',null,'ICE-003','','unit',9.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'Cabaré Ice · Garrafa',null,'ICE-004','','unit',11.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'Smirnoff · Garrafa',null,'ICE-005','','unit',11.50,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Beats e Ice'),'51 Ice Sabores · Garrafa',null,'ICE-006','','unit',17.00,0,0,0,null,0,'{}'::jsonb,true)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Askov + 4 Red + 4 Gelo Sabor',null,'CMB-001','Beb''s','combo',73.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Bombay + 4 Red + 4 Gelo Sabor',null,'CMB-002','Beb''s','combo',209.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Bombay + Energético 2 L + 4 Gelo Sabor',null,'CMB-003','Beb''s','combo',174.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Cavalo Branco + 4 Red + 4 Gelo Sabor',null,'CMB-004','Beb''s','combo',150.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Cavalo Branco + Energético 2 L',null,'CMB-005','Beb''s','combo',118.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Eternity + Energético 2 L + 4 Gelo Sabor',null,'CMB-006','Beb''s','combo',52.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Invictus + Energético 2 L + 4 Gelo Sabor',null,'CMB-007','Beb''s','combo',49.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Jack Daniel''s + 4 Red + 4 Gelo Sabor',null,'CMB-008','Beb''s','combo',223.00,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Jack Daniel''s + Energético 2 L + 4 Gelo Sabor',null,'CMB-009','Beb''s','combo',193.00,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Malibu + Energético 2 L + 4 Gelo Sabor',null,'CMB-010','Beb''s','combo',92.00,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Old Parr + 4 Red + 4 Gelo Sabor',null,'CMB-011','Beb''s','combo',208.00,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Red Label + 4 Red + 4 Gelo Sabor',null,'CMB-012','Beb''s','combo',185.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Black Label + 4 Red + 4 Gelo Sabor',null,'CMB-013','Beb''s','combo',252.00,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Tanqueray + 4 Red + 4 Gelo Sabor',null,'CMB-014','Beb''s','combo',209.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Smirnoff + 4 Red + 4 Gelo Sabor',null,'CMB-015','Beb''s','combo',99.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Smirnoff + Energético 2 L + 4 Gelo Sabor',null,'CMB-016','Beb''s','combo',72.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
  insert into public.products(company_id,category_id,name,barcode,sku,brand,kind,price,cost,stock,min_stock,bottle_volume_ml,open_volume_ml,dose_prices,active)
  values (v_company,(select id from public.categories where company_id=v_company and name='Combos'),'Mansão Maromba + 4 Gelo Sabor + Baly',null,'CMB-017','Beb''s','combo',74.90,0,0,0,null,0,'{}'::jsonb,false)
  on conflict (company_id,sku) do update set name=excluded.name, category_id=excluded.category_id, price=excluded.price, kind=excluded.kind, bottle_volume_ml=excluded.bottle_volume_ml, active=excluded.active, updated_at=now();
end $$;
