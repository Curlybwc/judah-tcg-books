-- Migration 013 — demo mode is over (Jen signed in 2026-11-10 and the demo
-- books were claimed into her shared set, scripts/claim-demo-books.sql).
-- Drop every anon WRITE policy from migrations 002/004/008/009/010. The
-- *_sample_read policies stay: a signed-out visit now reads the (empty)
-- demo set and sees empty books instead of stranger-writable ones.
drop policy bimp_sample_write on public.bank_imports;
drop policy exp_sample_delete on public.expenses;
drop policy exp_sample_insert on public.expenses;
drop policy gpay_sample_delete on public.giovanni_payments;
drop policy gpay_sample_write on public.giovanni_payments;
drop policy lots_sample_delete on public.inventory_lots;
drop policy lots_sample_update on public.inventory_lots;
drop policy lots_sample_write on public.inventory_lots;
drop policy mpay_sample_delete on public.mom_payments;
drop policy mpay_sample_write on public.mom_payments;
drop policy plook_sample_write on public.price_lookups;
drop policy products_sample_update on public.products;
drop policy products_sample_write on public.products;
drop policy purchases_sample_delete on public.purchases;
drop policy purchases_sample_update on public.purchases;
drop policy purchases_sample_write on public.purchases;
drop policy sales_sample_delete on public.sales;
drop policy sales_sample_write on public.sales;
drop policy shows_sample_update on public.shows;
drop policy shows_sample_write on public.shows;
drop policy adj_sample_write on public.stock_adjustments;
