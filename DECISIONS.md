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

#36 — Who Owes Who: one home for every balance (Jen, 2026-11-11,
designed with her across the morning). She kept finding balances in
three places (Giovanni Paid Me, the Mom card inside Check My Profit,
Money I Owe) and ruled they belong under one button. The hub (Home:
"🤝 Who Owes Who", subtitle carries both totals) holds: Giovanni's
settlement (your share of TCGplayer sales + shipping fronted on his
product − Zelles received; his own product's net shown as his, in his
hands) with the "He paid me" logger and history; the Mom tab with I
paid Mom (moved out of Profit); the loans (borrow/pay/edit, unchanged);
and Spent on product by person (Giovanni/Judah/Mom/Split, live from
purchases). Check My Profit is the report card again — profit cards,
stock value, recent sales — with one pointer button to the hub.
Giovanni Paid Me and Money I Owe as separate screens are retired.
TWO RULES SETTLED BY JEN IN THIS DESIGN: (1) Judah takes NO cut of
Giovanni's product (judah_pct 0 stands); (2) shipping Judah fronts on
Giovanni's TCGplayer sales is Giovanni's cost — frontedShipping() in
math.ts adds it to what Giovanni owes (store giovanniOwed, hub
breakdown line, and the Sell flow's done screen all include it).
Mom/split shipping still nets through profit share, unchanged.

#37 — "What I Have For Sale" is now "Inventory", and you can add stock
from it (Jen, 2026-11-11). Home button and screen title renamed; the
Inventory screen opens with a "＋ Add inventory — I bought product"
button that runs the normal Buy flow, whose done screen already
returns here ("See inventory"). Search, price lookups, photos, edit
buy, and bulk edit were already on this screen — it is now the single
home for stock, not just a viewing list.

#38 — Fewer words; Inventory is the one stock door (Jen, 2026-11-11:
"you always use more words than necessary"). Home is now: Inventory ·
Show Mode · Sales · Price Scanner · Who Owes Who · Profit. Renames:
"I Sold on TCGplayer" → Sales; "Scan for Price" → Price Scanner;
"Check My Profit" → Profit (screen titles match). "I Bought Product"
and "Quick Add" lost their Home buttons — both live inside Inventory
now (＋ Add inventory + ⚡ Quick Add buttons at its top), and both
flows already return to Inventory when saved. Who Owes Who: Jen
considered "Debt," ruled LEAVE IT FOR NOW. Shipping has no button of
its own — shipping in rides inside each buy's cost basis; shipping out
is per-order in Sales (or auto-filled from Pirate Ship). A standalone
"Costs" totals button was floated, not ruled.

