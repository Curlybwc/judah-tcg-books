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
const { extractPsRows, psTotalsByOrder, psTotalsByName, orderKey } = createRequire(import.meta.url)(join(tmp, "out/pirateship.js"));

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
