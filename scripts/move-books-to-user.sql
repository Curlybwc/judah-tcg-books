-- Move the demo (sample-owner) books to a real signed-in user.
-- Run ONCE, after Judah's first Google sign-in creates his auth user.
-- 1) Find his uid:   select id, email from auth.users order by created_at;
-- 2) Replace :target below with that uid and run the whole file via:
--    sb query --ref zjsxplnyphejklsdhqxz --sql-file scripts/move-books-to-user.sql
-- Rows are re-tagged, never copied — the books themselves move. Product
-- photo URLs keep working (public bucket paths are not owner-checked).
begin;
update public.products          set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.purchases         set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.inventory_lots    set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.sales             set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.stock_adjustments set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.shows             set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.giovanni_payments set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.mom_payments      set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.expenses          set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.bank_imports      set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
update public.price_lookups     set owner_id = :target where owner_id = '11111111-1111-4111-8111-111111111111';
commit;