#39 — Housekeeping to the bottom; the profit hero is the Profit button
(Jen, 2026-11-11). Home order now: profit hero (tap it — it IS the
Profit button; "we don't need extra buttons if one can do two
things"), the sync banner when items are waiting, the six job buttons,
Bank, then Account / Sign In and Check for updates at the very bottom
where settings belong. This supersedes #33's move of Check for updates
to the top — that fixed findability the wrong way; Jen's settled
layout is jobs first, housekeeping last.
#40 — Price lookups route through the cloud books (Jen's key test failed,
2026-11-11). Root cause, verified: tcgapi.dev works fine server-side
(a bad key gets its real "invalid key" answer), but its CORS policy
allows only its own origin — the browser app can NEVER call it
directly, so every test said "didn't answer" no matter how good the
key was. Jen's copy was fine; the app's wiring was wrong. Fix:
migration 016 adds price_lookup_start / price_lookup_result RPCs
(pg_net) — the app hands the cloud books the product name and the
user's own key per call (key never stored server-side), the database
fetches, the app polls for the answer (~5-10s). Failures now surface
the service's actual words instead of "didn't answer." Verified as the
anon app role with a dummy key: the service's real 401 message came
back through the RPC.
#41 — The Account test tells the truth now (Jen, 2026-11-11: the service
"is, in fact, answering"). The old test threw away the real reason and
printed one blanket message — "the key didn't answer, check it was
copied whole" — for every failure, including "answered fine, found no
product with that name" (which is what her working key actually got for
the hard-coded 151 ETB test name: 200, empty data). The test now looks
up "Charizard" (proves the key against a name their catalog surely
has) and, on sample fallback, quotes the provider's actual reason
verbatim. Rule going forward: a failure message repeats what the other
side actually said, never a guessed cause.
#42 — Price matching tells the truth (Jen's live tests, 2026-11-11).
Her scan of the 30th Celebration UPC quoted $1,495.75 — the CASE price:
the matcher fell back to the first search result when nothing matched
exactly. Her kids sell the single UPC for ~$400. Fixes: (1) no silent
first-result fallback — exact/contains wins, else token overlap ≥ 0.7,
else the scanner shows up to 3 choices ("Which one is it?") and
Inventory leaves the price untouched and reports the miss; (2) a CASE
never matches a name that doesn't say case; (3) hyphens vanish in
normalization (their catalog writes "ultrapremium"); (4) shop slang
expands before searching — upc → ultra premium collection, etb → elite
trainer box — because "30th celebration upc" otherwise finds NOTHING
in their library (the product is there, filed as "30th Celebration
Ultra-Premium Collection"); (5) store.refreshMarketPrice no longer
saves SAMPLE or uncertain prices into a product's market price — it
had been writing them. Also confirmed from her screenshots + the
pg_net log: Charizard $4.11 real, 151 ETB $493.08 real (exact name
"151 Elite Trainer Box" — the long "Scarlet & Violet …" form returns
zero results from their search).
#43 — Photo scans identify products; Inventory renames to their exact
name (Jen's loop, 2026-11-11). tcgapi.dev DOES have photo search —
POST /v1/identify, 25 scans free ONCE per account, then ~1.5¢/scan
packs; Maven's "photos — no" answer was wrong (it covered only the
name-search endpoint) and Jen caught it from their pricing page.
Design (hers): scan a product once → get the catalog's exact name →
rename the app product to it → every later lookup is a free name
search; scans are spent only on first identification. Built: migration
017 identify_start RPC (JSON data-URL body, same pg_net proxy ride,
verified with a dummy key); Price Scanner's photo button is real
(matched → price card with their name; ambiguous → pick; retake →
their words + retry); Inventory has "📷 Fix name by photo" per product
— tap a candidate to rename + save its price in one action
(store.applyIdentified). Scans remaining shows after each scan.
#44 — Fix name tries the FREE name search first (Jen, 2026-11-11: "what
if it can already find it with the current name?"). The #43 button
spent a photo scan immediately. Now: tap 🏷️ Fix name → name lookup
runs free → confident match: "already finds it, they call it X" with a
one-tap rename; choices: pick free, with "none of these — use a photo
scan" as the escape; no match: the panel says so and offers the scan
as an explicit spend. Scans are spent only on a deliberate tap after
the free path fails.
#45 — Prices can always be re-searched (Jen, 2026-11-11). Problem she
hit: once a price was saved, "searching again" silently returned the
12h cache — prices change daily, so an Update that doesn't re-ask is
broken. Fixes: priceProvider.lookup takes {fresh} — explicit price
taps bypass the cache (incidental lookups still cache); ONE button at
the very top of Inventory, "💲 Update prices," refreshes every in-stock
product (the old mid-page Look-up-all button is gone); a run searches
each product NAME once — duplicates and extra lots reuse the first
result instead of re-searching.
#46 — The price key lives in the shared books (Jen approved, 2026-11-11).
Migration 018 book_settings (owner_id = set, tcg_api_key) with
member-only RLS, no anon access — verified as caller: Jen upserts/reads,
a stranger sees 0 rows, anon is denied outright. The provider resolves
the key as: this device's saved key, else the open set's book key.
Account's Save writes both. Why: the key was per-device localStorage,
so her computer run read "sample" on one device and worked on another,
and Judah's phone had no key at all.
#47 — TCGplayer is the standard; Muse write-back proven by hand
(2026-11-11). Jen asked for TCGplayer prices directly ("most accurate
place") via the Ezzie-style loop: app makes a prompt → Muse looks it
up → Muse writes it back into the app. Not funky — it's her tandem
pattern; a standing "Ask Muse" button is the product form. Manual run
this session: the computer's price run (stamps 20:36:56Z) was mostly
12h-cache hits, and spot-checks against TCGplayer data (via TCGCSV
mirrors) proved: UPC $1,495.75 = the CASE again, served from the
poisoned cache the pre-#42 matcher wrote (cleared to null — the edition
is Day vs Night, a photo/fix-name question); "Delta reign individual
pack" $143.16 was wrong by ~20x (TCGplayer market $6.50 — written);
"Delta reign" / "3 pack blister" (identical $23.65 duplicates) and
"Delta Reign ETB" ($52.95 vs ~$84) cleared to null — unverifiable beats
wrong. Lesson: Judah's shorthand names defeat token matching too often;
photo ID and Muse write-back are the trustworthy paths.
#48 — 🤖 Ask Muse for prices (Jen approved, 2026-11-11). A button on
Inventory collects every in-stock product whose price is missing or
older than a day and builds a paste-ready prompt: the set id, the
honesty rules (exact product only — never a case for a single, never
one edition for another; unmatchable means flag it, never guess), the
write-back instruction (public.products on the Judah project), and a
verify-by-readback + report-table step. Jen pastes it to her Muse;
Muse prices off TCGplayer and writes back; she refreshes and sees
them. The Ezzie tandem shape, in Judah's app: the API path stays for
quick single lookups; Muse is the accuracy path for Judah's own
shorthand names, which defeat automated matching.
#49 — Sales import speaks the REAL TCGplayer export (2026-11-11,
Jen's file TCGplayer_OrderList_20261111_145632.csv). The export TCGplayer
actually gives is an order LIST — Order #, Buyer Name, Order Date
("Saturday, 31 October 2026"), Status, Product Amt, Shipping Amt,
Total Amt, Buyer Paid — one row per order, NO product lines. The app
was built for a line-item file that doesn't exist; it also would have
mistaken "Buyer Name" for the product column. Fix: detect the order-list
shape and import orders with their totals; the match step becomes
"which product was this?" — product picker, quantity stepper (unit
price = total ÷ qty), editable price, and a split button for
multi-product orders (extra rows carry $0 shipping charged). Cancelled/
refunded orders are skipped and counted in the note. The file proves
the money; Judah supplies the what — the same trust split as photo ID.
Her file, verified by running the parser on it: 31 importable orders, product totals $6,993.06; 2 cancelled/refunded rows skipped; dates parse (weekday prefix stripped).
#50 — Pirate Ship has TWO exports; the app takes both (2026-11-11,
Jen's real Transactions.xlsx). The Shipments grid export matches by
order number automatically (#33). The Account → Transactions ledger
(Date/Type/Description/Total/Balance, .xlsx) proves amounts + dates
only — no order, no recipient — so it can never auto-match. Per Jen:
only the charges from the day she picks (her file: 16 labels on
11/11/26, $162.22; 59 labels / $474.01 back to April), and only ones
that match a sale — the flow shows that day's amounts as chips and
Judah taps each onto its order. Unassigned amounts never enter the
books. The app now reads .xlsx as well as .csv for this step.
#51 — Postage is Mom's money (Jen, 2026-11-11): "every one of those
shipping charges he paid from MY bank account, so it needs to go into
what he owes me." Migration 019 sales.ship_paid_by ('judah'|'mom').
Every order in the Shipping step asks "Who paid?" — Mom is the
default, and anything filled from a Pirate Ship file is Mom
automatically. Mom-paid postage adds to owed-to-Mom (Balances shows
the postage line), drops out of Giovanni's fronted-shipping debt to
Judah, and still counts as a cost in the sale's profit math. Also
fixed in this pass: the sample-orders link pointed at the site root
and 404'd under the /judah-tcg-books/ path (Jen: "couldn't download
the sample orders file") — it uses the app base path now, and the
sample itself is in the real order-list shape.
#52 — Sales entry's primary path is Muse clicking through (Jen,
2026-11-11). The order-list file proves totals only; what was IN each
order exists solely behind clicks in the seller portal. So Sales gains
🤖 Ask Muse to read the orders — a paste-ready prompt covering the
whole job: click every order since the last recorded sale, capture
line items, pair Pirate Ship label costs in Shipments (Mom-paid),
match to lots with the no-guessing rule, record sales with the app's
fee math, decrement stock, verify by readback, report a table. The
file import stays as the manual path. First live run: Jen's 31 real
orders (Sep 16–Nov 7, $6,993.06) harvested the same day.
#52a — The click-through's real gate is Giovanni (Jen, 2026-11-11
evening): TCGplayer sign-in codes go to GIOVANNI — it's his account,
his inbox. Jen relayed one code by hand (568396, 16:12) but will not
reliably get them. Two cloud-browser runs died on that wall (one
two-hour timeout, one stopped within a minute of Jen's word). Rules
going forward: never start a TCGplayer session expecting Jen to fetch
codes; a click-through run needs Giovanni present (or his forwarding)
ONCE — the browser keeps the session after — or it doesn't start.
The app paths (order-list import, Pirate Ship chips, Ask Muse
prices) work without any TCGplayer sign-in and are the standing way
in; pre-app and unidentified orders stay unmatched by design.
#54 — The file is the PACKING SLIPS (Jen, 2026-11-11): "in the app,
rather than saying 'export the orders,' we need to be super clear:
'export the packing slip.' And upload it into the app." Sales step 1
now leads with Print packing slips → save the PDF → upload it here;
the orders CSV is demoted to a fallback link. The app reads the PDF
(unpdf) and parses it (src/lib/slips.ts) into named line items —
proven against Jen's two real slip PDFs: 31 unique orders, every
item summing to its order total, grand total $6,993.06 tying to the
order list, Day 7 / Night 6. Slips don't carry shipping charged, so
the match card makes that amount editable per sale.
#55 — The app's inventory is the LAST WEEK's pool (Jen, 2026-11-11):
"All of these would be sales that happened in the last week. Anything
before the last week, I never entered the inventory into the app."
So the Sep 16–Oct 31 sales (Celebration ETBs, the tins, bundles,
Destined Rivals, singles) were never app inventory and are NOT
recorded — pre-app history, out by the same rule as the singles.
The recordable set from the backlog is the Nov 6–7 batch: 13 UPCs
(Day 7, Night 6) and 6 Delta Reign ETBs. Still open when she rules:
whose UPCs/ETBs sold (snapshot pool splits UPC 4 mine / 4 Giovanni /
4 Mom = 12 against 13 sold; ETB 1 Giovanni / 4 Mom = 5 against 6
sold — one unexplained extra in each) and the Greninja name (moot
for recording now; its sales are pre-week).
#56 — The Nov 6–7 backlog is recorded (Jen: "Just do the ones that
you can. Leave the other UPC and Delta [Reign]"). Fill rule used,
disclosed to Jen: sales in chronological order draw the pools' lots
in the order the lots were entered (UPC: Mom 4 → Judah 4 → Giovanni
4; ETB: Mom 4 → Giovanni 1); the 3-ETB order A7CA75 splits 2 Mom /
1 Giovanni; whatever the pools can't cover stays out. Recorded:
16 sale rows, 17 units — gross $5,116.65, fees $682.72, profit
$868.17, Mom's share +$161.65 (owed-to-Mom now $2,171.19 before
postage), Judah's share of payouts $3,037.46 (= what Giovanni owes
before payments). Left out: UPC order 607F4A (Nov 7, $384.43) and
ETB order 80D91A ($84.50). All five pool lots now read 0 on hand.
If Judah later gives the true owner order, rows re-point to other
lots in one pass — nothing is baked. Postage still unpaired (the
11/11 labels pair by tracking number against a Pirate Ship
Shipments export when it comes).
#57 — ShippingExport read in full (2026-11-12): it has NO tracking
numbers and no shipping-fee values — rows end at Value of Products.
(Maven told Jen last night it had tracking numbers, from the header
alone; corrected to her face this morning.) What it does prove:
Item Count per order ties exactly to the #56 write-in (A7CA75 = 3,
every other Nov order = 1) and every Value of Products matches.
The postage bridge stands as: Pirate Ship → Shipments → Export
(recipient + tracking + cost per label), paired to orders by the
reference/name it carries. The eleven-eleven labels ($162.22) pair
in that pass; profits dip and Mom's owed rises by her postage then.
#58 — Profit is per-person now (Jen, 2026-11-12): "we need a better
formula for figuring out Judah's profit vs Gio's profit vs Mom's
profit" + "schedule c — this should only be HIS profit not Gio's" +
"either 3 buttons visible or a dropdown — I think in schedule c a
dropdown and it should be exportable." Formula (math.ts
profitForPerson / profitByPerson / personTaxSummary): per sale,
profit lands on the stock's owner — Giovanni's all his, Judah's all
his, Mom's split (her recorded mom_share is her profit; the rest of
that sale's profit is Judah's — he sold it). Loose expenses and show
table fees land on Judah only. Profit screen: three buttons (Judah ·
Gio · Mom) with each person's all-time profit on the button; cards
and the sales list follow the tapped person. Who Owes Who opens
with the three-way profit strip. Books & Taxes: a "Whose numbers?"
dropdown — Judah's IS the Schedule C (his + Mom's stock, Mom's
profit share as a cost line, Giovanni excluded from every line
including purchases); Giovanni's and Mom's are labeled memos in the
same shape. The CSV export downloads the selected person's summary
+ their sales detail. Proven against the real Nov batch: Judah
$449.05 / Gio $257.47 / Mom $161.65, tying to $868.17; Schedule C
receipts $3,505.15, COGS $2,426.76, fees $467.69, net $449.05.
#59 — The Home big button shows JUDAH's profit only (Jen, 2026-11-12:
"I want just Judah's profit on the big button on home"). store's
totalProfit now = profitByPerson(...).judah; the hero reads "Judah's
profit — all time." Today that's $449.05, not the blended $868.17.
#60 — Postage paired by ESTIMATE (Jen, 2026-11-12: "we can guess
which item they belonged to based on date and estimated weight of
products" / "or address?"). The 11/11 labels ($162.22) were paired
to the Nov orders by packaged-weight class x distance zone, all as
Mom-paid (her Pirate Ship account). $148.35 landed on the 14
recorded orders; $7.89 (ETB to WV) and $5.98 (One Piece single)
paired to orders that were never recorded, so they're outside the
books; the Nov 6 UPC to Michigan and the left-out Denver UPC got
no label (shipped another day, presumably). Known soft spots: the
two California UPCs split $17.24/$12.41 on a coin flip. Address
pairing is the exact method but needs Pirate Ship's Shipments
export (recipient per label) — the Transactions ledger has no
recipients, and TCGplayer's tracking column is empty. When that
export arrives, estimates are replaced, not defended. Effects:
total profit $868.17 -> $719.82 (Judah $371.60 / Gio $225.68 / Mom
$122.54); owed to Mom $2,280.43; Giovanni owes Judah $2,920.90.
Also: this morning's ShippingExport format adds a Carrier column
and FILLS the Shipping Fee Paid values (shipping CHARGED to the
buyer — matches the order list; the first export's rows were
truncated before those columns).
#61 — Postage is EXACT now (Jen sent Pirate Ship's Shipments export,
2026-11-12): recipient + cost per label. The #60 estimates were
replaced the same morning. Pairing is by buyer name against the
TCGplayer orders. Notable estimate misses: the 3-ETB box cost
$10.21 (not $17.87 — the second $17 label was a UPC to New York),
and the Michigan UPC did have an $8.36 label. One judgment call:
David Hass placed two orders 4 minutes apart and there is exactly
one Hass label ($9.55) — treated as one combined box, split
$4.78/$4.77 across his two orders. Unrecorded orders' labels
(Winters $6.08, Heath $9.50) stay outside the books; the One Piece
single has no Pirate Ship label at all. Three "Josiah Bahr" labels
in the file are personal shipments, not orders. Recorded postage:
$146.64. Final Nov-batch numbers: profit Judah $375.15 / Gio
$217.36 / Mom $129.02 ($721.53 total); owed to Mom $2,285.20;
Giovanni owes Judah $2,930.93. Standing routine from here: packing
slips for what sold, Shipments export for what postage cost —
both pair by name, no guessing.
#62 — The Pirate Ship link lives in the app (Jen, 2026-11-12, with
the URL: https://ship.pirateship.com/reports/shipment — "that's
where I found it — link should go into the app"). Sales → Shipping
step now links straight to the Shipments report and tells the
routine in those words: Reports → Shipments → Export → upload
here; the app pairs labels to orders by buyer name. Proven before
shipping: the app's existing Pirate Ship parser reads Jen's real
Shipments.xlsx cleanly (31 rows; Saucier $17.24, Bader $17.87, Hass
$9.55 by name). The old "Shipments grid, add the Order ID column"
instruction is retired — the report needs no column setup.
#63 — The TCGplayer Orders link lives in the app too (Jen pasted
the seller-portal Orders URL, 2026-11-12): Sales step 1's packing-
slip instructions now carry an "Open TCGplayer — Orders" button
beside the Pirate Ship Shipments-report link on the shipping step.
Both source pages are one tap from the step that uses them.
#64 — Real TCGplayer fees replace the formula (Judah's screenshot of
the 11/23/2026 payment list, sent by Jen 2026-11-12). Every actual
fee ran $0–$1.02 ABOVE the app's formula, and identical totals
carried different fees. The pattern solves exactly: TCGplayer's
2.5% processing fee also applies to the buyer sales tax it
collects. Proof: the New Hampshire order (no sales tax) matched
the formula to the penny ($53.30); the Michigan order's excess is
exactly 2.5% of 6% tax on $400 ($0.60). The books now carry the
actual per-order fees (A7CA75's $34.46 split by subtotal:
$22.97/$11.49). Effects: fees $682.72 -> $692.26; profit Judah
$372.11 / Gio $215.31 / Mom $124.57 ($711.99 total); Giovanni owes
Judah $2,923.44; Judah owes Mom $2,280.75 (+ the $1,000 loan =
$3,280.75; net shortfall $357.31). The 11/23 payout totals
$4,859.18; $434.79 of it is net from the three UNRECORDED orders
(Heath UPC $332.78, Winters ETB $72.88, Iavagnilio single $29.13)
— whose stock those were is still unanswered; if Judah's or Mom's,
Giovanni owes that too. Open app question for Jen: teach saleMath
the tax piece (needs a buyer-tax input per sale) or keep the
payments-list correction as the routine.
#65 — The $54 ETB was Judah's (Jen, 2026-11-12). The third box in
order A7CA75 had been drawn from a "Giovanni" lot, but the physical
ETB was Judah's own — entered twice in the app (once as Giovanni's
under "Delta Reign ETB," once as Judah's under "Delta reign").
Fix: the sale row re-pointed to Judah's lot (now 0 on hand), the
phantom Giovanni purchase/lot deleted (his spend is now just the
4 UPCs, $1,085). Money: that sale's $19.01 profit moves Gio ->
Judah, and its $73.01 net joins what Giovanni owes. New totals:
profit Judah $391.12 / Gio $196.30 / Mom $124.57; Giovanni owes
Judah $2,996.45; Judah owes Mom $3,280.75 incl. the $1,000 loan
(net shortfall $284.30).
#66 — Giovanni owes the GROSS (Jen, 2026-11-12, correcting the
settlement model): "gio owes the gross remember — and also add in
any shipping that judah paid FOR Gio or that Mom paid FOR gio. If
mom paid for the shipping, judah owes it to mom but if it was gio's,
gio owes it to judah so judah can pay it to mom." So: (1) Judah's
share of Giovanni's collections is the payout on his + Mom's stock
(item − fees) with NO postage deducted — postage never came out of
Giovanni's payout. (2) Shipping on Giovanni's OWN sales is his debt
to Judah whoever fronted it (Judah-paid or Mom-paid); Mom-paid
postage on his sales stays in Judah-owes-Mom too — the same dollars
passing Gio -> Judah -> Mom, two legs, not a double count. Built:
giovanniShareGross() in math.ts, frontedShipping drops the Mom
exclusion, store balance + SellFlow collected/owed displays +
Balances wording follow. Batch result: Giovanni owes $3,143.09
($3,102.98 gross share + $40.11 postage on his sales); Judah owes
Mom $2,280.75 + $1,000 loan = $3,280.75 (shortfall $137.66).
Supersedes the settlement figures in #64/#65 (profits unchanged).
#67 — Jake is a fourth owner (Jen, 2026-11-12: "apparently the UPC
was Jake's... add jake to the app"). The mystery 13th UPC (Heath
order, $384.43) was Jake's. His model is a pure pass-through: Gio
pays Judah the gross minus fees; Judah pays Jake the gross minus
fees AND shipping. His cost basis is his own business — lots may
carry $0, his sales never touch Judah's Schedule C (excluded like
Giovanni's), and his "profit" number is his net proceeds. Built:
migration 020 ('jake' owner kind + jake_payments), BuyFlow owner
chip, Profit gains a Jake button, Books gains a Jake memo export,
Who Owes Who gains a "You owe Jake" card with a payment logger,
Home's owed total includes Jake. His UPC sale is recorded (actual
fee $51.65, Mom-paid postage $9.50). Balances now: Giovanni owes
Judah $3,475.87; Judah owes Jake $323.28; Judah owes Mom $2,290.25
+ $1,000 loan = $3,290.25 (net shortfall still $137.66 — Jake's leg
passes through clean). Still unowned: Winters' ETB and the One
Piece single ($102.01 of the payout between them).
#68 — "You owe Mom" splits in two (Jen, 2026-11-13). The single total
confused Judah: it counts Mom's cost at purchase, so it mixes money
due from sales with money still sitting in unsold product. The total
and the rule are unchanged; the Mom card now shows two lines —
"Due from sales" (sold cost + her profit shares + her postage −
repaid) and "Still in inventory" (on-hand Mom cost). On the Nov
batch: due $1,622.47, in inventory $667.78, total $2,290.25.
