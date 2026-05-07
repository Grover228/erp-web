create table if not exists finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'cash',
  currency text not null default 'RUB',
  opening_balance numeric(14, 2) not null default 0,
  current_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references finance_accounts(id) on delete cascade,
  type text not null,
  amount numeric(14, 2) not null,
  operation_date date not null default current_date,
  description text,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_transactions_account_id
on finance_transactions(account_id);

create index if not exists idx_finance_transactions_operation_date
on finance_transactions(operation_date);
