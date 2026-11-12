// Committed math test — run with `npm test`.
// Compiles the app's real src/lib/math.ts and checks the hand-verified numbers
// from the README self-test. If a future edit changes fee math, this fails loudly.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "jtb-math-"));
cpSync(join(root, "src/lib/math.ts"), join(tmp, "math.ts"));
cpSync(join(root, "src/lib/quickbuy.ts"), join(tmp, "quickbuy.ts"));
cpSync(join(root, "src/lib/catalog.ts"), join(tmp, "catalog.ts"));
execFileSync(join(root, "node_modules/.bin/tsc"), ["math.ts", "quickbuy.ts", "catalog.ts", "--module", "commonjs", "--target", "es2020", "--outDir", "out"], { cwd: tmp, stdio: "inherit" });
const { purchaseMath, saleMath, giovanniBalance, quickSaleMath, showCashExpected, taxFromRate, momProfitShare, taxSummary, loanMath, frontedShipping, momShippingOwed, profitByPerson, personTaxSummary, giovanniShareGross } = createRequire(import.meta.url)(join(tmp, "out/math.js"));
const { parseQuickBuyLine, allocateShipping } = createRequire(import.meta.url)(join(tmp, "out/quickbuy.js"));
const { UPC_CATALOG, normalizeBarcode, catalogLookup } = createRequire(import.meta.url)(join(tmp, "out/catalog.js"));

