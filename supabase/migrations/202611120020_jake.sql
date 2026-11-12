-- 020: Jake — a fourth owner (DECISIONS #67, Jen 2026-11-12). Jake's
-- product also sells on the shared G&J-TCG account as a pass-through:
-- Giovanni pays Judah the gross minus fees; Judah pays Jake the gross
-- minus fees and shipping. His cost basis is his own business (lots
-- may carry 0). jake_payments mirrors giovanni_payments.

alter table public.purchases drop constraint purchases_owner_kind_check;
alter table public.purchases add constraint purchases_owner_kind_check
  check (owner_kind in ('mine','giovanni','split','mom_payback','mom_split','jake'));
alter table public.inventory_lots drop constraint inventory_lots_owner_kind_check;
alter table public.inventory_lots add constraint inventory_lots_owner_kind_check
  check (owner_kind in ('mine','giovanni','split','mom_payback','mom_split','jake'));

create table public.jake_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null,
  note text,
  created_at timestamptz not null default now()
);
create index jake_payments_owner_idx on public.jake_payments(owner_id);

alter table public.jake_payments enable row level security;
revoke all on public.jake_payments from anon, authenticated, service_role;
grant select, insert, update, delete on public.jake_payments to authenticated;
create policy jpay_member_all on public.jake_payments for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
