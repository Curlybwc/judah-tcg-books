-- Show mode (Jen approved 2026-11-06): show sessions, show-tagged buys/sales,
-- and a sales channel so in-person show sales (cash/Venmo, no TCGplayer fees)
-- are first-class records instead of fake CSV rows.

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  show_date date not null default current_date,
  table_fee numeric(12,2) not null default 0,
  cash_float numeric(12,2) not null default 0,
  cash_counted numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
alter table public.shows enable row level security;
revoke all on public.shows from anon, authenticated, service_role;
grant select, insert, update, delete on public.shows to authenticated;
grant select, insert, update, delete on public.shows to service_role;
create policy shows_owner_all on public.shows
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shows_sample_read on public.shows
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy shows_sample_write on public.shows
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy shows_sample_update on public.shows
  for update to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid)
  with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select, insert, update on public.shows to anon;

alter table public.purchases
  add column if not exists show_id uuid references public.shows(id) on delete set null;

alter table public.sales
  add column if not exists show_id uuid references public.shows(id) on delete set null;
alter table public.sales
  add column if not exists channel text not null default 'tcgplayer'
  check (channel in ('tcgplayer','show_cash','show_venmo'));
