// Quick-buy line parser (Jen, 2026-11-07 — mined from Card Splitter's Quick
// Entry). Turns pasted lists and voice transcripts into buy rows:
//   "Delta Reign ETB | 4 | 61.00"        (pipe)
//   "Delta Reign ETB, 4, 61.00"          (comma)
//   "Delta Reign ETB x4 @ $61.00"        (loose)
//   "two delta reign etb at sixty-one each"  (voice — number words)
// A row that can't be read comes back with an error instead of a guess, so the
// review screen can flag it rather than silently saving a wrong buy.

export interface QuickBuyRow {
  name: string;
  qty: number;
  unitPrice: number;
  raw: string;
  error?: string;
}

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

// "sixty-one" / "sixty one" / "forty five dollars and fifty cents" → number-ish.
// Returns the value of the first number-word phrase at the START of `words`, and how many words it used.
function numberWordsAt(words: string[], start: number): { value: number; used: number } | null {
  const w = (words[start] ?? "").replace(/-/g, " ");
  const parts = w.split(" ").filter(Boolean);
  // Reassemble: treat hyphenated as two tokens.
  const toks = [...words.slice(0, start), ...parts, ...words.slice(start + 1)];
  const a = toks[start];
  const b = toks[start + 1];
  const c = toks[start + 2];
  const d = toks[start + 3];
  if (a in ONES && ONES[a] > 0 && b === "hundred") {
    let value = ONES[a] * 100;
    let used = 2;
    if (c in TENS) {
      value += TENS[c]; used = 3;
      if (d in ONES && ONES[d] > 0 && ONES[d] < 10) { value += ONES[d]; used = 4; }
    } else if (c in ONES && ONES[c] > 0) { value += ONES[c]; used = 3; }
    return { value, used };
  }
  if (a in TENS && b in ONES && ONES[b] > 0 && ONES[b] < 10) return { value: TENS[a] + ONES[b], used: 2 };
  if (a in TENS) return { value: TENS[a], used: 1 };
  if (a in ONES) return { value: ONES[a], used: 1 };
  return null;
}

// Convert leading number words in a token list to a digit token, where a parser expects one.
function wordsToDigits(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  // Replace any number-word phrase anywhere it appears as qty/price context — do up to 3 passes,
  // each time replacing the FIRST number-word phrase found.
  for (let pass = 0; pass < 3; pass++) {
    let replaced = false;
    for (let i = 0; i < words.length; i++) {
      const probe = numberWordsAt(words, i);
      if (probe) {
        // Expand hyphenated token first so indexes line up.
        const expanded: string[] = [];
        for (const w of words) expanded.push(...w.split("-").filter(Boolean));
        const probe2 = numberWordsAt(expanded, i);
        if (probe2) {
          expanded.splice(i, probe2.used, String(probe2.value));
          words = expanded;
          replaced = true;
        }
        break;
      }
    }
    if (!replaced) break;
  }
  return words.join(" ");
}

function parseMoney(s: string): number {
  const n = parseFloat(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseQuickBuyLine(rawLine: string): QuickBuyRow {
  const raw = rawLine.trim();
  const fail = (error: string): QuickBuyRow => ({ name: raw, qty: 0, unitPrice: 0, raw, error });
  if (!raw) return fail("empty line");

  // Pipe or comma delimited: name | qty | price
  const delim = raw.includes("|") ? "|" : raw.split(",").length >= 3 ? "," : null;
  if (delim) {
    const parts = raw.split(delim).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const [name, qtyS, priceS] = [parts[0], parts[parts.length - 2], parts[parts.length - 1]];
      const qty = parseInt(qtyS.replace(/[^0-9]/g, ""), 10);
      const price = parseMoney(priceS);
      if (!name || !(qty > 0) || !(price > 0)) return fail("couldn't read name, qty, and price");
      return { name, qty, unitPrice: Math.round(price * 100) / 100, raw };
    }
  }

  // Loose / voice: normalize number words, then look for qty and price markers.
  const text = wordsToDigits(raw.toLowerCase().replace(/\$/g, " $ "));
  // Price markers: "at 61", "@ 61", "for 61", "61 each", trailing bare number.
  let price = NaN;
  let rest = text;
  const priceMatch = text.match(/(?:@|at|for)\s*\$?\s*(\d+(?:\.\d{1,2})?)/) ?? text.match(/(\d+(?:\.\d{1,2})?)\s*(?:each|dollars?|bucks)\b/);
  if (priceMatch) {
    price = parseFloat(priceMatch[1]);
    rest = text.replace(priceMatch[0], " ");
  }
  // Qty markers: "x4", "qty 4", leading bare number, "4 ×".
  let qty = NaN;
  const qtyMatch = rest.match(/\bx\s*(\d+)\b/) ?? rest.match(/\bqty\s*(\d+)\b/) ?? rest.match(/^\s*(\d+)\s+/) ?? rest.match(/\b(\d+)\s*(?:of|×|x)\b/);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1], 10);
    rest = rest.replace(qtyMatch[0], " ");
  }
  if (Number.isNaN(price)) {
    // Last resort: a single trailing number is the price.
    const trail = rest.match(/(\d+(?:\.\d{1,2})?)\s*$/);
    if (trail) { price = parseFloat(trail[1]); rest = rest.replace(trail[0], " "); }
  }
  if (Number.isNaN(qty)) qty = 1; // "a 151 ETB at 80" = one item
  const name = rest.replace(/\b(each|dollars?|bucks)\b/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
  if (!name || !(price > 0)) return fail("needs a name and a price — try “Name | qty | price”");
  return { name, qty, unitPrice: Math.round(price * 100) / 100, raw };
}

export function parseQuickBuyText(text: string): QuickBuyRow[] {
  return text.split(/\n|;/).map((l) => l.trim()).filter(Boolean).map(parseQuickBuyLine);
}

// Split a batch shipping-in charge across lines in proportion to line value;
// the last line absorbs rounding so the parts sum to the whole.
export function allocateShipping(rows: { qty: number; unitPrice: number }[], totalShipping: number): number[] {
  const subs = rows.map((r) => r.qty * r.unitPrice);
  const total = subs.reduce((s, v) => s + v, 0);
  if (!(totalShipping > 0) || !(total > 0)) return rows.map(() => 0);
  let assigned = 0;
  return subs.map((sub, i) => {
    if (i === subs.length - 1) return Math.round((totalShipping - assigned) * 100) / 100;
    const v = Math.round((totalShipping * (sub / total)) * 100) / 100;
    assigned += v;
    return v;
  });
}
