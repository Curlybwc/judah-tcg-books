# Judah TCG Books — SPEC

Phone-first PWA accounting app for Judah Bahr's Pokémon TCG reselling on TCGplayer.
Owner: Jen Bahr. User: Judah Bahr (17). Built 2026-11-05 overnight.

## Design gate (Jen, settled)

Home = job buttons only. Every job is a step-by-step workflow:
- A step rail stays visible: current step highlighted, finished steps checked.
- Only the current step's content is on screen.
- A button press MAKES that step happen. Automatic steps show status only (no fake buttons).
- Acceptance test: hand Judah the phone with no explanation — he can buy product,
  record a sale, and see what Giovanni owes him without asking how.

Home buttons:
1. **I Bought Product**
2. **I Sold on TCGplayer**
3. **Scan for Price**
4. **Giovanni Paid Me**
5. **Check My Profit**
6. **What I Have For Sale**

The home screen also shows ONE number: what Giovanni owes Judah right now.

## Money math (exact)

### Purchases
Per purchase, capture: product name, quantity, unit price, TAX (total), SHIPPING IN (total),
owner (`mine` | `giovanni` | `split` + Judah % ), paid via (`USAA` | `Cash` | `Other`), date.

```
total_cost      = unit_price * qty + tax + shipping_in
cost_basis_unit = total_cost / qty
```

### Sales (TCGplayer, Level 1–4 seller fee model)
```
commission      = 10.75% * (item_price + shipping_charged)
transaction_fee = 2.5% * (item_price + shipping_charged) + $0.30   (per order)
fees            = commission + transaction_fee
net_proceeds    = item_price + shipping_charged - fees - shipping_paid
profit          = net_proceeds - cost_basis_unit * qty_sold
```

Sales enter via **TCGplayer Seller Portal Orders CSV import** (no TCGplayer API exists
for new developers). Import flow: upload file → parse rows → match to for-sale stock by
name (Judah confirms/corrects match + owner tag on a review step) → enter shipping PAID
(label amount, or stamp/envelope preset) → app shows the math → save decrements stock.

### Giovanni ledger
Judah and Giovanni SHARE one TCGplayer seller account. Payouts go to Giovanni.
Giovanni repays Judah by Zelle.

```
giovanni_owes_judah =
    SUM over sales of (Judah-owned share of net_proceeds)
  - SUM of Zelle repayments logged in [Giovanni Paid Me]
```

Judah-owned share of a sale = net_proceeds × Judah's ownership % of the stock sold
(100% mine, 0% Giovanni's, split % for split stock).

End of the sale workflow shows: "Giovanni collected $X for you. He now owes you $Y total."

## Tables (Supabase, project `zjsxplnyphejklsdhqxz`)

All tables: `id uuid pk`, `owner_id uuid not null` (auth user; sample data uses the
sample owner constant `11111111-1111-4111-8111-111111111111`), `created_at timestamptz`.
RLS enabled on every table; policies keyed to `auth.uid() = owner_id`
(sample rows are readable in demo mode — see DECISIONS.md).

| Table | Purpose | Key columns |
|---|---|---|
| `products` | For-sale stock identity | name, barcode, product_type (sealed/single), market_price (sample until real provider) |
| `purchases` | Buy events | product_id, qty, unit_price, tax, shipping_in, total_cost, cost_basis_unit, owner_kind, judah_pct, paid_via, purchased_on |
| `inventory_lots` | Stock on hand per purchase | product_id, purchase_id, qty_on_hand, cost_basis_unit, owner_kind, judah_pct |
| `sales` | Sale events (from CSV or manual) | product_id, lot_id, qty, item_price, shipping_charged, shipping_paid, commission, transaction_fee, fees, net_proceeds, profit, judah_share, order_id, sold_on |
| `giovanni_payments` | Zelle repayments | amount, paid_on, note |
| `price_lookups` | Scan-for-price history | product_name, price, provider, looked_up_at |
| `bank_imports` | Phase-2 USAA import stub | filename, row_count, imported_at, status |

Inventory shown in the app = FOR-SALE STOCK ONLY (sums of `inventory_lots.qty_on_hand > 0`).
Collectr (personal collection) and DeckTradr (show scanning) are out of scope, untouched.

## Price provider seam

`src/lib/priceProvider.ts` exposes `lookupPrice(name) → { price, provider }`.
Tonight's provider is `SamplePriceProvider`, CLEARLY labeled **SAMPLE** in the UI.
Dropping in a real TCG API key later = one new provider class + one config line.
TCGCSV bulk files are a candidate bulk source — see DECISIONS.md.

## Auth

Supabase Auth, email + password. Sign-in screen only; sign-up disabled in the UI.
Tonight: no real accounts created. The app runs in **demo mode** against seeded sample
data under the sample owner UUID until Jen/Judah create the real account in the morning,
at which point `SAMPLE_OWNER_ID` in `src/lib/config.ts` is replaced by Judah's auth uid
(or RLS policies take over once he signs in — both paths are wired).

## Phase 2 (not tonight)

- USAA bank feed via Teller. `bank_imports` table + a USAA CSV upload stub screen exist.
- Real price provider (TCG API free-tier key — daytime Jen/Judah signup step).
