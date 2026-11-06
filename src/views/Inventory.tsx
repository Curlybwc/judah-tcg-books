import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { Chip, ScreenTitle, ownerLabel } from "../components/ui";
import type { View } from "../App";

export default function Inventory({ go }: { go: (v: View) => void }) {
  const { lots, products, sales, undoPurchaseForLot } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; market: number | null; lots: typeof lots }>();
    for (const lot of lots) {
      if (lot.qty_on_hand <= 0) continue;
      const p = products.find((x) => x.id === lot.product_id);
      const name = p?.name ?? "Product";
      if (!map.has(name)) map.set(name, { name, market: p?.market_price ?? null, lots: [] });
      map.get(name)!.lots.push(lot);
    }
    return [...map.values()];
  }, [lots, products]);
  const totalUnits = groups.reduce((s, g) => s + g.lots.reduce((a, l) => a + l.qty_on_hand, 0), 0);

  return (
    <div>
      <ScreenTitle title="📦 What I Have For Sale" sub={`${totalUnits} items ready to sell. (Your personal collection stays in Collectr — this is only for-sale stock.)`} />
      {groups.length === 0 && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 text-slate-300">
          Nothing for sale yet. Tap “I Bought Product” when you buy something to sell.
        </div>
      )}
      <div className="grid gap-3">
        {groups.map((g) => {
          const units = g.lots.reduce((a, l) => a + l.qty_on_hand, 0);
          return (
            <div key={g.name} className="rounded-3xl bg-slate-800 border border-slate-700 p-5">
              <div className="flex justify-between items-start gap-3">
                <p className="text-white font-bold text-lg leading-snug">{g.name}</p>
                <span className="rounded-full bg-yellow-400 text-slate-900 font-black px-3 py-1 text-sm whitespace-nowrap">{units} on hand</span>
              </div>
              {g.market !== null && <p className="text-slate-400 text-sm mt-1">Selling for about {money(g.market)} each <Chip tone="amber">SAMPLE price</Chip></p>}
              <div className="mt-2 grid gap-1.5">
                {g.lots.map((l) => {
                  const soldFrom = sales.some((s) => s.lot_id === l.id);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2">
                      <p className="text-slate-400 text-sm">{l.qty_on_hand} × at {money(Number(l.cost_basis_unit))} cost · <span className="text-slate-200 font-semibold">{ownerLabel(l.owner_kind, Number(l.judah_pct))}</span></p>
                      {!soldFrom && (
                        <button
                          onClick={() => { if (confirmId === l.id) { void undoPurchaseForLot(l); setConfirmId(null); } else setConfirmId(l.id); }}
                          className={`shrink-0 text-xs font-bold rounded-full px-2.5 py-1 ${confirmId === l.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                          {confirmId === l.id ? "Tap again to undo this buy" : "Undo buy"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => go("buy")} className="w-full mt-5 rounded-2xl bg-yellow-400 text-slate-900 py-4 font-bold text-lg">🛒 I bought more product</button>
    </div>
  );
}
