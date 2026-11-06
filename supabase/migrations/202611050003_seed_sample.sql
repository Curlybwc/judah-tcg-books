-- Seed sample data under the sample owner. Hand-checkable numbers (see README self-test).
-- Sample owner: 11111111-1111-4111-8111-111111111111

insert into public.products (id, owner_id, name, barcode, product_type, market_price) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Scarlet & Violet 151 Elite Trainer Box', '196214123922', 'sealed', 84.99),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Prismatic Evolutions Booster Bundle', '196214123953', 'sealed', 54.99),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', 'Charizard ex Premium Collection', '196214110076', 'sealed', 119.99),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '11111111-1111-4111-8111-111111111111', 'Pikachu VMAX (single)', null, 'single', 12.50)
on conflict (id) do nothing;

-- Purchase 1 (the self-test purchase): 4 x 151 ETB @ $55, tax $18.00, shipping in $12.00
-- total = 220 + 18 + 12 = 250.00 ; cost basis/unit = 62.50
insert into public.purchases (id, owner_id, product_id, product_name, qty, unit_price, tax, shipping_in, total_cost, cost_basis_unit, owner_kind, judah_pct, paid_via, purchased_on) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Scarlet & Violet 151 Elite Trainer Box',
   4, 55.00, 18.00, 12.00, 250.00, 62.5000, 'mine', 100, 'USAA', current_date - 6)
on conflict (id) do nothing;

-- Purchase 2: 6 x Prismatic bundle @ $32, tax $0, shipping $0 -> basis 32.00, split 50/50
insert into public.purchases (id, owner_id, product_id, product_name, qty, unit_price, tax, shipping_in, total_cost, cost_basis_unit, owner_kind, judah_pct, paid_via, purchased_on) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Prismatic Evolutions Booster Bundle',
   6, 32.00, 0, 0, 192.00, 32.0000, 'split', 50, 'Cash', current_date - 3)
on conflict (id) do nothing;

insert into public.inventory_lots (id, owner_id, product_id, purchase_id, qty_on_hand, cost_basis_unit, owner_kind, judah_pct) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 4, 62.5000, 'mine', 100),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 6, 32.0000, 'split', 50)
on conflict (id) do nothing;
