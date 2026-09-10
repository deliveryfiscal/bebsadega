-- Beb's Gestão - Mega Update v2
-- Idempotente. Pode ser executado após 001_initial_schema.sql e 002_client_catalog.sql.
-- Adiciona estrutura para códigos múltiplos, compras, fornecedores, CRM ampliado,
-- financeiro detalhado, cancelamentos, caixa conferido, scanner e vendas suspensas.

create extension if not exists pgcrypto;

-- Produtos / CRM / Vendas
alter table public.products add column if not exists favorite boolean not null default false;
alter table public.products add column if not exists location text;
alter table public.products add column if not exists notes text;
alter table public.products add column if not exists needs_review boolean not null default false;

alter table public.customers add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.customers add column if not exists cashback numeric(14,2) not null default 0;
alter table public.customers add column if not exists updated_at timestamptz not null default now();

alter table public.sales add column if not exists note text;
alter table public.sales add column if not exists idempotency_key text;
alter table public.sales add column if not exists cancelled_at timestamptz;
alter table public.sales add column if not exists cancel_reason text;
alter table public.sale_items add column if not exists unit_cost numeric(14,4);

create unique index if not exists sales_company_idempotency_idx
  on public.sales(company_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists sales_company_created_idx on public.sales(company_id, created_at desc);
create index if not exists products_company_sku_idx on public.products(company_id, sku);
create index if not exists products_company_name_idx on public.products(company_id, lower(name));
create index if not exists customers_company_phone_idx on public.customers(company_id, phone);

-- Vários códigos para o mesmo produto / caixa, pack e unidade.
create table if not exists public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null,
  multiplier numeric(14,3) not null default 1 check (multiplier > 0),
  label text not null default 'Unidade',
  is_primary boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);
create index if not exists product_barcodes_product_idx on public.product_barcodes(product_id);
create unique index if not exists product_barcodes_one_primary_idx
  on public.product_barcodes(product_id)
  where is_primary = true;

-- Fornecedores e compras.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,
  phone text,
  email text,
  contact_name text,
  payment_terms text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_company_name_idx on public.suppliers(company_id, lower(name));

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'ordered' check (status in ('ordered','received','cancelled')),
  purchase_date timestamptz not null default now(),
  due_date date,
  total numeric(14,2) not null default 0 check (total >= 0),
  received_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists purchases_company_date_idx on public.purchases(company_id, purchase_date desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0)
);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);

-- Caixa e financeiro detalhados.
alter table public.cash_sessions add column if not exists expected_at_close numeric(14,2);
alter table public.cash_sessions add column if not exists difference numeric(14,2);
alter table public.cash_sessions add column if not exists close_reason text;

alter table public.financial_entries add column if not exists due_date date;
alter table public.financial_entries add column if not exists paid_at timestamptz;
alter table public.financial_entries add column if not exists status text not null default 'paid';
alter table public.financial_entries add column if not exists recurring boolean not null default false;
alter table public.financial_entries add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists financial_company_due_idx on public.financial_entries(company_id, due_date);
create index if not exists financial_company_status_idx on public.financial_entries(company_id, status);

-- Preferências do scanner por empresa.
create table if not exists public.scanner_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  duplicate_window_ms integer not null default 450 check (duplicate_window_ms >= 0),
  sound_enabled boolean not null default true,
  auto_focus boolean not null default true,
  auto_advance boolean not null default true,
  suffix text not null default 'enter' check (suffix in ('enter','tab','none')),
  updated_at timestamptz not null default now()
);

-- Vendas suspensas do balcão.
create table if not exists public.suspended_sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suspended_sales_company_idx on public.suspended_sales(company_id, updated_at desc);

-- RLS para as novas tabelas.
alter table public.product_barcodes enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.scanner_settings enable row level security;
alter table public.suspended_sales enable row level security;

drop policy if exists "product barcodes own company" on public.product_barcodes;
create policy "product barcodes own company" on public.product_barcodes for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "suppliers own company" on public.suppliers;
create policy "suppliers own company" on public.suppliers for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "purchases own company" on public.purchases;
create policy "purchases own company" on public.purchases for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "purchase items own company" on public.purchase_items;
create policy "purchase items own company" on public.purchase_items for all to authenticated
  using (exists (
    select 1 from public.purchases p
    where p.id = purchase_id and p.company_id = public.current_company_id()
  ))
  with check (exists (
    select 1 from public.purchases p
    where p.id = purchase_id and p.company_id = public.current_company_id()
  ));

drop policy if exists "scanner settings own company" on public.scanner_settings;
create policy "scanner settings own company" on public.scanner_settings for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "suspended sales own company" on public.suspended_sales;
create policy "suspended sales own company" on public.suspended_sales for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Privilégios para usuários autenticados; RLS continua limitando a empresa.
grant select, insert, update, delete on public.product_barcodes to authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update, delete on public.purchases to authenticated;
grant select, insert, update, delete on public.purchase_items to authenticated;
grant select, insert, update, delete on public.scanner_settings to authenticated;
grant select, insert, update, delete on public.suspended_sales to authenticated;

-- Reforço: funções críticas seguem indisponíveis para navegador comum.
revoke execute on function public.consume_product(uuid, numeric, integer, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.process_external_order(jsonb) from public, anon, authenticated;
grant execute on function public.process_external_order(jsonb) to service_role;
