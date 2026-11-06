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
execFileSync(join(root, "node_modules/.bin/tsc"), ["math.ts", "--module", "commonjs", "--target", "es2020", "--outDir", "out"], { cwd: tmp, stdio: "inherit" });
const { purchaseMath, saleMath, giovanniBalance, quickSaleMath, showCashExpected, taxFromRate, momSplitMath } = createRequire(import.meta.url)(join(tmp, "out/math.js"));

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

// Mom consignment split: sale A numbers (net 67.92, cost 62.50), profit split 50/50.
// Mom gets her 62.50 back + half the 5.42 profit = 65.21; Judah keeps 2.71.
const ms = momSplitMath(67.92, 62.5, 50);
eq("MS momShare", ms.momShare, 65.21); eq("MS judahKeep", ms.judahKeep, 2.71);
// Losing sale: net 50 against 62.50 cost — all proceeds to Mom, Judah keeps 0.
const ml = momSplitMath(50, 62.5, 50);
eq("ML momShare", ml.momShare, 50); eq("ML judahKeep", ml.judahKeep, 0);
// Judah takes 100% of profit: Mom gets exactly her cost back.
const mf = momSplitMath(67.92, 62.5, 100);
eq("MF momShare", mf.momShare, 62.5); eq("MF judahKeep", mf.judahKeep, 5.42);

console.log(fails === 0 ? "ALL MATH TESTS PASSED" : `${fails} FAILURES`);
process.exit(fails ? 1 : 0);
