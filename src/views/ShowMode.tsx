import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money, showCashExpected } from "../lib/math";
import { BigButton, Field, inputCls, JobButton, MoneyInput, ScreenTitle } from "../components/ui";
import type { View } from "../App";
import type { Show } from "../lib/types";

export function useShowStats(show: Show | null) {
  const { purchases, sales } = useStore();
  return useMemo(() => {
    if (!show) return null;
    const buys = purchases.filter((p) => p.show_id === show.id);
    const sold = sales.filter((s) => s.show_id === show.id);
    const boughtTotal = buys.reduce((a, p) => a + Number(p.total_cost), 0);
    const boughtUnits = buys.reduce((a, p) => a + p.qty, 0);
    const soldTotal = sold.reduce((a, s) => a + Number(s.item_price), 0);
    const soldUnits = sold.reduce((a, s) => a + s.qty, 0);
    const salesProfit = sold.reduce((a, s) => a + Number(s.profit), 0);
    const cashIn = sold.filter((s) => s.channel === "show_cash").reduce((a, s) => a + Number(s.item_price), 0);
    const cashOut = buys.filter((p) => p.paid_via === "Cash").reduce((a, p) => a + Number(p.total_cost), 0);
    const expected = showCashExpected(Number(show.cash_float), cashIn, cashOut);
    return { buys, sold, boughtTotal, boughtUnits, soldTotal, soldUnits, salesProfit, showProfit: Math.round((salesProfit - Number(show.table_fee)) * 100) / 100, cashIn, cashOut, expected };
  }, [purchases, sales, show]);
}

