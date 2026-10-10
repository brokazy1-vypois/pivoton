-- Margin loan balances & marketplace orders
create table if not exists public.user_balances (
  user_id text primary key,
  monthly_salary numeric(12, 2) not null default 0,
  disbursed_loan_balance numeric(12, 2) not null default 0,
  spent_via_pos numeric(12, 2) not null default 0,
  under_investment numeric(12, 2) not null default 0,
  available_balance numeric(12, 2) not null default 0,
  labor_contract_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  erp_order_id text not null,
  pivoton_sku text not null,
  product_name text not null,
  product_image text,
  total_price numeric(12, 2) not null,
  payment_method text not null,
  status text not null default 'PROCESSING',
  tracking_number text,
  shipping_address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_erp_order_id_idx on public.orders (erp_order_id);

alter table public.user_balances enable row level security;
alter table public.orders enable row level security;

drop policy if exists "User balances readable" on public.user_balances;
create policy "User balances readable"
  on public.user_balances for select
  using (true);

drop policy if exists "User balances upsertable" on public.user_balances;
create policy "User balances upsertable"
  on public.user_balances for insert
  with check (true);

drop policy if exists "User balances updatable" on public.user_balances;
create policy "User balances updatable"
  on public.user_balances for update
  using (true);

drop policy if exists "Orders readable" on public.orders;
create policy "Orders readable"
  on public.orders for select
  using (true);

drop policy if exists "Orders insertable" on public.orders;
create policy "Orders insertable"
  on public.orders for insert
  with check (true);

drop policy if exists "Orders updatable" on public.orders;
create policy "Orders updatable"
  on public.orders for update
  using (true);
