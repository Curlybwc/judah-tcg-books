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

22. **Home hero is Judah's profit, not Giovanni's balance (Jen, 2026-11-07).**
    Jen questioned Giovanni front-and-center and ruled: the big card is now
    "Your profit — all time" (store.totalProfit — the same sum as Profit's
    all-time card). Giovanni is one slim line under it, amber when he actually
    owes something, and tapping the line opens Giovanni Paid Me. The full
    Giovanni card and ledger stay on Check My Profit, and the sale flow still
    ends with his collected/owed numbers — the balance shouts at the two
    moments it matters and sits quiet the rest of the time.

21. **Real prices via TCG API (Jen, 2026-11-07).** Provider chosen on
    evidence: TCGplayer grants no new keys; pokemontcg.io closed new
    registrations (keys die 2027-03-01) and never priced sealed; JustTCG is
    cards-only. TCG API (tcgapi.dev) prices TCGplayer's catalog INCLUDING
    sealed product, free tier 100 lookups/day, no card, X-API-Key header on
    api.tcgapi.dev/v1/search. The account is Jen's (their terms require 18+).
    The key is entered in the app (Account → Real prices) and kept per device
    in localStorage (jtb-tcgapi-key) — never in the repo; a Supabase
    edge-function proxy is the upgrade path if browser calls ever get blocked
    or the key needs to follow his login. Successful lookups cache 12h
    (jtb-price-cache) against the quota. Any failure (no key, bad key, quota,
    no match) falls back to the SAMPLE provider with the chip saying why —
    prices never silently pretend. Terms note flagged to Jen: free tier is
    personal-use licensed; commercial tier is $49.99/mo if the shop outgrows it.

25. **Product photos (Jen, 2026-11-07; migration 009).** Every for-sale
    product can carry a picture, shown in What I Have For Sale and on Scan for
    Price results. Two sources: (a) his own photo — the Buy flow's photo
    button (which existed since the overnight build but only set a name —
    now it actually attaches) and "Add/Change photo" on the stock card;
    photos are shrunk to 800px JPEG on the phone, then uploaded to the public
    Supabase Storage bucket 'product-photos' (on-phone mode keeps a small
    data URL instead). (b) the online product image — "Find online photo"
    pulls image_url from the TCG API match (needs the price key; without it
    the button says so). products.image_url holds whichever was set last.

24. **Books & Taxes page + expenses (Jen, 2026-11-07; migration 009).** A
    ledger page under Check My Profit ("🧾 Books & Taxes") shaped like
    Schedule C: pick a year → Line 1 gross receipts (item totals + shipping
    charged), Line 4 COGS (cost of items actually sold), Line 7 gross profit,
    expenses (Line 10 TCGplayer commissions & fees, postage/shipping paid,
    show table fees, plus manual expenses by category), Line 28 total,
    Line 31 net — with the cross-check printed on the page (net must equal
    sales profit − table fees − manual expenses; math.taxSummary, unit-tested)
    and a CSV download of the summary + full sales/expense detail for the
    preparer. Manual expenses live in the new `expenses` table (supplies /
    postage / advertising / other, each labeled with its Schedule C line) and
    are logged from the Books page itself. This closes the audit's expenses
    gap AND gives the business real books; supplies are period expenses here
    and are NOT netted per-sale before Mom's 50/50 split (#19 stands — the
    split runs on the sale's own profit). [Superseded in part by #27: the
    supplies category came out of the logger — supplies are Mom-provided and
    untracked in Judah's books.]

23. **Balances live only under Check My Profit (Jen, 2026-11-07).** Minutes
    after #22, Jen simplified further: the Giovanni slim line came off Home
    too. Home now carries exactly one number — the profit hero. What Giovanni
    owes and what Judah owes Mom are both on Check My Profit (where their
    cards, repayment loggers, and full history already lived).

