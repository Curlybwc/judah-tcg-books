-- 021: price_requests — the Maven door for prices (DECISIONS #72,
-- Jen 2026-11-13). The app files a request; Maven (Jen's Muse, on
-- her account) picks it up, prices each product from TCGplayer
-- itself, writes market_price back onto products, and closes the
-- request with a per-item report. Judah needs no Muse account —
-- he only taps a button in his own app.
create table public.price_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  requested_by uuid,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','working','done','failed')),
  report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.price_requests enable row level security;
revoke all on public.price_requests from anon, authenticated, service_role;
grant select, insert, update on public.price_requests to authenticated;
create policy price_requests_member_all on public.price_requests
  for all to authenticated
  using (is_book_member(owner_id)) with check (is_book_member(owner_id));
