-- 018 — Shared book settings: the price key lives in the books (DECISIONS
-- #46, Jen 2026-11-11). The TCG API key was stored per device/browser, so
-- every new phone or browser silently fell back to SAMPLE prices. Now the
-- key is a row in the set's own settings: members read/write it, it works
-- on every device in the set, and nobody outside the set (including
-- signed-out visitors) can read it — no anon access at all.
create table public.book_settings (
  owner_id uuid primary key,
  tcg_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.book_settings enable row level security;

revoke all on public.book_settings from anon, authenticated, service_role;
grant select, insert, update on public.book_settings to authenticated;

create policy book_settings_select on public.book_settings
  for select to authenticated using (public.is_book_member(owner_id));
create policy book_settings_insert on public.book_settings
  for insert to authenticated with check (public.is_book_member(owner_id));
create policy book_settings_update on public.book_settings
  for update to authenticated using (public.is_book_member(owner_id)) with check (public.is_book_member(owner_id));
