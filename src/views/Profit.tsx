import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { ScreenTitle } from "../components/ui";

function startOfWeek(): Date { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; }
function startOfMonth(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

export default function Profit() {
  const { sales, payments, giovanniOwed, lots, products, deleteSale, deleteGiovanniPayment } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { week, month, all, weekCount } = useMemo(() => {
    const w = startOfWeek().getTime(), m = startOfMonth().getTime();
    let week = 0, month = 0, all = 0, weekCount = 0;
    for (const s of sales) {
      const t = new Date(s.sold_on + "T12:00:00").getTime();
      all += Number(s.profit);
      if (t >= m) month += Number(s.profit);
      if (t >= w) { week += Number(s.profit); weekCount++; }
    }
    const r = (n: number) => Math.round(n * 100) / 100;
    return { week: r(week), month: r(month), all: r(all), weekCount };
  }, [sales]);

  const stockValue = useMemo(() => {
    let v = 0;
    for (const lot of lots) {
      const p = products.find((x) => x.id === lot.product_id);
      if (p?.market_price) v += lot.qty_on_hand * Number(p.market_price);
    }
    return Math.round(v * 100) / 100;
  }, [lots, products]);
  const units = lots.reduce((s, l) => s + l.qty_on_hand, 0);
  const paidBack = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <ScreenTitle title="📈 Check My Profit" sub="Real math from your buys and sales." />
      <div className="grid gap-3 mb-4">
        <ProfitCard label="Profit this week" value={week} sub={`${weekCount} sale${weekCount === 1 ? "" : "s"} this week`} />
        <ProfitCard label="Profit this month" value={month} />
        <ProfitCard label="Profit all time" value={all} />
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 p-5 mb-3">
        <p className="text-slate-800 font-semibold text-sm">Giovanni owes you</p>
        <p className="text-4xl font-black text-slate-900">{money(giovanniOwed)}</p>
        <p className="text-slate-700 text-sm">He has already paid you back {money(paidBack)} by Zelle.</p>
      </div>
      <div className="rounded-3xl bg-slate-800 border-2 border-amber-500/70 overflow-hidden mb-5">
        <p className="bg-amber-500 text-slate-900 font-black text-center text-sm px-4 py-2">⚠️ SAMPLE PRICES — demo numbers, NOT real market prices yet</p>
        <div className="p-5">
          <p className="text-slate-400 font-semibold text-sm">At sample prices, your for-sale stock would be about</p>
          <p className="text-3xl font-black text-white mt-1">{money(stockValue)}</p>
          <p className="text-slate-400 text-sm">{units} items in stock. This number becomes real when the live price lookup is turned on.</p>
        </div>
      </div>

      <h2 className="text-white font-bold text-lg mb-2">Recent sales</h2>
      {sales.length === 0 && <p className="text-slate-400">No sales yet. TCGplayer sales show up when you upload the orders file; show sales show up from Show Mode.</p>}
      <div className="grid gap-2">
        {sales.slice(0, 10).map((s) => (
          <div key={s.id} className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-semibold">{s.product_name} × {s.qty}</p>
                <p className="text-slate-400 text-sm">{s.sold_on} · {s.channel === "show_cash" ? "🎪 show · cash" : s.channel === "show_venmo" ? "🎪 show · Venmo" : `your share ${money(Number(s.judah_share))}`}</p>
              </div>
              <span className={`font-black ${Number(s.profit) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(Number(s.profit))}</span>
            </div>
            <button
              onClick={() => { if (confirmId === s.id) { void deleteSale(s); setConfirmId(null); } else setConfirmId(s.id); }}
              className={`mt-2 text-sm font-bold rounded-full px-3 py-1 ${confirmId === s.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
              {confirmId === s.id ? "Tap again to undo this sale (stock goes back)" : "Undo this sale"}
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-white font-bold text-lg mt-6 mb-2">Giovanni's payments to you</h2>
      {payments.length === 0 && <p className="text-slate-400">No payments logged yet. When he Zelles you, tap “Giovanni Paid Me” on the home screen.</p>}
      <div className="grid gap-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-white font-semibold">{money(Number(p.amount))}</p>
              <p className="text-slate-400 text-sm">{p.paid_on}{p.note ? ` · ${p.note}` : ""}</p>
            </div>
            <button
              onClick={() => { if (confirmId === p.id) { void deleteGiovanniPayment(p.id); setConfirmId(null); } else setConfirmId(p.id); }}
              className={`text-sm font-bold rounded-full px-3 py-1 ${confirmId === p.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
              {confirmId === p.id ? "Tap again to delete" : "Delete"}
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
