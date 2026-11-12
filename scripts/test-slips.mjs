// Packing-slip parser tests (DECISIONS #54). Uses Jen's real slip PDFs
// from ~/workspace/user/files when present (they're business documents —
// never committed; the repo is public). Skips cleanly when absent.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "jtb-slips-"));
cpSync(join(root, "src/lib/slips.ts"), join(tmp, "slips.ts"));
execFileSync(join(root, "node_modules/.bin/tsc"), ["slips.ts", "--module", "commonjs", "--target", "es2020", "--outDir", "out"], { cwd: tmp, stdio: "inherit" });
const { parseSlipsText, cleanProductName } = createRequire(import.meta.url)(join(tmp, "out/slips.js"));

let fails = 0;
function eq(label, actual, expected) {
  const ok = typeof expected === "number" ? Math.abs(actual - expected) < 0.001 : actual === expected;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: expected ${expected}, got ${actual}`);
}

eq("clean: ETB", cleanProductName("Pokemon - ME06: Delta Reign - Delta Reign Elite Trainer Box - Unopened"), "Delta Reign Elite Trainer Box");
eq("clean: UPC Night", cleanProductName("Pokemon - ME: 30th Celebration - 30th Celebration Ultra-Premium Collection [Night] - Unopened"), "30th Celebration Ultra-Premium Collection [Night]");
eq("clean: single", cleanProductName("Pokemon - ME: 30th Celebration - Mewtwo ex - 157/128 - #157/128 - Futuristic Rare - Near Mint Holofoil"), "Mewtwo ex - 157/128 - #157/128 - Futuristic Rare");
eq("clean: one piece", cleanProductName("One Piece Card Game - Extra Booster: One Piece Heroines Edition Vol. 2 - Boa Hancock (028) (Alternate Art) - #EB05-028 - R - Near Mint Foil"), "Boa Hancock (028) (Alternate Art) - #EB05-028 - R");

const files = ["TCGplayer_PackingSlips_20261111_211816.pdf", "TCGplayer_PackingSlips_20261111_212648.pdf"]
  .map((f) => join(root, "../user/files", f)).filter(existsSync);
if (!files.length) { console.log("SKIP: no slip PDFs on this machine."); process.exit(0); }
const { extractText, getDocumentProxy } = await import("unpdf");
const byId = new Map();
for (const f of files) {
  const { readFileSync } = await import("node:fs");
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(f)));
  const { text } = await extractText(pdf, { mergePages: true });
  for (const o of parseSlipsText(Array.isArray(text) ? text.join("\n") : text)) byId.set(o.orderId, o);
}
const orders = [...byId.values()];
eq("slips: 31 unique orders across both PDFs", orders.length, 31);
eq("slips: every order's items sum to its total", orders.every((o) => Math.abs(o.items.reduce((s, i) => s + i.lineTotal, 0) - o.total) < 0.01), true);
eq("slips: grand total ties to the order list", Math.round(orders.reduce((s, o) => s + o.total, 0) * 100) / 100, 6993.06);
const upcDay = orders.filter((o) => o.items[0].name.includes("[Day]")).length;
const upcNight = orders.filter((o) => o.items[0].name.includes("[Night]")).length;
eq("slips: UPC Day orders", upcDay, 7);
eq("slips: UPC Night orders", upcNight, 6);
eq("slips: the 3-ETB order qty", orders.find((o) => o.orderId === "EABFECB2-A7CA75-1B88D").items[0].qty, 3);
eq("slips: Sep 16 ETB date", orders.find((o) => o.orderId === "EABFECB2-8CE005-CF458").soldOn, "2026-09-16");
console.log(fails ? `\n${fails} FAILURES` : "\nAll slip tests passed.");
process.exit(fails ? 1 : 0);
