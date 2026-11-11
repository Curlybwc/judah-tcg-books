// Price lookup behind a PROVIDER SEAM.
// Tonight: SamplePriceProvider — prices are SAMPLE (clearly labeled in the UI).
// To go real: implement PriceProvider with the TCG API key (free-tier signup is a
// daytime Jen/Judah step) and swap the one line in `priceProvider` below.

export interface PriceResult {
  price: number;
  provider: string; // shown in the UI — sample provider must say SAMPLE
  isSample: boolean;
  imageUrl?: string; // real providers only: the online product image
  matchedName?: string; // real providers only: which catalog product matched
  choices?: PriceResult[]; // real provider only: no confident match — the user picks
}

export interface PriceProvider {
  lookup(name: string): Promise<PriceResult>;
}

// Sample catalog (approximate market prices for demo only — NOT real market data).
const SAMPLE_PRICES: Record<string, number> = {
  "scarlet & violet 151 elite trainer box": 84.99,
  "prismatic evolutions booster bundle": 54.99,
  "charizard ex premium collection": 119.99,
  "pikachu vmax": 12.5,
  "booster box": 164.99,
  "elite trainer box": 59.99,
  "booster bundle": 34.99,
  "tin": 24.99,
  "blister": 14.99,
};

// Deterministic pseudo-price for unknown names so the demo always answers something.
function hashPrice(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 9.99 + (h % 14000) / 100; // $9.99 – $149.99
}

class SamplePriceProvider implements PriceProvider {
  async lookup(name: string): Promise<PriceResult> {
    const key = name.trim().toLowerCase();
    let price = SAMPLE_PRICES[key];
    if (price === undefined) {
      for (const k of Object.keys(SAMPLE_PRICES)) {
        if (key.includes(k) || k.includes(key)) {
          price = SAMPLE_PRICES[k];
          break;
        }
      }
    }
    if (price === undefined) price = hashPrice(key);
    // Small delay so the "looking it up" automatic step is visible.
    await new Promise((r) => setTimeout(r, 600));
    return { price, provider: "SAMPLE prices (demo)", isSample: true };
  }
}

// --- Real provider: TCG API (tcgapi.dev), wired 2026-11-07 (DECISIONS #21) ---
// Free tier: 100 lookups/day, no card. Prices TCGplayer's catalog INCLUDING
// sealed product (ETBs, booster boxes), which is most of what Judah sells —
// the reason it beat JustTCG (cards only) and pokemontcg.io (closed to new
// keys, no sealed prices). The key is Jen's (their terms require 18+) and is
// entered IN THE APP (Account screen), stored per device in localStorage —
// never in this repo. Successful lookups cache for 12h to protect the quota.

const KEY_LS = "jtb-tcgapi-key";
const CACHE_LS = "jtb-price-cache";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SAMPLE = new SamplePriceProvider();

export function getPriceApiKey(): string {
  try { return localStorage.getItem(KEY_LS) ?? ""; } catch { return ""; }
}
export function setPriceApiKey(k: string): void {
  try {
    if (k.trim()) localStorage.setItem(KEY_LS, k.trim());
    else localStorage.removeItem(KEY_LS);
  } catch { /* private mode etc. */ }
}

interface CacheEntry { price: number; ts: number }
function readCache(name: string): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_LS) ?? "{}") as Record<string, CacheEntry>;
    const e = all[name.trim().toLowerCase()];
    return e && Date.now() - e.ts < CACHE_TTL_MS ? e.price : null;
  } catch { return null; }
}
function writeCache(name: string, price: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_LS) ?? "{}") as Record<string, CacheEntry>;
    all[name.trim().toLowerCase()] = { price, ts: Date.now() };
    localStorage.setItem(CACHE_LS, JSON.stringify(all));
  } catch { /* ignore */ }
}