26. **Quick Add + in-app barcode scanner (Jen, 2026-11-07).** Mined from
    Jen's earlier Lovable app "Card Splitter" at her direction, after a full
    code read of that project. Three of its features fit Judah; two were
    deliberately NOT ported (its sale-by-sale transfer reconciliation —
    complexity this app exists to avoid; its Collectr screenshot import —
    built for singles collections, needs an AI backend). Ported: (a) Quick
    Add screen — paste a list (pipe/comma/loose formats, lib/quickbuy.ts,
    unit-tested) or dictate items (Web Speech API; the parser understands
    number words incl. hundreds), review/edit all rows, then save the batch
    with one owner, one payment method, one tax rate, and one shipping
    charge allocated across lines by value. (b) Camera barcode scanner in
    the Buy flow (BarcodeDetector — native in Chrome on Android, which is
    Judah's only device; unsupported browsers get an honest type-it message).

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
    [Closed by ruling #27 the same day: supplies are not netted because they
    are Mom-provided and de minimis, not because they were untracked.]

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

27. **Supplies are Mom-provided, de minimis, and untracked (Jen, 2026-11-07).**
    In Jen's words: "Supplies are really a small expense, and most of the boxes
    are coming from my Amazon orders anyway. I'm the one who bought him a bunch
    of 4x6 envelopes already." So: no supplies entry for Judah — shipping
    supplies are mostly Mom's own purchases, they are NOT a Judah-paid cost,
    and they are NOT netted out of his profit before the Mom split. The Mom
    formula stands exactly as built in #19 (full purchase price back + 50% of
    profit after fees and shipping paid). The Supplies category was removed
    from the Books & Taxes expense logger the same day; postage, advertising,
    and other expenses Judah actually pays remain loggable.

28. **Own-library barcode lookup (Jen, 2026-11-07).** Jen asked the right
    question — a scanner with no library identifies nothing — and ruled out
    the online-library route after the evidence: UPCitemdb's free tier is
    per-IP capped (Maven's live test of three real Pokémon UPCs returned
    "rate limit exceeded" on all three) and its names are retail-messy;
    TCG API (the price key) has no barcode lookup at all (full docs checked).
    So the Buy flow now checks every typed/scanned barcode against Judah's
    OWN products first: a match fills the product name in automatically and
    shows the last price he paid for it; an unmatched barcode shows "it'll be
    remembered when you save" — and it is, on the product, so the library
    grows with every first-time buy. No internet, no quota, no cost.

