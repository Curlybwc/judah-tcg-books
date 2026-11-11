-- Migration 010 — purchases UPDATE for the demo (anon sample-owner) caller.
-- Found by executing the new Edit Buy flow as anon (Jen, 2026-11-10):
-- migration 002 granted anon INSERT/SELECT/DELETE on purchases but never
-- UPDATE, and no purchases_sample_update policy exists — while products and
-- inventory_lots got both. Authenticated owners were already covered
-- (arwd + purchases_owner_all), so this only bites in demo mode, which is
-- where edits happen today. Grant mirrors the sibling sample policies:
-- sample-owner rows only. (When demo mode ends and 002's anon write policies
-- are dropped, drop this policy too; the grant alone is inert without one.)
GRANT UPDATE ON public.purchases TO anon;

DROP POLICY IF EXISTS purchases_sample_update ON public.purchases;
CREATE POLICY purchases_sample_update ON public.purchases
  FOR UPDATE TO anon
  USING (owner_id = '11111111-1111-4111-8111-111111111111'::uuid)
  WITH CHECK (owner_id = '11111111-1111-4111-8111-111111111111'::uuid);