let fails = 0;
function eq(label, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.001;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: expected ${expected}, got ${actual}`);
}

const buy = purchaseMath(4, 55, 18, 12);
eq("buy totalCost", buy.totalCost, 250.0);
eq("buy costBasisUnit", buy.costBasisUnit, 62.5);

const a = saleMath({ qty: 1, unitItemPrice: 79.99, shippingCharged: 4.99, shippingPaid: 5.5, costBasisUnit: 62.5, judahPct: 100 });
eq("A base", a.base, 84.98); eq("A commission", a.commission, 9.14); eq("A txnFee", a.transactionFee, 2.42);
eq("A fees", a.fees, 11.56); eq("A net", a.netProceeds, 67.92); eq("A profit", a.profit, 5.42); eq("A judahShare", a.judahShare, 67.92);

const b = saleMath({ qty: 2, unitItemPrice: 49.99, shippingCharged: 4.99, shippingPaid: 5.5, costBasisUnit: 32.0, judahPct: 50 });
eq("B base", b.base, 104.97); eq("B commission", b.commission, 11.28); eq("B txnFee", b.transactionFee, 2.92);
eq("B fees", b.fees, 14.2); eq("B net", b.netProceeds, 85.27); eq("B profit", b.profit, 21.27); eq("B judahShare", b.judahShare, 42.64);

eq("giovanni owed after sales", giovanniBalance(a.judahShare + b.judahShare, 0), 110.56);
eq("giovanni owed after $50 Zelle", giovanniBalance(a.judahShare + b.judahShare, 50), 60.56);
eq("total profit A+B", Math.round((a.profit + b.profit) * 100) / 100, 26.69);

// Show mode (2026-11-06): in-person sale — no fees, no shipping.
// 2 packs bought at a table for $32 basis each, sold cash at $45 each, mine.
const q = quickSaleMath({ qty: 2, unitPrice: 45, costBasisUnit: 32, judahPct: 100 });
eq("Q gross", q.gross, 90); eq("Q costBasisTotal", q.costBasisTotal, 64);
eq("Q profit", q.profit, 26); eq("Q judahShare", q.judahShare, 90);
// Split 50% with Giovanni: he is owed his half of the take, Judah's share is half the cash.
const qs = quickSaleMath({ qty: 1, unitPrice: 79.99, costBasisUnit: 62.5, judahPct: 50 });
eq("QS gross", qs.gross, 79.99); eq("QS profit", qs.profit, 17.49); eq("QS judahShare", qs.judahShare, 39.99); // half of 79.99 is 39.995 — the app's round2 rule lands on 39.99, same as everywhere else
// Cash box: $200 float + $90 cash sales − $130 cash buys = $160 expected.
eq("cash box expected", showCashExpected(200, 90, 130), 160);

// Tax as a % the app calculates (Jen, 2026-11-06): receipts show one rate for everything.
eq("tax 8% of 250", taxFromRate(250, 8), 20);
eq("tax 8.5% of 220", taxFromRate(220, 8.5), 18.7);
eq("tax 10% of 79.99", taxFromRate(79.99, 10), 8.0);
eq("tax 0% is 0", taxFromRate(123.45, 0), 0);
// End to end: 4 × $55 at 8.5% + $12 shipping = $250.70 total.
eq("buy with rate-tax total", purchaseMath(4, 55, taxFromRate(220, 8.5), 12).totalCost, 250.7);

// Quick-buy parser: pipe, comma, loose, and voice-word shapes.
const q1 = parseQuickBuyLine("Delta Reign ETB | 4 | 61.00");
eq("QB pipe qty", q1.qty, 4); eq("QB pipe price", q1.unitPrice, 61);
const q2 = parseQuickBuyLine("Prismatic Evolutions Booster Bundle, 6, 32");
eq("QB comma qty", q2.qty, 6); eq("QB comma price", q2.unitPrice, 32);
const q3 = parseQuickBuyLine("151 Elite Trainer Box x4 @ $55");
eq("QB loose qty", q3.qty, 4); eq("QB loose price", q3.unitPrice, 55);
const q4 = parseQuickBuyLine("two delta reign etb at sixty-one each");
eq("QB voice qty", q4.qty, 2); eq("QB voice price", q4.unitPrice, 61);
const q5 = parseQuickBuyLine("one charizard ex premium collection at one hundred twenty dollars");
eq("QB voice qty 1", q5.qty, 1); eq("QB voice price with hundred", q5.unitPrice, 120);
const q6 = parseQuickBuyLine("mystery thing with no numbers");
if (!q6.error) { fails++; console.log("FAIL QB bad line should error"); } else console.log("PASS QB bad line errors");
// Shipping allocation: parts must sum to the whole.
const alloc = allocateShipping([{ qty: 4, unitPrice: 55 }, { qty: 6, unitPrice: 32 }], 12);
eq("QB alloc sums to 12", Math.round(alloc.reduce((s, v) => s + v, 0) * 100) / 100, 12);

// Starter barcode library: size, shape, and two retailer-verified anchors.
const catKeys = Object.keys(UPC_CATALOG);
if (catKeys.length < 400) { fails++; console.log(`FAIL catalog size: expected 400+, got ${catKeys.length}`); } else console.log(`PASS catalog size: ${catKeys.length} entries`);
if (!catKeys.every((k) => /^\d{12}$/.test(k))) { fails++; console.log("FAIL catalog keys must all be 12-digit"); } else console.log("PASS catalog keys all 12-digit");
eq("CAT Prismatic bundle", catalogLookup("196214112544")?.name === "Prismatic Evolutions Booster Bundle" ? 1 : 0, 1);
eq("CAT 151 ETB via EAN-13 form", catalogLookup("0820650853159")?.name === "151 Elite Trainer Box" ? 1 : 0, 1);
eq("CAT normalize strips leading zeros", normalizeBarcode("00820650853159") === "820650853159" ? 1 : 0, 1);
eq("CAT unknown barcode", catalogLookup("999999999999") === undefined ? 1 : 0, 1);

// Schedule C summary (2026): canonical sales A + B, one show quick sale with a
// $25 table fee, one $12.30 other expense, the $250.70 buy in-year.
const tx = taxSummary(2026,
  [
    { item_price: 79.99, shipping_charged: 4.99, shipping_paid: 5.5, fees: 11.56, cost_basis_total: 62.5, profit: 5.42, sold_on: "2026-03-01" },
    { item_price: 99.98, shipping_charged: 4.99, shipping_paid: 5.5, fees: 14.2, cost_basis_total: 64, profit: 21.27, sold_on: "2026-03-02" },
    { item_price: 90, shipping_charged: 0, shipping_paid: 0, fees: 0, cost_basis_total: 64, profit: 26, sold_on: "2026-04-01" },
    { item_price: 500, shipping_charged: 0, shipping_paid: 0, fees: 0, cost_basis_total: 400, profit: 100, sold_on: "2025-12-31" },
  ],
  [{ table_fee: 25, show_date: "2026-04-01" }, { table_fee: 40, show_date: "2025-05-01" }],
  [{ amount: 12.3, spent_on: "2026-02-01", category: "other" }],
  [{ total_cost: 250.7, purchased_on: "2026-01-15" }],
);
eq("TX gross receipts", tx.grossReceipts, 279.95);
eq("TX COGS", tx.cogs, 190.5);
eq("TX gross profit", tx.grossProfit, 89.45);
eq("TX fees", tx.fees, 25.76);
eq("TX shipping paid", tx.shippingPaid, 11);
eq("TX table fees", tx.tableFees, 25);
eq("TX manual expenses", tx.manualExpenses, 12.3);
eq("TX total expenses", tx.totalExpenses, 74.06);
eq("TX net profit", tx.netProfit, 15.39);
eq("TX cross-check: sales profit - table fees - manual = net", Math.round((tx.salesProfit - tx.tableFees - tx.manualExpenses) * 100) / 100, tx.netProfit);
eq("TX purchases in year", tx.purchasesInYear, 250.7);

// Mom's formula (Jen, 2026-11-07): cost back (buy side of the ledger) + 50% of
// the sale's actual profit. Sale A's profit is 5.42 → her cut of the profit is 2.71.
eq("Mom half of 5.42 profit", momProfitShare(5.42), 2.71);
eq("Mom half of 21.27 profit", momProfitShare(21.27), 10.64); // halving is exact in binary float, so 10.635 rounds up under the app's round2 rule
eq("Mom share of no profit", momProfitShare(0), 0);
eq("Mom shares a loss 50/50", momProfitShare(-10), -5);

// Loans (DECISIONS #34): simple interest only — flat dollars or a percent
// of the amount borrowed; owed never goes below zero; overpaying closes it.
const lf = loanMath({ principal: 200, interest_type: "flat", interest_value: 20 }, 50);
eq("loan flat interest", lf.interestAmount, 20); eq("loan flat total", lf.totalToRepay, 220); eq("loan flat owed", lf.owed, 170); eq("loan flat not paid off", lf.paidOff ? 1 : 0, 0);
const lp = loanMath({ principal: 200, interest_type: "percent", interest_value: 10 }, 0);
eq("loan percent interest", lp.interestAmount, 20); eq("loan percent total", lp.totalToRepay, 220);
const ln = loanMath({ principal: 150, interest_type: "none", interest_value: 0 }, 150);
eq("loan none interest", ln.interestAmount, 0); eq("loan paid off at exact", ln.paidOff ? 1 : 0, 1);
const lo = loanMath({ principal: 100, interest_type: "none", interest_value: 0 }, 140);
eq("loan overpay owed clamps to zero", lo.owed, 0); eq("loan overpay paid off", lo.paidOff ? 1 : 0, 1);

// Fronted shipping (DECISIONS #36): shipping on Giovanni-owned TCGplayer
// sales comes back to Judah; his own and split lots never count; show
// sales never count.
const fsLots = [{ id: "g1", owner_kind: "giovanni" }, { id: "m1", owner_kind: "mine" }, { id: "s1", owner_kind: "split" }];
eq("fronted: giovanni TCG sale", frontedShipping([{ lot_id: "g1", shipping_paid: 5.5, channel: "tcgplayer" }], fsLots), 5.5);
eq("fronted: own sale ignored", frontedShipping([{ lot_id: "m1", shipping_paid: 5.5, channel: "tcgplayer" }], fsLots), 0);
eq("fronted: split sale ignored", frontedShipping([{ lot_id: "s1", shipping_paid: 5.5, channel: "tcgplayer" }], fsLots), 0);
eq("fronted: show sale ignored", frontedShipping([{ lot_id: "g1", shipping_paid: 5.5, channel: "show_cash" }], fsLots), 0);
eq("fronted: legacy channel-less sale counts", frontedShipping([{ lot_id: "g1", shipping_paid: 4.25, channel: null }], fsLots), 4.25);
eq("fronted: sums across orders", frontedShipping([{ lot_id: "g1", shipping_paid: 5.5, channel: "tcgplayer" }, { lot_id: "g1", shipping_paid: 3.25, channel: "tcgplayer" }], fsLots), 8.75);
// Mom-fronted postage (DECISIONS #51): never Giovanni's debt to Judah;
// it lands on the owed-to-Mom ledger instead.
eq("fronted: mom-paid giovanni sale counts (DECISIONS #66 chain)", frontedShipping([{ lot_id: "g1", shipping_paid: 9.5, channel: "tcgplayer", ship_paid_by: "mom" }], fsLots), 9.5);
eq("gross share: mine counts item-fees, postage ignored", giovanniShareGross([{ lot_id: "m1", item_price: 400, shipping_charged: 0, fees: 53.9, channel: "tcgplayer" }], fsLots), 346.1);
eq("gross share: giovanni's own excluded", giovanniShareGross([{ lot_id: "g1", item_price: 400, shipping_charged: 0, fees: 53.9, channel: "tcgplayer" }], fsLots), 0);
eq("gross share: mom lot counts", giovanniShareGross([{ lot_id: "s1", item_price: 100, shipping_charged: 4, fees: 13.55, channel: "tcgplayer" }], fsLots), 90.45);
eq("gross share: show sale excluded", giovanniShareGross([{ lot_id: "m1", item_price: 400, shipping_charged: 0, fees: 0, channel: "show_cash" }], fsLots), 0);
eq("momship: sums mom-paid rows", momShippingOwed([{ lot_id: "g1", shipping_paid: 9.5, ship_paid_by: "mom" }, { lot_id: "m1", shipping_paid: 8.36, ship_paid_by: "mom" }, { lot_id: "m1", shipping_paid: 5.5, ship_paid_by: "judah" }]), 17.86);
eq("momship: legacy rows count as judah", momShippingOwed([{ lot_id: "m1", shipping_paid: 5.5 }]), 0);

// ——— Per-person profit (DECISIONS #58), fixtures = the real Nov 6 batch aggregates ———
const pLots = [{ id: "L-mine", owner_kind: "mine" }, { id: "L-gio", owner_kind: "giovanni" }, { id: "L-mom", owner_kind: "mom_payback" }];
const pSales = [
  { lot_id: "L-mine", item_price: 1583.40, shipping_charged: 0, shipping_paid: 0, fees: 210.98, cost_basis_total: 1085.00, profit: 287.42, mom_share: 0, sold_on: "2026-11-06" },
  { lot_id: "L-mom", item_price: 1921.75, shipping_charged: 0, shipping_paid: 0, fees: 256.71, cost_basis_total: 1341.76, profit: 323.28, mom_share: 161.65, sold_on: "2026-11-06" },
  { lot_id: "L-gio", item_price: 1611.50, shipping_charged: 0, shipping_paid: 0, fees: 215.03, cost_basis_total: 1139.00, profit: 257.47, mom_share: 0, sold_on: "2026-11-06" },
];
const split = profitByPerson(pSales, pLots);
eq("person: Judah profit (his + half of Mom's)", split.judah, 449.05);
eq("person: Giovanni profit", split.giovanni, 257.47);
eq("person: Mom profit (her share)", split.mom, 161.65);
eq("person: the three tie to the batch total", Math.round((split.judah + split.giovanni + split.mom) * 100) / 100, 868.17);
const noShows = [], noExp = [], noPur = [];
const scJ = personTaxSummary("judah", 2026, pSales, pLots, noShows, noExp, noPur);
eq("schedC: receipts exclude Giovanni", scJ.grossReceipts, 3505.15);
eq("schedC: COGS excludes Giovanni", scJ.cogs, 2426.76);
eq("schedC: fees exclude Giovanni", scJ.fees, 467.69);
eq("schedC: Mom's share is a cost line", scJ.momShareTotal, 161.65);
eq("schedC: net = Judah's profit", scJ.netProfit, 449.05);
const scG = personTaxSummary("giovanni", 2026, pSales, pLots, noShows, noExp, noPur);
eq("gio memo: receipts are his only", scG.grossReceipts, 1611.50);
eq("gio memo: net = his profit", scG.netProfit, 257.47);
const scM = personTaxSummary("mom", 2026, pSales, pLots, noShows, noExp, noPur);
eq("mom memo: receipts are her items'", scM.grossReceipts, 1921.75);
eq("mom memo: net = her profit share", scM.netProfit, 161.65);

console.log(fails === 0 ? "ALL MATH TESTS PASSED" : `${fails} FAILURES`);
process.exit(fails ? 1 : 0);
