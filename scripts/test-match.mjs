// Committed matcher test — run with `npm test`.
// Compiles the app's real src/lib/match.ts and checks the trust rules
// (DECISIONS #42, tightened #74): a pick only when the match is certain;
// variant siblings come back as choices, never a guess.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "jtb-match-"));
cpSync(join(root, "src/lib/match.ts"), join(tmp, "match.ts"));
execFileSync(join(root, "node_modules/.bin/tsc"), ["match.ts", "--module", "commonjs", "--target", "es2020", "--outDir", "out"], { cwd: tmp, stdio: "inherit" });
const { pickMatch } = createRequire(import.meta.url)(join(tmp, "out/match.js"));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) { pass++; } else { fail++; console.log("FAIL:", label); } }
const item = (name, price = 10) => ({ name, market_price: price, product_type: "Sealed Products" });

// 1. Exact name picks.
{
  const r = pickMatch("Delta Reign Booster Pack", [item("Delta Reign Booster Pack", 6.26), item("Delta Reign Booster Box", 180)]);
  check("exact picks", r.pick?.name === "Delta Reign Booster Pack" && !r.choices);
}
// 2. A Case is never picked for a name that doesn't say case — even when
//    it is the ONLY result (no fallback to the filtered-out pool).
{
  const r = pickMatch("Ascended Heroes Elite Trainer Box", [item("Ascended Heroes Elite Trainer Box Case", 1614.13)]);
  check("case-only pool: no pick", !r.pick);
  check("case-only pool: no case in choices", !(r.choices ?? []).some((c) => c.name.includes("Case")));
}
// 3. Blister promo siblings: the books name doesn't say which promo →
//    choices, never a pick. (The 2026-11-13 Chaos Rising / Mega Evolution case.)
{
  const sibs = [item("Chaos Rising Single Pack Blister [Toxel]", 6.86), item("Chaos Rising Single Pack Blister [Zacian/Mimikyu]", 13.98), item("Chaos Rising Single Pack Blister [Reshiram/Moltres]", 17.33)];
  const r = pickMatch("Chaos Rising one pack blister", sibs);
  check("blister siblings: no pick", !r.pick);
  check("blister siblings: choices offered", (r.choices ?? []).length === 3);
  const r2 = pickMatch("Mega Evolution one pack blister", [item("Mega Evolution Single Pack Blister [Drifloon]", 13.66), item("Mega Evolution Single Pack Blister [Drifblim]", 13.18), item("Mega Evolution Single Pack Blister [Wailord]", 15.76)]);
  check("ME blister siblings: no pick", !r2.pick);
}
// 4. Naming the variant picks it.
{
  const r = pickMatch("Chaos Rising Single Pack Blister Toxel", [item("Chaos Rising Single Pack Blister [Toxel]", 6.86), item("Chaos Rising Single Pack Blister [Zacian/Mimikyu]", 13.98)]);
  check("named variant picks", r.pick?.name.includes("Toxel"));
}
// 5. Unique contains-match picks.
{
  const r = pickMatch("Sylveon ex Box", [item("30th Celebration Sylveon ex Box", 43.38), item("30th Celebration Greninja ex Box", 41.07)]);
  check("unique contains picks", r.pick?.name.includes("Sylveon"));
}
// 6. Strong unique fuzzy picks (missing a generic word, clear margin).
{
  const r = pickMatch("Prismatic Evolutions Elite Trainer", [item("Prismatic Evolutions Elite Trainer Box", 90), item("Prismatic Evolutions Booster Bundle", 55)]);
  check("strong fuzzy picks", r.pick?.name.includes("Trainer Box"));
}
// 7. Weak fuzzy does NOT pick (the old 0.7 rule picked this at 0.75).
{
  const r = pickMatch("Delta reign individual pack", [item("Delta Reign Booster Pack", 6.26), item("Delta Reign Booster Box", 180)]);
  check("weak fuzzy: no pick", !r.pick);
}
// 8. Close fuzzy race does not pick — margin rule.
{
  const r = pickMatch("Mega Evolution Booster", [item("Mega Evolution Booster Box", 300), item("Mega Evolution Booster Bundle", 52), item("Mega Evolution Booster Pack", 9.18)]);
  check("close race: no pick", !r.pick);
}

console.log(`match tests: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
