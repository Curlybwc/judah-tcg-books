-- 015: When was this product's market price last checked? (DECISIONS #35,
-- Jen 2026-11-11: "market price to sit next to the inventory… showing as
-- of what date?") The price lookup stamps both the price and the moment
-- it was checked; the stock screen shows "Market $X · as of <date>".
alter table public.products add column if not exists market_price_at timestamptz;
