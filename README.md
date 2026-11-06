# Judah TCG Books

Phone-first accounting app (installable PWA) for Judah Bahr's Pokémon TCG reselling
business on TCGplayer. Owner: Jen Bahr. User: Judah.

**Home is six big job buttons** — I Bought Product · I Sold on TCGplayer · Scan for
Price · Giovanni Paid Me · Check My Profit · What I Have For Sale — plus one big
number: what Giovanni owes Judah right now. Every job is a step-by-step workflow
with a visible step rail; a button press makes the step happen.

**Show Mode** (added 2026-11-06) sits at the top of Home for card-show days: start
a show (name, table fee, cash float), then a ten-second buylist entry (with
50/60/70/80%-of-market offer chips), a quick cash/Venmo sale flow with no
TCGplayer fees, a live cash-box number, and an end-of-show wrap-up that
reconciles counted cash against the books. Everything tags to the show; past
shows stack up as per-show profit reports. Show writes are offline-first: they
save on the phone and sync to the cloud when signal returns.

Design + math spec: [SPEC.md](SPEC.md) · Judgment calls: [DECISIONS.md](DECISIONS.md)

**▶ Live demo: https://curlybwc.github.io/judah-tcg-books/** — open it on Judah's
phone and "Add to Home Screen" to install it as an app. (Deployed from the
`gh-pages` branch; rebuild with `PAGES_BASE=/judah-tcg-books/ npm run build` and
republish `dist/` to update it.)

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (tsc + vite, PWA service worker + manifest)
npm run preview  # serve the production build
npm test         # money-math test (39 assertions against the real math module)
```

Safety nets built in: re-importing the same TCGplayer file skips rows already in
the books (the database enforces it too); sales, buys, and Giovanni payments can
all be undone from the app (two-tap confirm; a buy can't be undone once something
has sold from it); a sale can never exceed the stock on hand (flagged in the app,
skipped in the save, and rejected by the database); stock can be adjusted without
a sale (damaged / kept / returned / lost) with the reason kept on record.

To put it on Judah's phone: deploy `dist/` to any static host (or `npm run preview`
on the home network), open the URL on the phone, and "Add to Home Screen".

## Backend

Supabase project **Judah TCG Books** (ref `zjsxplnyphejklsdhqxz`, free org
"Judah TCG"). Schema in `supabase/migrations/` — applied in order:

1. `202611050001_init.sql` — 7 tables (`products`, `purchases`, `inventory_lots`,
   `sales`, `giovanni_payments`, `price_lookups`, `bank_imports`), RLS on all,
   REVOKE-before-GRANT ACLs, owner policies keyed to `auth.uid()`.
2. `202611050002_demo_writes.sql` — demo mode: anon may read/write ONLY the sample
   owner's rows. **Remove when real auth goes live.**
3. `202611050003_seed_sample.sql` — sample products/purchases/stock (below).

The frontend uses the anon (public) key in `src/lib/config.ts` — safe by design;
RLS is the protection. There is NO service_role key anywhere in this repo.

Auth: Supabase email+password, sign-in screen only, sign-up disabled in the UI.
Until an account exists, the app runs in demo mode against the sample owner
`11111111-1111-4111-8111-111111111111`, with an on-phone localStorage fallback
if the cloud is unreachable.

## What's real vs sample

| Thing | State |
|---|---|
| Buy / sell / Giovanni / profit / inventory workflows | **Real** — full math, cloud-persisted |
| Money math (fees, cost basis, profit, Giovanni ledger) | **Real** — verified, see self-test below |
| Prices (Scan for Price, stock value) | **SAMPLE** — placeholder provider behind a seam, labeled SAMPLE in the UI |
| Seeded products / purchases / stock | Sample demo data |
| Photo product ID | Stub — opens camera, typed name is the real path |
| Bank screen | Stub — USAA CSV upload is recorded; Teller matching is Phase 2 |
| TCGplayer sales | Real via **CSV import** (Seller Portal Orders export) — there is no TCGplayer API |

## Self-test (executed 2026-11-05 overnight, all passing)

The app's own math module (`src/lib/math.ts`, compiled and run directly):

- **Buy:** 4 × $55.00 + $18.00 tax + $12.00 shipping in → total **$250.00**, cost basis **$62.50/unit** ✓
- **Sale A** (sample CSV order TCG-100001): 1 × 151 ETB @ $79.99 + $4.99 shipping charged,
  $5.50 label paid, basis $62.50 → fees $11.56 (commission $9.14 + transaction $2.42),
  net $67.92, **profit $5.42**, Judah share **$67.92** (100% his) ✓
- **Sale B** (TCG-100002): 2 × Prismatic Bundle @ $49.99 + $4.99 shipping charged,
  $5.50 paid, basis $32.00, split 50% → fees $14.20, net $85.27, **profit $21.27**,
  Judah share **$42.64** ✓
- **Giovanni:** after both sales he owes **$110.56**; after a $50 Zelle repayment,
  **$60.56** ✓ (19/19 assertions passed)

The same flow was also executed against the live database as the `anon` caller
(insert sales → stock decremented 4→3 and 6→4 → payment logged → balance read back
$60.56), then rolled back so the demo starts clean: 4 products, 2 purchases,
10 units on hand, $0 owed. RLS proofs: anon reading another owner's rows = denied;
an authenticated user with a different uid sees 0 sample rows.

`npm run build` passes (PWA manifest + service worker generated).

## Morning checklist (Jen + Judah, ~10 minutes)

1. Supabase dashboard → project Judah TCG Books → Authentication → create Judah's
   user (email + password). He signs in via the app's Sign In screen; demo data is
   replaced by his own empty books.
2. Drop the demo-write policies (migration 002) once he's signed in.
3. Optional: sign up for the free TCG API key together, then swap the sample price
   provider in `src/lib/priceProvider.ts` (one class + one line).
4. Deploy `dist/` (Netlify/Vercel/GitHub Pages — free) and Add to Home Screen.

## Layout

```
SPEC.md                  settled design + exact money math
DECISIONS.md             every judgment call from the build, for Jen to flip
samples/                 sample TCGplayer orders CSV to practice the import
supabase/migrations/     schema + demo policies + seed
src/lib/math.ts          the money math (single source of truth)
src/lib/priceProvider.ts price seam (sample provider today)
src/lib/store.tsx        data layer: Supabase + on-phone fallback
src/views/               one file per job workflow
```
