-- Fix bundle (Jen approved 2026-11-05): duplicate-import guard + undo support.
-- 1) A sale from the same order, for the same product, same qty and same line
--    total can only exist ONCE per owner. Partial: manual rows without an
--    order_id are exempt.
create unique index if not exists sales_no_duplicate_import
  on public.sales (owner_id, order_id, product_name, qty, item_price)
  where order_id is not null;

-- 2) Undo needs DELETE for the demo (sample-owner) path; authenticated owners
--    already have delete via their FOR ALL policies.
create policy sales_sample_delete on public.sales
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant delete on public.sales to anon;

create policy purchases_sample_delete on public.purchases
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant delete on public.purchases to anon;

create policy lots_sample_delete on public.inventory_lots
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant delete on public.inventory_lots to anon;

create policy gpay_sample_delete on public.giovanni_payments
  for delete to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant delete on public.giovanni_payments to anon;
