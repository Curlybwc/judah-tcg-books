-- Demo-mode writes: until real Supabase Auth accounts exist (morning step with Judah),
-- the app runs signed-out against the SAMPLE owner only. These policies let anon
-- insert/update rows whose owner_id is exactly the sample UUID — nothing else.
-- DROP THESE POLICIES + the anon grants when real auth goes live (see DECISIONS.md).

create policy products_sample_write on public.products
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy products_sample_update on public.products
  for update to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid)
  with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert, update on public.products to anon;

create policy purchases_sample_write on public.purchases
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert on public.purchases to anon;

create policy lots_sample_write on public.inventory_lots
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy lots_sample_update on public.inventory_lots
  for update to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid)
  with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert, update on public.inventory_lots to anon;

create policy sales_sample_write on public.sales
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert on public.sales to anon;

create policy gpay_sample_write on public.giovanni_payments
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert on public.giovanni_payments to anon;

create policy plook_sample_write on public.price_lookups
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert on public.price_lookups to anon;

create policy bimp_sample_write on public.bank_imports
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant insert on public.bank_imports to anon;
