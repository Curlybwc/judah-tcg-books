import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import Home from "./views/Home";
import BuyFlow from "./views/BuyFlow";
import SellFlow from "./views/SellFlow";
import ScanPrice from "./views/ScanPrice";
import GiovanniPay from "./views/GiovanniPay";
import Profit from "./views/Profit";
import Inventory from "./views/Inventory";
import BankStub from "./views/BankStub";
import Account from "./views/Account";
import ShowDashboard, { ShowClose } from "./views/ShowMode";
import { ShowBuy, ShowSell } from "./views/ShowTrade";

export type View = "home" | "buy" | "sell" | "scan" | "giovanni" | "profit" | "inventory" | "bank" | "account" | "show" | "showBuy" | "showSell" | "showClose";

function Shell() {
  const [view, setView] = useState<View>("home");
  const { ready, notice } = useStore();
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          {view !== "home" && (
            <button onClick={() => go("home")} className="rounded-full bg-slate-800 border border-slate-700 text-white px-3.5 py-1.5 font-bold" aria-label="Back to start">← Home</button>
          )}
          <p className="text-white font-black text-lg">⚡ Judah TCG Books</p>
          <span className="ml-auto rounded-full bg-amber-500 text-slate-900 text-[11px] font-black px-2 py-0.5">DEMO DATA</span>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-5 pb-10">
        {notice && <p className="mb-4 rounded-xl bg-amber-900/50 border border-amber-700 text-amber-100 px-4 py-3 text-sm">{notice}</p>}
        {!ready ? (
          <p className="text-slate-300 text-center py-16 text-lg">Loading your books…</p>
        ) : (
          <>
            {view === "home" && <Home go={go} />}
            {view === "buy" && <BuyFlow go={go} />}
            {view === "sell" && <SellFlow go={go} />}
            {view === "scan" && <ScanPrice go={go} />}
            {view === "giovanni" && <GiovanniPay go={go} />}
            {view === "profit" && <Profit />}
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
