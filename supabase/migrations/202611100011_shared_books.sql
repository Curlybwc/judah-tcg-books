-- Migration 011 — shared sets of books (Jen, 2026-11-10, DECISIONS #32).
-- Until now owner_id on every data row named a PERSON (auth uid, or the fixed
-- sample UUID in demo mode). Jen's ruling: books belong to a SET; people are
-- MEMBERS of sets; a person can belong to several sets and switches between
-- them. From this migration on, owner_id names a SET id. Demo mode is
-- untouched: the sample UUID becomes the id of a "Demo books" set with no
-- owner and no members, and every anon sample policy keeps scoping to it.

-- Join codes: 8 characters, no look-alikes (0/O, 1/I/L removed).
create or replace function public.gen_join_code() returns text
language plpgsql as $$
declare code text := ''; chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  for i in 1..8 loop
    code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return code;
end $$;

create table public.book_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  join_code text not null unique default public.gen_join_code(),
  created_at timestamptz not null default now()
);
create table public.book_members (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.book_sets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (set_id, user_id)
);

alter table public.book_sets enable row level security;
alter table public.book_members enable row level security;
revoke all on public.book_sets from anon, authenticated, service_role;
revoke all on public.book_members from anon, authenticated, service_role;
grant select, insert, update, delete on public.book_sets to authenticated, service_role;
grant select, insert, delete on public.book_members to authenticated;
grant select, insert, update, delete on public.book_members to service_role;

-- Membership test used by the policies below and every data-table policy.
-- Security definer so the check reads book_members without recursive
-- policy evaluation.
create or replace function public.is_book_member(p_set uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.book_members m
                  where m.set_id = p_set and m.user_id = auth.uid()) $$;

create policy sets_select on public.book_sets for select to authenticated
  using (owner_user_id = auth.uid() or public.is_book_member(id));
create policy sets_insert on public.book_sets for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy sets_update on public.book_sets for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy sets_delete on public.book_sets for delete to authenticated
  using (owner_user_id = auth.uid());

create policy members_select on public.book_members for select to authenticated
  using (user_id = auth.uid()
         or set_id in (select id from public.book_sets where owner_user_id = auth.uid()));
-- Joining by code goes through join_book_set() below; direct inserts are for
-- a set's owner adding the first (owner) membership row.
create policy members_insert on public.book_members for insert to authenticated
  with check (set_id in (select id from public.book_sets where owner_user_id = auth.uid()));
create policy members_delete on public.book_members for delete to authenticated
  using (user_id = auth.uid()
         or set_id in (select id from public.book_sets where owner_user_id = auth.uid()));

-- The demo set: owns every pre-existing demo row. No owner, no members —
-- reachable only through the anon sample policies, exactly as before.
insert into public.book_sets (id, name, owner_user_id)
values ('11111111-1111-4111-8111-111111111111', 'Demo books', null)
on conflict (id) do nothing;

-- Join a set with its code. The code is the credential, so this runs as
-- definer: the joiner learns the set's name only after joining it.
create or replace function public.join_book_set(p_code text)
returns table (set_id uuid, set_name text)
language plpgsql security definer set search_path = public as $$
declare s public.book_sets;
begin
  select * into s from public.book_sets where join_code = upper(trim(p_code));
  if s.id is null then
    raise exception 'That join code does not match any set of books.';
  end if;
  insert into public.book_members (set_id, user_id, email, role)
  values (s.id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'member')
  on conflict (set_id, user_id) do nothing;
  return query select s.id, s.name;
end $$;

create or replace function public.reset_join_code(p_set uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from public.book_sets
                 where id = p_set and owner_user_id = auth.uid()) then
    raise exception 'Only the owner of a set can reset its join code.';
  end if;
  code := public.gen_join_code();
  update public.book_sets set join_code = code where id = p_set;
  return code;
end $$;

revoke execute on function public.is_book_member(uuid) from public, anon;
revoke execute on function public.join_book_set(text) from public, anon;
revoke execute on function public.reset_join_code(uuid) from public, anon;
grant execute on function public.is_book_member(uuid) to authenticated, service_role;
grant execute on function public.join_book_set(text) to authenticated;
grant execute on function public.reset_join_code(uuid) to authenticated;

-- The swap: every data table's authenticated policy moves from
-- "rows whose owner is me" to "rows whose owner is a set I belong to".
drop policy products_owner_all on public.products;
create policy products_member_all on public.products for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy purchases_owner_all on public.purchases;
create policy purchases_member_all on public.purchases for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy lots_owner_all on public.inventory_lots;
create policy lots_member_all on public.inventory_lots for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy sales_owner_all on public.sales;
create policy sales_member_all on public.sales for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy gpay_owner_all on public.giovanni_payments;
create policy gpay_member_all on public.giovanni_payments for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy plook_owner_all on public.price_lookups;
create policy plook_member_all on public.price_lookups for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy bimp_owner_all on public.bank_imports;
create policy bimp_member_all on public.bank_imports for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy adj_owner_all on public.stock_adjustments;
create policy adj_member_all on public.stock_adjustments for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy shows_owner_all on public.shows;
create policy shows_member_all on public.shows for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy mpay_owner_all on public.mom_payments;
create policy mpay_member_all on public.mom_payments for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
drop policy exp_owner_all on public.expenses;
create policy exp_member_all on public.expenses for all to authenticated
  using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
