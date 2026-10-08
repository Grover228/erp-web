create table if not exists public.ozon_products (
  id uuid primary key default gen_random_uuid(),
  ozon_product_id bigint not null unique,
  offer_id text not null,
  product_id uuid references public.products(id) on delete set null,
  name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ozon_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  date_from date not null,
  date_to date not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  operations_loaded integer not null default 0,
  operations_updated integer not null default 0,
  error_message text
);

create table if not exists public.ozon_operations (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null unique,
  operation_date timestamptz not null,
  operation_type text,
  operation_type_name text,
  posting_number text,
  amount numeric(14,2) not null default 0,
  accruals_for_sale numeric(14,2) not null default 0,
  sale_commission numeric(14,2) not null default 0,
  services_total numeric(14,2) not null default 0,
  cost_of_goods numeric(14,2) not null default 0,
  profit numeric(14,2) generated always as (amount - cost_of_goods) stored,
  matched boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  sync_run_id uuid references public.ozon_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ozon_operations_date_idx on public.ozon_operations(operation_date desc);
create index if not exists ozon_operations_posting_idx on public.ozon_operations(posting_number);
create index if not exists ozon_products_offer_idx on public.ozon_products(lower(offer_id));

alter table public.ozon_products enable row level security;
alter table public.ozon_sync_runs enable row level security;
alter table public.ozon_operations enable row level security;

create policy "Admins can read Ozon products" on public.ozon_products
for select to authenticated using (
  exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and coalesce(e.app_role, e.role) = 'admin')
);
create policy "Admins can read Ozon sync runs" on public.ozon_sync_runs
for select to authenticated using (
  exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and coalesce(e.app_role, e.role) = 'admin')
);
create policy "Admins can read Ozon operations" on public.ozon_operations
for select to authenticated using (
  exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and coalesce(e.app_role, e.role) = 'admin')
);

comment on table public.ozon_operations is 'Начисления и удержания Ozon; фактические выплаты учитываются отдельно в finance_transactions.';
comment on column public.ozon_operations.amount is 'Итог операции после комиссий и услуг Ozon.';
comment on column public.ozon_operations.cost_of_goods is 'Себестоимость сопоставленных изделий ERP на момент синхронизации.';
