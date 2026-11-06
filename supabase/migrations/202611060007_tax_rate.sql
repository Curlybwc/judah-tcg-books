-- Tax as a rate (Jen, 2026-11-06): receipts show ONE tax % applied to the whole
-- purchase, so the app takes the rate and calculates the tax dollars itself.
-- The calculated dollars still land in purchases.tax (unchanged math); the rate
-- is kept alongside so the record matches the receipt.
alter table public.purchases
  add column if not exists tax_rate numeric(6,3);
