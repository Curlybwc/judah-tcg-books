-- Judah TCG Books — initial schema
-- House rules: REVOKE ALL from anon/authenticated/service_role BEFORE grants;
-- explicit Data API GRANTs (new tables get none by default); RLS on every table.

create extension if not exists pgcrypto;

-- ============ products ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  barcode text,
  product_type text not null default 'sealed' check (product_type in ('sealed','single')),
  market_price numeric(12,2),
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
revoke all on public.products from anon, authenticated, service_role;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.products to service_role;
create policy products_owner_all on public.products
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Demo mode: sample-owner rows are publicly readable until real auth is wired in the morning.
create policy products_sample_read on public.products
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.products to anon;

-- ============ purchases ============
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null,
  tax numeric(12,2) not null default 0,
  shipping_in numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null,
  cost_basis_unit numeric(12,4) not null,
  owner_kind text not null default 'mine' check (owner_kind in ('mine','giovanni','split')),
  judah_pct numeric(5,2) not null default 100,
  paid_via text not null default 'USAA' check (paid_via in ('USAA','Cash','Other')),
  purchased_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated, service_role;
grant select, insert, update, delete on public.purchases to authenticated;
grant select, insert, update, delete on public.purchases to service_role;
create policy purchases_owner_all on public.purchases
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy purchases_sample_read on public.purchases
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.purchases to anon;

-- ============ inventory_lots ============
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  product_id uuid references public.products(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  qty_on_hand integer not null default 0,
  cost_basis_unit numeric(12,4) not null,
  owner_kind text not null default 'mine' check (owner_kind in ('mine','giovanni','split')),
  judah_pct numeric(5,2) not null default 100,
  created_at timestamptz not null default now()
);
alter table public.inventory_lots enable row level security;
revoke all on public.inventory_lots from anon, authenticated, service_role;
grant select, insert, update, delete on public.inventory_lots to authenticated;
grant select, insert, update, delete on public.inventory_lots to service_role;
create policy lots_owner_all on public.inventory_lots
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy lots_sample_read on public.inventory_lots
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.inventory_lots to anon;

-- ============ sales ============
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  product_name text not null,
  qty integer not null default 1 check (qty > 0),
  item_price numeric(12,2) not null,
  shipping_charged numeric(12,2) not null default 0,
  shipping_paid numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  transaction_fee numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  net_proceeds numeric(12,2) not null default 0,
  cost_basis_total numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  judah_share numeric(12,2) not null default 0,
  order_id text,
  sold_on date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.sales enable row level security;
revoke all on public.sales from anon, authenticated, service_role;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sales to service_role;
create policy sales_owner_all on public.sales
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy sales_sample_read on public.sales
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.sales to anon;

-- ============ giovanni_payments ============
create table public.giovanni_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.giovanni_payments enable row level security;
revoke all on public.giovanni_payments from anon, authenticated, service_role;
grant select, insert, update, delete on public.giovanni_payments to authenticated;
grant select, insert, update, delete on public.giovanni_payments to service_role;
create policy gpay_owner_all on public.giovanni_payments
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy gpay_sample_read on public.giovanni_payments
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.giovanni_payments to anon;

-- ============ price_lookups ============
create table public.price_lookups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  product_name text not null,
  price numeric(12,2),
  provider text not null default 'sample',
  looked_up_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.price_lookups enable row level security;
revoke all on public.price_lookups from anon, authenticated, service_role;
grant select, insert, update, delete on public.price_lookups to authenticated;
grant select, insert, update, delete on public.price_lookups to service_role;
create policy plook_owner_all on public.price_lookups
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy plook_sample_read on public.price_lookups
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.price_lookups to anon;

-- ============ bank_imports (phase 2 stub) ============
create table public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  filename text not null,
  row_count integer not null default 0,
  status text not null default 'stub' check (status in ('stub','imported','error')),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.bank_imports enable row level security;
revoke all on public.bank_imports from anon, authenticated, service_role;
grant select, insert, update, delete on public.bank_imports to authenticated;
grant select, insert, update, delete on public.bank_imports to service_role;
create policy bimp_owner_all on public.bank_imports
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy bimp_sample_read on public.bank_imports
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select on public.bank_imports to anon;
