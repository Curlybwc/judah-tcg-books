// Price lookup behind a PROVIDER SEAM.
// Tonight: SamplePriceProvider — prices are SAMPLE (clearly labeled in the UI).
// To go real: implement PriceProvider with the TCG API key (free-tier signup is a
// daytime Jen/Judah step) and swap the one line in `priceProvider` below.

export interface PriceResult {
  price: number;
  provider: string; // shown in the UI — sample provider must say SAMPLE
  isSample: boolean;
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

// THE SEAM: replace with a real provider when the TCG API key exists.
export const priceProvider: PriceProvider = new SamplePriceProvider();
