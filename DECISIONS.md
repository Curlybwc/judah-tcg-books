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

20. **In-app update button (Jen, 2026-11-07).** The PWA already ran
    registerType autoUpdate (new service workers activate in the background and
    land on the next reopen), but there was no way to pull a change down on
    demand. Home now has a "🔄 Check for updates" button (src/lib/pwa.ts): it
    forces a registration update check, waits for the new worker to take
    control, and reloads into the new version, landing on a "✓ App updated"
    note. If there's nothing new it says "You're up to date ✓". While the app
    sits open it also pokes an update check every 30 minutes and whenever it
    returns to the foreground — staging only, never a surprise reload in the
    middle of an entry. Books are never touched by an app update: they live in
    Supabase / on-phone storage, not in the app files.

19. **Mom's formula, settled by Jen (2026-11-07) — supersedes the two-mode
    economics in #17.** There is ONE rule for anything Mom paid for: Judah owes
    her (a) the item's full cost, entered on the ledger at purchase, plus
    (b) 50% of the sale's ACTUAL profit when it sells — profit in the app's
    existing sense: what he got for it after TCGplayer fees and shipping paid,
    minus the item's cost. `momProfitShare(profit) = round2(profit × 0.5)`,
    signed, so a losing sale shares the loss 50/50 too. The UI now offers a
    single "Mom paid" option (stored as mom_payback); mom_split rows, if any
    ever exist, are treated identically by the store. Two ledger separations
    matter: judah_share on Mom-paid sales stays the FULL net proceeds (Giovanni
    collected all of it and owes it all to Judah; the Mom ledger settles out
    of that) — #17's cut-to-keep was wrong and is reverted. Supplies (sleeves,
    mailers) are NOT netted before the split because the app tracks no expenses
    yet — flagged to Jen as the one gap in "actual profit" (2026-11-07).

18. **Bulk edit stock (Jen, 2026-11-06).** What I Have For Sale gets a Bulk edit
    mode listing EVERY lot (zero-qty rows included — the normal view hides them,
    which is how demo leftovers became invisible-but-present). Select many →
    "Zero out selected" (goes through adjustStock with reason 'other', so the
    paper trail survives) or "Remove selected rows completely" (deletes lot +
    purchase, and the product too when nothing references it; two-tap confirm).
    Rows something already sold from are refused by the store and reported as
    skipped — history is never deleted out from under a sale. Bulk quantity
    edits go DOWN only in v1 (zeroing + removal cover the "I don't have this"
    case Jen raised); count-up corrections have no path yet.

17. **Mom funding options (Jen, 2026-11-06; migration 008).** [Economics
    superseded by #19 the next day — the tables/kinds from this entry stand;
    the split rule and judah_share treatment do not.] Two owner kinds
    join mine/giovanni/split: `mom_payback` — Mom fronted the cost; the full
    total_cost enters the owed-to-Mom ledger until repaid; sale proceeds are
    Judah's. `mom_split` — consignment: on a sale, `momSplitMath` gives Mom her
    cost back first, then the PROFIT splits at the lot's judah_pct (which on
    these lots means Judah's share OF THE PROFIT, unlike Giovanni splits where
    the % is of net proceeds); a losing sale sends all proceeds to Mom. The
    sale's mom_share lands in the same ledger; on TCGplayer sales judah_share
    is reduced to Judah's keep so Giovanni's balance stays honest. The ledger
    lives on Check My Profit ("You owe Mom" card + repay logging + deletable
    history, mom_payments table) — Home keeps its six buttons.

16. **Tax as a rate (Jen, 2026-11-06; migration 007).** The buy flow takes the
    tax RATE % off the receipt and calculates the dollars (`taxFromRate` =
    subtotal × rate), because a receipt shows one rate for everything on it,
    not a per-item tax total. The calculated dollars still land in
    purchases.tax (all downstream math unchanged); the rate is stored in
    purchases.tax_rate so the record matches the receipt. The rate field
    remembers the last rate used (localStorage) since most buys are local.
    Show buys stay tax-free (rate 0).

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
