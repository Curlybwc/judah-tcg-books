-- 009: Books & Taxes (expenses) + product photos (Jen, 2026-11-07).
-- expenses: manual business expenses (supplies, postage, advertising, other)
-- that feed the Schedule C page. products.image_url: his own photo or the
-- online product image. Storage bucket 'product-photos' holds uploads.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null,
  category text not null check (category in ('supplies','postage','advertising','other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
revoke all on public.expenses from anon, authenticated, service_role;
grant select, insert, delete on public.expenses to anon, authenticated;
grant all on public.expenses to service_role;

drop policy if exists exp_owner_all on public.expenses;
create policy exp_owner_all on public.expenses
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists exp_sample_read on public.expenses;
create policy exp_sample_read on public.expenses
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111');
drop policy if exists exp_sample_insert on public.expenses;
create policy exp_sample_insert on public.expenses
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111');
drop policy if exists exp_sample_delete on public.expenses;
create policy exp_sample_delete on public.expenses
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111');

alter table public.products add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists jtb_photos_read on storage.objects;
create policy jtb_photos_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-photos');
drop policy if exists jtb_photos_insert on storage.objects;
create policy jtb_photos_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-photos');
drop policy if exists jtb_photos_update on storage.objects;
create policy jtb_photos_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');
drop policy if exists jtb_photos_delete on storage.objects;
create policy jtb_photos_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'product-photos');
