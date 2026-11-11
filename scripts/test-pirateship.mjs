// Pirate Ship import tests (DECISIONS #33) — run with `npm test`.
// Compiles the app's real src/lib/pirateship.ts and checks the matching
// against Pirate Ship-shaped export rows.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "jtb-ps-"));
cpSync(join(root, "src/lib/pirateship.ts"), join(tmp, "pirateship.ts"));
execFileSync(join(root, "node_modules/.bin/tsc"), ["pirateship.ts", "--module", "commonjs", "--target", "es2020", "--outDir", "out"], { cwd: tmp, stdio: "inherit" });
const { extractPsRows, psTotalsByOrder, psTotalsByName, orderKey, isLedgerFile, extractLedgerAmounts } = createRequire(import.meta.url)(join(tmp, "out/pirateship.js"));

let fails = 0;
function eq(label, actual, expected) {
  const ok = typeof expected === "number" ? Math.abs(actual - expected) < 0.001 : actual === expected;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: expected ${expected}, got ${actual}`);
}

const records = [
  { "Date": "11/05/2026", "Order ID": "TCG-100001", "Recipient": "Sample Buyer", "Service": "USPS Ground Advantage", "Tracking Number": "94001", "Total Cost": "5.50" },
  { "Date": "11/05/2026", "Order ID": "TCG-100002", "Recipient": "Second Buyer", "Service": "USPS Ground Advantage", "Tracking Number": "94002", "Total Cost": "$3.25" },
  { "Date": "11/06/2026", "Order ID": "TCG-100002", "Recipient": "Second Buyer", "Service": "USPS Ground Advantage", "Tracking Number": "94003", "Total Cost": "2.25" },
  { "Date": "11/06/2026", "Order ID": "", "Recipient": "Name Only Buyer", "Service": "USPS Ground Advantage", "Tracking Number": "94004", "Total Cost": "4.10" },
];
const { rows, error } = extractPsRows(records);
eq("no parse error", error, null);
eq("row count", rows.length, 4);
eq("dollar sign stripped", rows[1].cost, 3.25);

const byOrder = psTotalsByOrder(rows);
eq("single-label order total", byOrder.get(orderKey("TCG-100001")), 5.5);
eq("split shipment sums", byOrder.get(orderKey("tcg100002")), 5.5);
eq("order key normalizes case and dashes", orderKey("TCG-100001"), orderKey("tcg 100001".replace(" ", "-")));

const byName = psTotalsByName(rows);
eq("name fallback total", byName.get("name only buyer"), 4.1);

const bad = extractPsRows([{ "Order ID": "X-1", "Recipient": "A" }]);
eq("missing cost column errors", typeof bad.error, "string");
eq("missing cost column yields no rows", bad.rows.length, 0);

const alt = extractPsRows([{ "Order Number": "A-9", "Name": "Zed", "Postage": "6.00" }]);
eq("alternate headers parse", alt.rows.length, 1);
eq("alternate cost", alt.rows[0].cost, 6.0);
eq("alternate order id", alt.rows[0].orderId, "A-9");

console.log(fails ? `\n${fails} FAILURES` : "\nAll Pirate Ship tests passed.");
process.exit(fails ? 1 : 0);

// The Transactions ledger (DECISIONS #50): labels only, amounts positive,
// dates normalized; payments never count as postage.
const ledger = [
  { "Date": "11/11/26 2:09 PM CST", "Type": "Payment", "Description": "Bank Payment: Main Checking", "Total": "9.5", "Balance": "0.0" },
  { "Date": "11/11/26 2:09 PM CST", "Type": "Label", "Description": "TCGplayer_ShippingExport_20261111_140751: 1 Label Batch", "Total": "-9.5", "Balance": "-9.5" },
  { "Date": "11/11/26 2:07 PM CST", "Type": "Label", "Description": "TCGplayer_ShippingExport_20261111_140501: 1 Label Batch", "Total": "-8.36", "Balance": "-8.36" },
  { "Date": "4/8/26 5:25 PM CDT", "Type": "Label", "Description": "TCGplayer_ShippingExport_20260408_172500: 1 Label Batch", "Total": "-6.25", "Balance": "-6.25" },
];
eq("ledger: detected", isLedgerFile(ledger), true);
eq("ledger: grid file is not a ledger", isLedgerFile(records), false);
const la = extractLedgerAmounts(ledger);
eq("ledger: 3 label amounts", la.amounts.length, 3);
eq("ledger: first amount", la.amounts[0].cost, 9.5);
eq("ledger: date normalized", la.amounts[0].date, "2026-11-11");
eq("ledger: old date normalized", la.amounts[2].date, "2026-04-08");
eq("ledger: total", Math.round(la.amounts.reduce((x, a) => x + a.cost, 0) * 100) / 100, 24.11);
