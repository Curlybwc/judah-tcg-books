-- DECISIONS #74: where a product's market price came from.
-- 'tcgplayer' = Maven read it off TCGplayer itself via the price door;
-- 'service' = the app's instant price service. Null = unknown/legacy.
alter table public.products
  add column if not exists market_price_source text
  check (market_price_source in ('tcgplayer', 'service'));