29. **Starter barcode library, seeded once from TCGplayer's catalog (Jen,
    2026-11-07).** Jen's correction to #28: an own-library that starts empty
    helps nobody on day one — seed it. There is no downloadable CSV of
    Pokémon UPCs to import (she offered to go find one; Maven built it
    instead). Source: TCGplayer's own catalog as republished daily by the
    community service TCGCSV (tcgcsv.com) — all 221 Pokémon groups pulled
    2026-11-07, 959 raw UPC rows → 485 seeded after cleaning: code cards
    excluded, GTINs normalized to the 12-digit UPC form, 55 barcodes dropped
    where sources genuinely disagreed, and 114 assortment barcodes (one code
    covering several art variants — mini tins, sticker collections) kept
    under their shared product name and flagged so the app warns Judah to
    check the exact name. Two unit UPCs TCGplayer lacks were added only with
    two independent retailer listings agreeing (Prismatic Evolutions Booster
    Bundle 196214112544; 151 Elite Trainer Box 820650853159); several others
    (Prismatic ETB, Destined Rivals ETB) had conflicting retailer UPCs and
    were deliberately left out — a wrong auto-fill is worse than none.
    Coverage honesty: 391 unit-level + 92 case/display rows; TCGplayer
    carries no UPC at all for many unit ETBs (151's among them), so first
    scans of those still teach the library via #28. The seed ships INSIDE
    the app (src/lib/catalog.ts, generated from data/pokemon-upc-seed.csv)
    so it works offline and in on-phone mode; lookup order is own products →
    starter library → new-barcode path. The two demo products' invented
    barcodes were corrected to the verified UPCs above (cloud + local seed).

30. **Edit a buy (Jen, 2026-11-10).** Jen: "there's not really any way to edit
    something once I've put it in." True — buys were write-once except undo.
    Now every stock row on the Inventory screen has **✏️ Edit buy**: product
    name, UPC/barcode (typed or scanned; a changed barcode is checked against
    the starter library), how many bought, price each, tax rate %, shipping
    in, whose it is (Mine / Giovanni's / Split % / Mom paid), and how it was
    paid for (USAA / Cash / Other) — her two named Delta Reign fixes (add the
    UPC, change who paid) are both in the panel. Bookkeeping rule: sales
    already recorded keep the numbers they were saved with — the edit changes
    the purchase, the remaining stock, and future sales, and the panel says
    so when the lot has sales. Quantity can never drop below what already
    sold or left the lot. Cost basis and totals recompute from the same math
    module as a fresh buy.
    **Migration 010** (found by executing the flow as the app's anon caller):
    migration 002 never granted anon UPDATE on purchases and no sample-update
    policy existed — products/lots had both, purchases didn't. Authenticated
    owners were unaffected; demo mode (today's mode) would have failed every
    edit. Granted + policy added, sample-owner-scoped like its siblings;
    verified as anon incl. a wrong-owner update touching 0 rows.

31. **Sign in with Google (Jen, 2026-11-10).** Jen ruled the demo label ends
    via a real sign-in and chose Google over email/password ("can we sign in
    with google" → "Set up Sign in with Google"). Shape: the Account screen
    leads with a **Sign in with Google** button (Supabase OAuth; redirectTo =
    the app URL; the shell already picks the session up on return). The
    one-time provider setup is split the only way it can be: the OAuth client
    is created in Jen's Google Cloud Console (her account owns it) with the
    Supabase callback as its only redirect URI, and Maven enables the Google
    provider + site/redirect URLs in Supabase via the Management API
    (sb_auth_config.py, added to the custom.supabase connector bin — stdin
    carries the client secret; it is never filed, logged, or shown). Consent
    screen publishes to production (basic identity scopes only) so any
    Google account in the family can sign in. Once Judah signs in, his rows
    migrate from the sample owner to his uid (his books already hold 12
    purchases incl. Jen's entries — see #30-era data), and migration 002's
    demo-write policies can finally be dropped.
    Outcome (same evening): Google Cloud project "judah-tcg-books" created
    under Jen's account; consent screen PUBLISHED ("In production", no
    verification needed — basic scopes only) with the app page as homepage
    and a plain privacy page (public/privacy.html, live on the site) as the
    policy URL; OAuth web client created with the Supabase callback as its
    only redirect URI; Supabase provider enabled via Management API with
    site_url + uri_allow_list set to the app URL. Verified: the Supabase
    authorize endpoint 302s to Google carrying the right client ID, and the
    live bundle carries the button. Last proof is Judah's first real
    sign-in. Migration of his rows is pre-written:
    scripts/move-books-to-user.sql (re-tag owner, run once his auth user
    exists; then drop 002's demo policies per the original plan).

32. **Shared sets of books (Jen, 2026-11-10).** Jen: she will not sign in as
    Judah (his Google isn't on her phone); books must be shareable — she
    invites him to HER set, a person can belong to several sets, and a
    dropdown switches between them. Built (migrations 011 + 012): book_sets
    (name, owner, 8-character join code) + book_members; **owner_id on every
    data row now names a set**, and all eleven authenticated policies moved
    from "owner is me" to "I belong to the set that owns this" via the
    security-definer is_book_member(). Joining is the join_book_set() RPC —
    the code is the credential; reset_join_code() is owner-only. The demo
    books became a set (id = the old sample UUID, no owner, no members), so
    demo mode behaves exactly as before. App: boot resolves the current set
    from memberships (last-used remembered); the header shows the set name
    or, with several sets, the switcher dropdown; a signed-in user with no
    set lands on a create/join gate; Account carries the sets manager
    (codes, rosters, remove/leave). Two-user caller proofs passed (member
    sees + writes; non-member sees 0 rows and is refused writes into other
    sets; lowercase codes join; non-owner code reset refused; anon unchanged)
    — including one real bug they caught and 012 fixed (the join function's
    OUT column name collided with a table column). Known accepted corners:
    members can read their set's join code from the data (the UI shows it
    only to the owner; the owner can reset it), and product-photo storage
    stays bucket-wide as it has been since #25. Cutover: Jen signs in →
    scripts/claim-demo-books.sql makes her the owner of a set holding every
    demo entry → she gives Judah the code → he signs in with his own Google
    and joins. After the claim, migration 002's anon demo policies can be
    dropped (the demo set will be empty).

#33 — Pirate Ship shipping import + stuck-sync repair (Jen, 2026-11-10).
Jen's question — Pirate Ship DOES export the label history: Ship page →
blank search → Shipments grid → Columns (turn on Order ID + cost) →
Export downloads one row per label with order number, recipient,
tracking and exact postage cost. Built into the Sell flow's "Shipping you
paid" step: "🚢 Fill from a Pirate Ship export" parses the file
(src/lib/pirateship.ts; generous header aliases), totals postage per
TCGplayer order number (split shipments sum), falls back to buyer-name
matching when a label carries no order number, and pre-fills each order's
shipping paid (chip: "🚢 from Pirate Ship"; any manual edit clears the
chip). Unmatched labels are reported, never silently dropped; orders
with no label keep the stamp/envelope presets. Sample file at
/sample-pirateship.csv; tests in scripts/test-pirateship.mjs.
SAME PASS, the stuck-sync repair: Jen had 3 items "waiting to sync" that
could never land — outbox rows are stored with the set they were written
in, and that set (her first Bahr TCG, or the demo books) no longer
existed, so every retry failed its membership check silently. runOps now
re-points a queued insert at the currently open set when its recorded
set is not one of the user's sets anymore. (This is also what stranded
the Ascended Heroes mini tins buy mid-save: the product landed, the
purchase + stock rows queued against a set that was deleted minutes
later; after this fix the queue drains into the open set and the buy
completes.)

#34 — Loans he owes + stock search (Jen, 2026-11-11). New Home job:
"💳 Money I Owe." When Judah borrows from a person, he records who,
how much, the date borrowed, a due date (or "no set date"), an optional
note, and interest in the simple forms informal loans actually take:
none, a flat dollar amount, or a percent of what he borrowed — never
compounding (loanMath in math.ts, tested). Each loan shows total to pay
back, paid so far with a progress bar, still-owed, and a due chip that
turns amber inside two weeks and red when overdue; payments are logged
with date + note and can be removed; loans can be edited and deleted;
paid-off loans collect at the bottom. Tables loans + loan_payments
(migration 014), member-only RLS like the rest of the real books
(verified as a caller: member writes, a stranger sees zero, anon is
denied outright, deleting a loan cascades its payments). The Home
button's subtitle carries the live total owed. SAME PASS: 🔍 search on
the stock screen — filters by product name or barcode, in both the
normal view and bulk-edit (select-all respects the search).

#35 — Market prices beside the stock, with the date they were checked
(Jen, 2026-11-11: "a way to look up prices of the inventory I have…
market price to sit next to the inventory… the last time I looked it
up, showing as of what date?"). Migration 015 adds products.
market_price_at. The stock screen now shows, under every product:
"Market $X each · N on hand ≈ $total · as of <date>" — or "on file,
never checked" for the old seeded prices, which keep their SAMPLE chip
until a real lookup replaces them. Two ways to check: 💲 Look up price
on each product, and 💲 Look up all market prices at the top (skips
zero-stock products; the provider's 12-hour cache keeps repeat runs
inside the free quota). store.refreshMarketPrice saves price + stamp
together and the screen labels SAMPLE honestly whenever the provider
answered with sample data (no key on the device yet — the TCG API key
step in Account is still Jen's to do).