export default function ShowDashboard({ go }: { go: (v: View) => void }) {
  const { activeShow, shows, startShow, pendingCount, syncNow } = useStore();
  const stats = useShowStats(activeShow);
  const closed = shows.filter((s) => s.status === "closed");
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(`Card Show — ${today}`);
  const [date, setDate] = useState(today);
  const [fee, setFee] = useState("");
  const [floatAmt, setFloatAmt] = useState("200");
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    await startShow(name.trim() || `Card Show — ${date}`, date, parseFloat(fee) || 0, parseFloat(floatAmt) || 0);
    setStarting(false);
  }

  return (
    <div>
      <ScreenTitle title="🎪 Show Mode" sub="Everything you buy and sell gets tagged to the show." />

      {pendingCount > 0 && (
        <button onClick={() => void syncNow()} className="w-full mb-4 rounded-2xl bg-sky-600 text-white py-3.5 font-bold">
          ☁️ {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync — tap to sync now
        </button>
      )}

      {activeShow && stats ? (
        <div>
          <div className="rounded-3xl bg-gradient-to-br from-violet-500 to-purple-700 p-5 mb-4">
            <p className="text-purple-100 font-semibold text-sm">LIVE NOW</p>
            <p className="text-2xl font-black text-white">{activeShow.name}</p>
            <p className="text-purple-100 text-sm">{activeShow.show_date} · table fee {money(Number(activeShow.table_fee))}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="Bought" value={money(stats.boughtTotal)} sub={`${stats.boughtUnits} items`} />
            <Stat label="Sold" value={money(stats.soldTotal)} sub={`${stats.soldUnits} items`} />
            <Stat label="Profit so far" value={money(stats.showProfit)} sub="after table fee" green={stats.showProfit >= 0} />
            <Stat label="Cash in the box" value={money(stats.expected)} sub="should be there" />
          </div>
          <div className="grid gap-3">
            <JobButton emoji="🛒" label="Buy at Show" sub="Ten-second buylist entry" onClick={() => go("showBuy")} />
            <JobButton emoji="💵" label="Sell at Show" sub="Cash or Venmo — no TCGplayer fees" onClick={() => go("showSell")} />
            <BigButton color="red" onClick={() => go("showClose")}>🏁 End the Show — Wrap Up</BigButton>
          </div>
        </div>
      ) : (
        <div>
          <div className="rounded-3xl bg-slate-800 border border-slate-700 p-5 mb-4">
            <Field label="Show name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Table fee">
              <MoneyInput value={fee} onChange={setFee} placeholder="0.00" />
            </Field>
            <Field label="Cash you start with (your float)">
              <MoneyInput value={floatAmt} onChange={setFloatAmt} />
            </Field>
            <BigButton color="green" disabled={starting} onClick={start}>{starting ? "Starting…" : "🎪 Start the show"}</BigButton>
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-6">
          <h2 className="text-white font-bold text-lg mb-2">Past shows</h2>
          <div className="grid gap-2">
            {closed.map((s) => <PastShowRow key={s.id} show={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function PastShowRow({ show }: { show: Show }) {
  const stats = useShowStats(show);
  if (!stats) return null;
  return (
    <div className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 flex justify-between items-center">
      <div>
        <p className="text-white font-semibold">{show.name}</p>
        <p className="text-slate-400 text-sm">{show.show_date} · sold {money(stats.soldTotal)} · bought {money(stats.boughtTotal)}</p>
      </div>
      <span className={`font-black ${stats.showProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(stats.showProfit)}</span>
    </div>
  );
}

function Stat({ label, value, sub, green }: { label: string; value: string; sub?: string; green?: boolean }) {
  return (
    <div className="rounded-3xl bg-slate-800 border border-slate-700 p-4">
      <p className="text-slate-400 font-semibold text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-black mt-0.5 ${green === undefined ? "text-white" : green ? "text-emerald-400" : "text-rose-400"}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs">{sub}</p>}
    </div>
  );
}

export function ShowClose({ go }: { go: (v: View) => void }) {
  const { activeShow, closeShow } = useStore();
  const stats = useShowStats(activeShow);
  const [counted, setCounted] = useState("");
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);

  if (!activeShow || !stats) {
    return (
      <div>
        <ScreenTitle title="🏁 Wrap Up" />
        <p className="text-slate-300">No show is running right now.</p>
        <div className="mt-4"><BigButton color="slate" onClick={() => go("show")}>Back to Show Mode</BigButton></div>
      </div>
    );
  }
  const countedNum = counted === "" ? null : parseFloat(counted) || 0;
  const diff = countedNum === null ? null : Math.round((countedNum - stats.expected) * 100) / 100;

  async function close() {
    setClosing(true);
    await closeShow(activeShow!, countedNum);
    setClosing(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <p className="text-6xl mb-3">🏁</p>
        <p className="text-white text-xl font-bold">{activeShow.name} is closed.</p>
        <p className="text-slate-300 mt-2">Show profit: <span className="font-bold text-white">{money(stats.showProfit)}</span> · Sold {money(stats.soldTotal)} · Bought {money(stats.boughtTotal)}</p>
        <p className="text-slate-400 mt-1">It's in your Past Shows list — that's the report.</p>
        <div className="grid gap-3 mt-6">
          <BigButton onClick={() => go("profit")}>Check my profit</BigButton>
          <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="🏁 Wrap Up the Show" sub={activeShow.name} />
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
        <Row label={`Sold (${stats.soldUnits} items)`} value={money(stats.soldTotal)} />
        <Row label="Profit on what sold" value={money(stats.salesProfit)} />
        <Row label="Table fee" value={`−${money(Number(activeShow.table_fee))}`} />
        <div className="border-t border-slate-600 mt-1 pt-2 flex justify-between text-lg font-bold text-white">
          <span>Show profit</span><span className={stats.showProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>{money(stats.showProfit)}</span>
        </div>
        <Row label={`Spent on new stock (${stats.boughtUnits} items)`} value={money(stats.boughtTotal)} />
      </div>

      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
        <p className="text-white font-bold mb-2">💵 Count the cash box</p>
        <Row label="You started with" value={money(Number(activeShow.cash_float))} />
        <Row label="Cash sales in" value={`+${money(stats.cashIn)}`} />
        <Row label="Cash buys out" value={`−${money(stats.cashOut)}`} />
        <div className="border-t border-slate-600 mt-1 pt-2 flex justify-between font-bold text-white">
          <span>Should be in the box</span><span>{money(stats.expected)}</span>
        </div>
        <div className="mt-3">
          <Field label="Count it — how much is actually there?">
            <MoneyInput value={counted} onChange={setCounted} placeholder="0.00" />
          </Field>
        </div>
        {diff !== null && (
          <p className={`font-bold ${diff === 0 ? "text-emerald-400" : "text-amber-300"}`}>
            {diff === 0 ? "✓ Perfect — the box matches the books." : diff > 0 ? `You're ${money(diff)} OVER — a sale probably didn't get logged.` : `You're ${money(Math.abs(diff))} SHORT — a buy or sale probably didn't get logged. Worth a look before you close.`}
          </p>
        )}
      </div>

      <BigButton color="red" disabled={closing} onClick={close}>{closing ? "Closing…" : "Close the show"}</BigButton>
      <button onClick={() => go("show")} className="w-full py-3 mt-2 text-slate-400 font-semibold">← Not yet — back to the show</button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between py-1.5 text-slate-300"><span>{label}</span><span>{value}</span></div>;
}
