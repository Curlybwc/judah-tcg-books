import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import Home from "./views/Home";
import BuyFlow from "./views/BuyFlow";
import SellFlow from "./views/SellFlow";
import ScanPrice from "./views/ScanPrice";
import Balances from "./views/Balances";
import Profit from "./views/Profit";
import Books from "./views/Books";
import QuickAdd from "./views/QuickAdd";
import Inventory from "./views/Inventory";
import BankStub from "./views/BankStub";
import Account from "./views/Account";
import SetsSection from "./views/Sets";
import ShowDashboard, { ShowClose } from "./views/ShowMode";
import { ShowBuy, ShowSell } from "./views/ShowTrade";

export type View = "home" | "buy" | "quickadd" | "sell" | "scan" | "giovanni" | "profit" | "books" | "inventory" | "bank" | "account" | "show" | "showBuy" | "showSell" | "showClose" | "balances";

function Shell() {
  const [view, setView] = useState<View>("home");
  const { ready, notice, userEmail, ownerId, sets, currentSetId, switchSet } = useStore();
  const noSet = !!userEmail && ready && !ownerId;
  const currentSet = sets.find((s) => s.id === currentSetId);
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          {view !== "home" && (
            <button onClick={() => go("home")} className="rounded-full bg-slate-800 border border-slate-700 text-white px-3.5 py-1.5 font-bold" aria-label="Back to start">← Home</button>
          )}
          <p className="text-white font-black text-lg">⚡ Judah TCG Books</p>
          {!userEmail && <span className="ml-auto rounded-full bg-amber-500 text-slate-900 text-[11px] font-black px-2 py-0.5">DEMO DATA</span>}
        </div>
        {userEmail && sets.length > 0 && (
          <div className="max-w-md mx-auto px-4 pb-3">
            {sets.length > 1 ? (
              <select value={currentSetId ?? ""} onChange={(e) => void switchSet(e.target.value)}
                className="w-full rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold px-3 py-2" aria-label="Which set of books">
                {sets.map((s) => <option key={s.id} value={s.id}>📚 {s.name}</option>)}
              </select>
            ) : (
              <p className="text-slate-400 text-sm font-semibold">📚 {currentSet?.name}</p>
            )}
          </div>
        )}
      </header>
      <main className="max-w-md mx-auto px-4 py-5 pb-10">
        {notice && <p className="mb-4 rounded-xl bg-amber-900/50 border border-amber-700 text-amber-100 px-4 py-3 text-sm">{notice}</p>}
        {!ready ? (
          <p className="text-slate-300 text-center py-16 text-lg">Loading your books…</p>
        ) : noSet && view !== "account" ? (
          <div>
            <h1 className="text-2xl font-black text-white mb-1">📚 One last step</h1>
            <p className="text-slate-300">You're signed in. Your books live in a <span className="text-white font-semibold">set</span> — start your own, or join someone else's with the join code they give you.</p>
            <SetsSection />
            <button onClick={() => go("account")} className="w-full mt-5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 py-3 font-semibold">Account & sign out</button>
          </div>
        ) : (
          <>
            {view === "home" && <Home go={go} />}
            {view === "buy" && <BuyFlow go={go} />}
            {view === "quickadd" && <QuickAdd go={go} />}
            {view === "sell" && <SellFlow go={go} />}
            {view === "scan" && <ScanPrice go={go} />}
            {view === "balances" && <Balances go={go} />}
            {view === "profit" && <Profit go={go} />}
            {view === "books" && <Books />}
            {view === "inventory" && <Inventory go={go} />}
            {view === "bank" && <BankStub />}
            {view === "account" && <Account />}
            {view === "show" && <ShowDashboard go={go} />}
            {view === "showBuy" && <ShowBuy go={go} />}
            {view === "showSell" && <ShowSell go={go} />}
            {view === "showClose" && <ShowClose go={go} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
