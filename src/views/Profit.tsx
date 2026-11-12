import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money, profitForPerson, kindOfLot, isMomKind, type ProfitPerson } from "../lib/math";
import { ScreenTitle } from "../components/ui";

function startOfWeek(): Date { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; }
function startOfMonth(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

export default function Profit({ go }: { go: (v: import("../App").View) => void }) {
  const { sales, lots, products, deleteSale } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [person, setPerson] = useState<ProfitPerson>("judah");
  const belongs = (kind: string) => person === "judah" ? (kind !== "giovanni" && kind !== "jake") : person === "giovanni" ? kind === "giovanni" : person === "jake" ? kind === "jake" : isMomKind(kind);
  const { week, month, all, weekCount, split } = useMemo(() => {
    const w = startOfWeek().getTime(), m = startOfMonth().getTime();
    let week = 0, month = 0, all = 0, weekCount = 0;
    const split: Record<ProfitPerson, number> = { judah: 0, giovanni: 0, mom: 0, jake: 0 };
    for (const s of sales) {
      const kind = kindOfLot(lots, s.lot_id);
      for (const p of ["judah", "giovanni", "mom", "jake"] as ProfitPerson[]) split[p] += profitForPerson(p, s, kind);
      const mine = profitForPerson(person, s, kind);
      const t = new Date(s.sold_on + "T12:00:00").getTime();
      all += mine;
      if (t >= m) month += mine;
      if (t >= w) { week += mine; if (belongs(kind)) weekCount++; }
    }
    const r = (n: number) => Math.round(n * 100) / 100;
    return { week: r(week), month: r(month), all: r(all), weekCount, split: { judah: r(split.judah), giovanni: r(split.giovanni), mom: r(split.mom) } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, lots, person]);

  const stockValue = useMemo(() => {
    let v = 0;
    for (const lot of lots) {
      const p = products.find((x) => x.id === lot.product_id);
      if (p?.market_price) v += lot.qty_on_hand * Number(p.market_price);
    }
    return Math.round(v * 100) / 100;
  }, [lots, products]);
  const units = lots.reduce((s, l) => s + l.qty_on_hand, 0);

  return (
    <div>
      <ScreenTitle title="📈 Profit" sub="Whose profit? Tap a name — the numbers below are that person's." />
      <div className="flex gap-2 mb-4">
        {( [["judah", "Judah"], ["giovanni", "Gio"], ["mom", "Mom"], ["jake", "Jake"]] as [ProfitPerson, string][]).map(([p, label]) => (
          <button key={p} onClick={() => setPerson(p)} className={`flex-1 rounded-2xl border-2 py-3 font-black ${person === p ? "bg-emerald-500 border-emerald-400 text-slate-900" : "bg-slate-800 border-slate-700 text-slate-200"}`}>
            {label}<span className="block text-sm font-bold">{money(split[p])}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 mb-4">
        <ProfitCard label="Profit this week" value={week} sub={`${weekCount} sale${weekCount === 1 ? "" : "s"} this week`} />
        <ProfitCard label="Profit this month" value={month} />
        <ProfitCard label="Profit all time" value={all} />
      </div>
      <button onClick={() => go("books")} className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3.5 text-slate-100 font-bold mb-3">🧾 Books & Taxes — the Schedule C page</button>
      <button onClick={() => go("balances")} className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3.5 text-slate-100 font-bold mb-4">🤝 Who Owes Who — Giovanni, Mom & loans live here now</button>
      <div className="rounded-3xl bg-slate-800 border-2 border-amber-500/70 overflow-hidden mb-5">
        <p className="bg-amber-500 text-slate-900 font-black text-center text-sm px-4 py-2">⚠️ SAMPLE PRICES — demo numbers, NOT real market prices yet</p>
        <div className="p-5">
          <p className="text-slate-400 font-semibold text-sm">At sample prices, your for-sale stock would be about</p>
          <p className="text-3xl font-black text-white mt-1">{money(stockValue)}</p>
          <p className="text-slate-400 text-sm">{units} items in stock. This number becomes real when the live price lookup is turned on.</p>
        </div>
      </div>

      <h2 className="text-white font-bold text-lg mb-2">Recent sales — {person === "judah" ? "Judah" : person === "giovanni" ? "Gio" : person === "jake" ? "Jake" : "Mom"}</h2>
      {sales.length === 0 && <p className="text-slate-400">No sales yet. TCGplayer sales show up when you upload the packing slips; show sales show up from Show Mode.</p>}
      <div className="grid gap-2">
        {sales.filter((s) => belongs(kindOfLot(lots, s.lot_id))).slice(0, 10).map((s) => (
          <div key={s.id} className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-semibold">{s.product_name} × {s.qty}</p>
                <p className="text-slate-400 text-sm">{s.sold_on} · {s.channel === "show_cash" ? "🎪 show · cash" : s.channel === "show_venmo" ? "🎪 show · Venmo" : `your share ${money(Number(s.judah_share))}`}{Number(s.mom_share ?? 0) > 0 ? ` · Mom's profit cut ${money(Number(s.mom_share))}` : ""}</p>
              </div>
              <span className={`font-black ${profitForPerson(person, s, kindOfLot(lots, s.lot_id)) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(profitForPerson(person, s, kindOfLot(lots, s.lot_id)))}</span>
            </div>
            <button
              onClick={() => { if (confirmId === s.id) { void deleteSale(s); setConfirmId(null); } else setConfirmId(s.id); }}
              className={`mt-2 text-sm font-bold rounded-full px-3 py-1 ${confirmId === s.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
              {confirmId === s.id ? "Tap again to undo this sale (stock goes back)" : "Undo this sale"}
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

function ProfitCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-3xl bg-slate-800 border border-slate-700 p-5 flex items-center justify-between">
      <div>
        <p className="text-slate-400 font-semibold text-sm">{label}</p>
        {sub && <p className="text-slate-500 text-sm">{sub}</p>}
      </div>
      <p className={`text-3xl font-black ${value >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(value)}</p>
    </div>
  );
}
