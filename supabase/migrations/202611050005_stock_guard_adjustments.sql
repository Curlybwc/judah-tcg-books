-- Pre-real-use pack (Jen approved 2026-11-06): stock guard + stock adjustments.
-- 1) Stock can never go negative at the data layer.
alter table public.inventory_lots
  add constraint inventory_lots_qty_nonnegative check (qty_on_hand >= 0);

-- 2) Stock adjustments: removing stock without a sale (damaged / kept / returned /
--    lost), with a reason trail.
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  lot_id uuid references public.inventory_lots(id) on delete set null,
  product_name text not null,
  qty_removed integer not null check (qty_removed > 0),
  reason text not null check (reason in ('damaged','kept','returned','lost','other')),
  created_at timestamptz not null default now()
);
alter table public.stock_adjustments enable row level security;
revoke all on public.stock_adjustments from anon, authenticated, service_role;
grant select, insert, update, delete on public.stock_adjustments to authenticated;
grant select, insert, update, delete on public.stock_adjustments to service_role;
create policy adj_owner_all on public.stock_adjustments
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy adj_sample_read on public.stock_adjustments
  for select to anon using (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
create policy adj_sample_write on public.stock_adjustments
  for insert to anon with check (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
grant select, insert on public.stock_adjustments to anon;
