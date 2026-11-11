-- DECISIONS #51: postage for TCGplayer orders comes out of Mom's bank
-- account (the family Pirate Ship account draws on it), so every sale
-- records who fronted its shipping. Mom-paid postage joins the
-- owed-to-Mom ledger; it no longer counts as Judah-fronted for
-- Giovanni's settlement.
alter table public.sales
  add column if not exists ship_paid_by text not null default 'judah';
alter table public.sales
  drop constraint if exists sales_ship_paid_by_check;
alter table public.sales
  add constraint sales_ship_paid_by_check check (ship_paid_by in ('judah', 'mom'));
