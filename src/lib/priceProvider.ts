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
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

interface TcgApiItem { name?: string; market_price?: number | null; image_url?: string | null }

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
      const start = await supabase.rpc("price_lookup_start", { p_name: name, p_key: key });
      if (start.error || typeof start.data !== "number") throw new Error("start failed");
      const reqId = start.data as number;
      let body: { data?: TcgApiItem[] } | null = null;
      let failMsg = "";
      for (let i = 0; i < 16 && !body && !failMsg; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        const res = await supabase.rpc("price_lookup_result", { p_id: reqId });
        if (res.error) continue;
        const out = res.data as { state?: string; ok?: boolean; body?: { data?: TcgApiItem[] }; error?: string };
        if (out.state === "pending") continue;
        if (out.ok) body = out.body ?? {};
        else failMsg = out.error ?? "The price service said no.";
      }
      if (!body) {
        const s = await SAMPLE.lookup(name);
        return { ...s, provider: failMsg ? `The price service said: "${failMsg}" — showing SAMPLE` : "Price service is slow right now — showing SAMPLE", isSample: true };
      }
      const json = body;
      const items = (json.data ?? []).filter((d) => typeof d.market_price === "number" && d.market_price > 0);
      if (!items.length) {
        const s = await SAMPLE.lookup(name);
        return { ...s, provider: "No real price found for that name — showing SAMPLE", isSample: true };
      }
      const q = normName(name);
      const pick = items.find((d) => normName(d.name ?? "") === q)
        ?? items.find((d) => normName(d.name ?? "").includes(q) || q.includes(normName(d.name ?? "")))
        ?? items[0];
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
