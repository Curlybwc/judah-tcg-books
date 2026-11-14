// Pure catalog matching for price lookups (DECISIONS #42, tightened #74).
// No browser or network deps so the test script can compile and run it.
//
// The trust rule (Judah, via Jen, 2026-11-13): a wrong price is worse
// than no price. This matcher returns a pick ONLY when the catalog item
// is certainly the product meant. Variant siblings (blister promos that
// differ only in their bracketed promo, Day vs Night editions, a Case
// vs a box) come back as choices for a human tap — never a guess.

export interface MatchItem {
  name?: string;
  market_price?: number | null;
  image_url?: string | null;
  product_type?: string;
}

export function normName(s: string): string {
  // Hyphens vanish (their catalog writes "ultrapremium", not "ultra premium").
  return s.toLowerCase().replace(/-/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const SEALED_WORDS = ["box", "bundle", "tin", "collection", "blister", "booster", "pack", "case"];

// The name with bracketed variant segments removed: "Chaos Rising
// Single Pack Blister [Toxel]" → "chaos rising single pack blister".
// Items that share a base name are variant siblings of one another.
function baseName(name: string): string {
  return normName(name.replace(/\[[^\]]*\]/g, " "));
}

function bracketTokens(name: string): string[] {
  const out: string[] = [];
  for (const m of name.matchAll(/\[([^\]]*)\]/g)) out.push(...normName(m[1]).split(" ").filter(Boolean));
  return out;
}

export function pickMatch(name: string, items: MatchItem[]): { pick?: MatchItem; choices?: MatchItem[] } {
  const q = normName(name);
  const qTokens = new Set(q.split(" ").filter(Boolean));
  const saysCase = qTokens.has("case");
  // A case is never the answer to a name that doesn't say case — and if
  // the case filter empties the pool, the answer is "not found", never a
  // fallback to the very cases the filter removed (DECISIONS #74).
  const pool = items.filter((d) => {
    const hasCase = normName(d.name ?? "").split(" ").includes("case");
    return saysCase ? hasCase : !hasCase;
  });
  if (!pool.length) return {};

  const exact = pool.find((d) => normName(d.name ?? "") === q);
  if (exact) return { pick: exact };

  const contains = pool.filter((d) => {
    const n = normName(d.name ?? "");
    return n.includes(q) || q.includes(n);
  });
  if (contains.length === 1) return { pick: contains[0] };
  if (contains.length > 1) return { choices: contains.slice(0, 3) };

  // Fuzzy token overlap — a pick needs a strong score AND a clear margin
  // over the runner-up AND no unnamed variant siblings in the way.
  const sealedQuery = [...qTokens].some((t) => SEALED_WORDS.includes(t));
  const scored = pool.map((d) => {
    const nTokens = new Set(normName(d.name ?? "").split(" ").filter(Boolean));
    const squished = normName(d.name ?? "").replace(/ /g, "");
    let hit = 0;
    for (const t of qTokens) if (nTokens.has(t) || squished.includes(t)) hit++;
    let score = qTokens.size ? hit / qTokens.size : 0;
    if (sealedQuery && d.product_type === "Sealed Products") score += 0.05;
    return { d, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  if (top && top.score >= 0.85 && (!second || top.score - second.score >= 0.2)) {
    // Variant-sibling guard: if other pool items share the winner's base
    // name and the query doesn't name the winner's bracketed variant,
    // the winner is one of several siblings — a human picks.
    const winnerBase = baseName(top.d.name ?? "");
    const siblings = pool.filter((d) => d !== top.d && baseName(d.name ?? "") === winnerBase);
    const namesVariant = bracketTokens(top.d.name ?? "").every((t) => qTokens.has(t));
    if (!siblings.length || namesVariant) return { pick: top.d };
  }
  const choices = scored.filter((x) => x.score > 0).slice(0, 3).map((x) => x.d);
  return choices.length ? { choices } : {};
}