function normName(s: string): string {
  // Hyphens vanish (their catalog writes "ultrapremium", not "ultra premium").
  return s.toLowerCase().replace(/-/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const SEALED_WORDS = ["box", "bundle", "tin", "collection", "blister", "booster", "pack", "case"];

// Shop slang their catalog never uses — expand before searching, or the
// search finds nothing at all (Jen, 2026-11-11: "30th celebration upc").
const SLANG: Record<string, string> = { upc: "ultra premium collection", etb: "elite trainer box" };
function expandSlang(name: string): string {
  return name.split(/\s+/).map((w) => SLANG[w.toLowerCase().replace(/[^a-z]/g, "")] ?? w).join(" ");
}

// Pick the catalog item a name really means — or none. Rules (DECISIONS #42,
// from the $1,495 Case incident): a CASE never matches a name that doesn't
// say case; exact/contains wins; otherwise token overlap must be strong.
// A weak best guess is NOT returned as a price — the caller offers choices.
function pickMatch(name: string, items: TcgApiItem[]): { pick?: TcgApiItem; choices?: TcgApiItem[] } {
  const q = normName(name);
  const qTokens = new Set(q.split(" ").filter(Boolean));
  const saysCase = qTokens.has("case");
  const pool = items.filter((d) => {
    const hasCase = normName(d.name ?? "").split(" ").includes("case");
    return saysCase ? hasCase : !hasCase;
  });
  const usable = pool.length ? pool : items;
  const exact = usable.find((d) => normName(d.name ?? "") === q);
  if (exact) return { pick: exact };
  const contains = usable.find((d) => { const n = normName(d.name ?? ""); return n.includes(q) || q.includes(n); });
  if (contains) return { pick: contains };
  const sealedQuery = [...qTokens].some((t) => SEALED_WORDS.includes(t));
  const scored = usable.map((d) => {
    const nTokens = new Set(normName(d.name ?? "").split(" ").filter(Boolean));
    const squished = normName(d.name ?? "").replace(/ /g, "");
    let hit = 0;
    for (const t of qTokens) if (nTokens.has(t) || squished.includes(t)) hit++;
    let score = qTokens.size ? hit / qTokens.size : 0;
    if (sealedQuery && d.product_type === "Sealed Products") score += 0.05;
    return { d, score };
  }).sort((a, b) => b.score - a.score);
  if (scored.length && scored[0].score >= 0.7) return { pick: scored[0].d };
  const top = scored.filter((x) => x.score > 0).slice(0, 3).map((x) => x.d);
  return top.length ? { choices: top } : {};
}

interface TcgApiItem { name?: string; market_price?: number | null; image_url?: string | null; product_type?: string }

class TcgApiPriceProvider implements PriceProvider {
  async lookup(name: string): Promise<PriceResult> {
    const key = getPriceApiKey();
    if (!key) return SAMPLE.lookup(name);
    const cached = readCache(name);
    if (cached !== null) return { price: cached, provider: "TCG API — real market price", isSample: false };
    try {
      // The price service's CORS policy only allows its own website, so the
      // browser can never call it directly (DECISIONS #40). The call goes
      // through the app's own cloud books instead: start + poll an RPC that
      // fetches server-side with the user's own key (never stored server-side).
      const { supabase } = await import("./supabase");
      const attempts = [...new Set([name, expandSlang(name)])];
      let items: TcgApiItem[] = [];
      let failMsg = "";
      let matchName = name;
      for (const attempt of attempts) {
        const start = await supabase.rpc("price_lookup_start", { p_name: attempt, p_key: key });
        if (start.error || typeof start.data !== "number") throw new Error("start failed");
        const reqId = start.data as number;
        let body: { data?: TcgApiItem[] } | null = null;
        for (let i = 0; i < 16 && !body && !failMsg; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const res = await supabase.rpc("price_lookup_result", { p_id: reqId });
          if (res.error) continue;
          const out = res.data as { state?: string; ok?: boolean; body?: { data?: TcgApiItem[] }; error?: string };
          if (out.state === "pending") continue;
          if (out.ok) body = out.body ?? {};
          else failMsg = out.error ?? "The price service said no.";
        }
        if (!body) break;
        items = (body.data ?? []).filter((d) => typeof d.market_price === "number" && d.market_price > 0);
        if (items.length) { matchName = attempt; break; }
      }
      if (!items.length && failMsg) {
        const s = await SAMPLE.lookup(name);
        return { ...s, provider: `The price service said: "${failMsg}" — showing SAMPLE`, isSample: true };
      }
      if (!items.length) {
        const s = await SAMPLE.lookup(name);
        return { ...s, provider: "No real price found for that name — showing SAMPLE", isSample: true };
      }
      const { pick, choices } = pickMatch(matchName, items);
      if (!pick) {
        if (choices) {
          return {
            price: 0, provider: "TCG API — pick the right one", isSample: false,
            choices: choices.map((d) => ({ price: d.market_price as number, provider: "TCG API — real market price", isSample: false, imageUrl: d.image_url ?? undefined, matchedName: d.name })),
          };
        }
        const s = await SAMPLE.lookup(name);
        return { ...s, provider: "No real price found for that name — showing SAMPLE", isSample: true };
      }
      const price = pick.market_price as number;
      writeCache(name, price);
      return { price, provider: "TCG API — real market price", isSample: false, imageUrl: pick.image_url ?? undefined, matchedName: pick.name };
    } catch {
      const s = await SAMPLE.lookup(name);
      return { ...s, provider: "Price service didn't answer — showing SAMPLE", isSample: true };
    }
  }
}

// THE SEAM: real provider when a key is set on this device, SAMPLE otherwise.
export const priceProvider: PriceProvider = new TcgApiPriceProvider();

// --- Photo identification (DECISIONS #43) ---
// POST /v1/identify reads a photo and returns the catalog's EXACT name for
// the product — the fix-name loop: scan once, rename the product to their
// name, and every later lookup is a plain (free) name search. Billed in
// scans (25 free once per account), NOT in daily requests. Same proxy ride
// as name lookups: identify_start + price_lookup_result.

export interface IdentifyOutcome {
  status: "matched" | "ambiguous" | "retake" | "not_found" | "unsupported" | "error";
  message?: string;
  scansRemaining?: number;
  candidates: PriceResult[]; // price 0 = the scan didn't price it; price it by name
}

interface IdentifyCandidate {
  name?: string;
  image_url?: string | null;
  suggested_printing?: string | null;
  prices?: { printing?: string; market_price?: number | null }[];
}

export async function identifyByPhoto(dataUrl: string): Promise<IdentifyOutcome> {
  const key = getPriceApiKey();
  if (!key) return { status: "error", message: "Add the price key first (Account → Real prices) — photo scans use the same key.", candidates: [] };
  try {
    const { supabase } = await import("./supabase");
    const start = await supabase.rpc("identify_start", { p_image: dataUrl, p_key: key });
    if (start.error || typeof start.data !== "number") throw new Error("start failed");
    const reqId = start.data as number;
    for (let i = 0; i < 22; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await supabase.rpc("price_lookup_result", { p_id: reqId });
      if (res.error) continue;
      const out = res.data as { state?: string; ok?: boolean; body?: { data?: { status?: string; message?: string | null; candidates?: IdentifyCandidate[] }; meta?: { scans_remaining?: number } }; error?: string };
      if (out.state === "pending") continue;
      if (!out.ok) return { status: "error", message: out.error ?? "The photo service said no.", candidates: [] };
      const d = out.body?.data ?? {};
      const candidates: PriceResult[] = (d.candidates ?? []).map((c) => {
        const rows = (c.prices ?? []).filter((p) => typeof p.market_price === "number" && (p.market_price as number) > 0);
        const row = rows.find((p) => p.printing === c.suggested_printing) ?? rows[0];
        return {
          price: row?.market_price ?? 0,
          provider: "TCG API — photo scan",
          isSample: false,
          imageUrl: c.image_url ?? undefined,
          matchedName: c.name,
        };
      });
      const st = (d.status ?? "not_found") as IdentifyOutcome["status"];
      return { status: st, message: d.message ?? undefined, scansRemaining: out.body?.meta?.scans_remaining, candidates };
    }
    return { status: "error", message: "The photo service is slow right now — try again in a moment. (A slow try still uses a scan if the photo was read.)", candidates: [] };
  } catch {
    return { status: "error", message: "The photo scan didn't go through — check your connection and try again.", candidates: [] };
  }
}
