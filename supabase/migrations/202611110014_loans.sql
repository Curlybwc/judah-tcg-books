-- 014: Loans — money Judah borrowed from people and has to pay back
-- (DECISIONS #34, Jen 2026-11-11). Lender, amount, dates, simple interest
-- (none / flat dollars / percent of principal), and a payment ledger.
-- Member-only like every real-books table: no anon access at all.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  lender text not null,
  principal numeric(12,2) not null check (principal > 0),
  interest_type text not null default 'none' check (interest_type in ('none', 'flat', 'percent')),
  interest_value numeric(12,2) not null default 0 check (interest_value >= 0),
  borrowed_on date not null,
  due_on date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  loan_id uuid not null references public.loans(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index loans_owner_idx on public.loans (owner_id);
create index loan_payments_loan_idx on public.loan_payments (loan_id);

alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;

revoke all on public.loans from anon, authenticated, service_role;
revoke all on public.loan_payments from anon, authenticated, service_role;
grant select, insert, update, delete on public.loans to authenticated;
grant select, insert, update, delete on public.loan_payments to authenticated;

create policy loans_member_select on public.loans for select to authenticated
  using (public.is_book_member(owner_id));
create policy loans_member_insert on public.loans for insert to authenticated
  with check (public.is_book_member(owner_id));
create policy loans_member_update on public.loans for update to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
create policy loans_member_delete on public.loans for delete to authenticated
  using (public.is_book_member(owner_id));

create policy loan_payments_member_select on public.loan_payments for select to authenticated
  using (public.is_book_member(owner_id));
create policy loan_payments_member_insert on public.loan_payments for insert to authenticated
  with check (public.is_book_member(owner_id));
create policy loan_payments_member_update on public.loan_payments for update to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
create policy loan_payments_member_delete on public.loan_payments for delete to authenticated
  using (public.is_book_member(owner_id));
