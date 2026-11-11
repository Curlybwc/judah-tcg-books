-- USED 2026-11-10 (with a correction): Maven ran this as written and it
-- created a NEW set even though Jen had already created her own ("Bahr
-- TCG") from the gate screen minutes earlier. The inventory was re-tagged
-- into HER set the same evening and the script-created set deleted.
-- LESSON, if anything like this runs again: check for a set the owner
-- already created FIRST and re-tag into that one.
-- Claim the demo books as Jen's first shared set (DECISIONS #32).
-- Run ONCE, after Jen's first Google sign-in creates her auth user.
-- 1) Find her uid:  select id, email from auth.users order by created_at;
-- 2) Replace :jen_uid below with it and run the whole file via sb query.
-- Creates the set under her, makes her its owner-member, and re-tags every
-- demo row to the set. The final select returns the JOIN CODE — Jen gives
-- it to Judah; he signs in with his own Google account and joins with it.
begin;
insert into public.book_sets (id, name, owner_user_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Judah TCG Books', :jen_uid);
insert into public.book_members (set_id, user_id, email, role)
select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', id, email, 'owner' from auth.users where id = :jen_uid;
update public.products          set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.purchases         set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.inventory_lots    set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.sales             set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.stock_adjustments set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.shows             set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.giovanni_payments set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.mom_payments      set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.expenses          set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.bank_imports      set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
update public.price_lookups     set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' where owner_id = '11111111-1111-4111-8111-111111111111';
commit;
select name, join_code from public.book_sets where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
