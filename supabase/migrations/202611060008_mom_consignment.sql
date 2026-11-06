-- Mom funding options (Jen, 2026-11-06): "Mom paid" buys in two flavors —
-- mom_payback (Judah owes Mom the cost back) and mom_split (consignment: on a
-- sale Mom gets her cost back first, then the profit splits at the lot's %).
-- mom_share on a sale row = what that sale put into the "owed to Mom" ledger.

alter table public.purchases drop constraint purchases_owner_kind_check;
alter table public.purchases add constraint purchases_owner_kind_check
  check (owner_kind in ('mine','giovanni','split','mom_payback','mom_split'));
alter table public.inventory_lots drop constraint inventory_lots_owner_kind_check;
alter table public.inventory_lots add constraint inventory_lots_owner_kind_check
  check (owner_kind in ('mine','giovanni','split','mom_payback','mom_split'));

alter table public.sales
  add column if not exists mom_share numeric(12,2) not null default 0;

create table public.mom_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
alter table public.mom_payments enable row level security;
revoke all on public.mom_payments from anon, authenticated, service_role;
grant select, insert, update, delete on public.mom_payments to authenticated;
grant select, insert, update, delete on public.mom_payments to service_role;
create policy mpay_owner_all on public.mom_payments
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy mpay_sample_read on public.mom_payments
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy mpay_sample_write on public.mom_payments
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy mpay_sample_delete on public.mom_payments
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select, insert, delete on public.mom_payments to anon;
