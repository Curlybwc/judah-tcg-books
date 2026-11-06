# DECISIONS — judgment calls made during the overnight build (2026-11-05)

Jen: flip any of these and the app changes to match. None of them reopen the settled design.

1. **Demo-mode data path.** No real user accounts exist yet (morning step), so the app
   signs in to nothing and runs against seeded sample data under sample owner
   `11111111-1111-4111-8111-111111111111`. Supabase RLS lets `anon` read + write ONLY
   rows with that owner_id (migration `202611050002_demo_writes.sql`). When Judah's real
   account is created, DELETE that migration's policies/grants — the app then uses
   `auth.uid()` automatically and sample data disappears from his view.

2. **On-phone fallback.** If the phone can't reach Supabase (offline, or the project REST
   host is unreachable), the app falls back to the same seed data in localStorage and
   keeps working, showing "On-phone mode". Writes made in fallback live on that phone
   only. Chosen so the no-explanation phone test can never dead-end on a loading screen.

3. **Fee rounding.** Each fee is rounded to the cent when computed (commission, then
   transaction fee), then totals are sums of rounded cents. This matches how TCGplayer
   statements read and makes every number on screen hand-checkable.

4. **Multi-line orders.** The $0.30 transaction flat fee and the shipping-paid amount
   apply ONCE per order, not per CSV row: first row of an order carries both, later
   rows of the same order carry neither. Sales rows are stored per CSV row.

5. **CSV column reading.** TCGplayer's exact export headers vary, so the importer finds
   columns by fuzzy header match (product/item/name, quantity, price, shipping, order,
   date) instead of demanding one exact layout. `Price` is read as the per-unit price;
   line total = price × quantity. Matches to stock are scored by name similarity and
   Judah confirms/corrects every one — no silent auto-match below the confirm step.

6. **Photo identification is a stub.** The photo button opens the camera and holds the
   product slot ("Photo product"), but does not OCR/recognize the product tonight —
   loose ID by typed name is the working path, per the settled design ("loose ID is
   fine"). Barcode is a typed field; the phone's camera app / keyboard scan can fill it.

7. **TCGCSV not wired.** Skipped tonight: wiring TCGCSV's daily bulk files cleanly
   needs a server-side ingest (files are large, update daily) that doesn't belong in a
   phone PWA. The price-provider seam (`src/lib/priceProvider.ts`) is where it lands
   later, next to the TCG API provider. Sample provider ships instead, labeled SAMPLE.

8. **Sample prices are invented demo numbers** for a handful of known products plus a
   deterministic hash price for anything else, so Scan-for-Price always answers in the
   demo. They are labeled SAMPLE everywhere they appear and are NOT market data.

9. **Sales `item_price` is stored as the line total** (unit × qty); the unit price is
   recoverable as item_price / qty. Keeps the profit math auditable from the row alone.

10. **No router, no accounts page beyond sign-in.** Views are state-switched in one
    page (fast, no dead links on a phone). Sign-up is absent from the UI by design —
    Jen creates Judah's account in the Supabase dashboard in the morning.

11. **PWA icons** are a simple self-drawn Poké-ball-style mark (no Nintendo artwork),
    generated locally. Swap freely.

14. **Pre-real-use pack (Jen approved 2026-11-06, audit items 2/6/7).** (a) Stock
    guard at three levels: the Sell flow flags a matched row asking for more than
    the lot holds ("Only N on hand — will be skipped", excluded from math/saving,
    with a hint to pick the other purchase of the same product); the store skips
    overstock rows defensively; the database rejects negative stock with a CHECK
    constraint (migration 005, proved by execution — a −1 update fails 23514).
    A row is never partially fulfilled across lots in v1 — re-match it to the
    right lot instead. (b) Stock adjustments: "Adjust stock" on What I Have For
    Sale removes units without a sale, with a reason (damaged / kept / returned /
    lost / other) written to `stock_adjustments` as the paper trail. (c) The
    Profit screen's stock value now sits under a full-width amber banner:
    "SAMPLE PRICES — demo numbers, NOT real market prices yet."

15. **Show mode (Jen approved + commissioned 2026-11-06).** A show is a session
    (shows table, migration 006): name, date, table fee, starting cash float,
    closing cash count. Buys and sales made during it carry `show_id`; in-person
    sales carry `channel` = show_cash / show_venmo (TCGplayer rows = 'tcgplayer').
    Show sales use `quickSaleMath` — no fees, no shipping, profit = price − basis.
    (a) **Giovanni's balance is TCGplayer-only.** He never touches show cash —
    Judah holds it himself — so show sales are excluded from giovanniOwed even
    though their rows carry a judah_share for profit reporting. Settling a split
    lot sold at a show happens in person at the table in v1. (b) **Cash box** =
    float + cash sales − cash buys (Venmo excluded — it isn't in the box); the
    wrap-up screen compares it to the counted cash and flags a difference before
    closing. (c) **Show profit** = profit on what sold − table fee; money spent
    on new stock is shown separately (it's inventory, not an expense).
    (d) **Offline outbox**: show-mode writes (and all buys) apply on the phone
    first and push through a localStorage outbox when signal returns; client
    UUIDs make retried inserts safe (23505 = already applied). A pending count
    shows on Home and in Show Mode with a tap-to-sync button, and the app
    auto-syncs on launch. Non-show TCGplayer imports still save directly.
    (e) Buy-at-show market helper offers 50/60/70/80% of the (SAMPLE) market
    price as one-tap offer prices — buylist discipline as a glance, not math.

13. **Fix bundle (Jen approved 2026-11-05, audit items 1/4/15).** (a) Duplicate-import
    guard at two levels: the app flags CSV rows whose order + product + qty + line
    total already exist ("Already imported — will be skipped", excluded from math and
    saving), and the database enforces it with the partial unique index
    `sales_no_duplicate_import` (migration 004) — a duplicate insert fails with 23505
    even if the UI is bypassed. (b) Undo: sales can be undone from Check My Profit
    (stock returns to the lot), a buy can be undone from What I Have For Sale while
    nothing has sold from that lot (blocked afterward), and Giovanni payments can be
    deleted from the new payment-history list on the Profit screen. All undo buttons
    are two-tap (tap → "tap again to confirm"). (c) The 19-assertion math test is
    committed as `scripts/test-math.mjs` — run `npm test` after touching fee math.

12. **Deployed to GitHub Pages** (repo is public, Pages is free) at
    https://curlybwc.github.io/judah-tcg-books/ so the morning phone test needs no
    hosting setup: open the link, Add to Home Screen. Vite `base` is set from the
    `PAGES_BASE` env var only for the Pages build; local dev keeps base `/`.
    If Jen later wants the repo private, move hosting to Netlify/Vercel free tier —
    the app itself doesn't change.
