import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { loanMath, money } from "../lib/math";
import { checkForUpdates, consumeJustUpdated, startBackgroundUpdateChecks } from "../lib/pwa";
import { JobButton } from "../components/ui";
import type { View } from "../App";

export default function Home({ go }: { go: (v: View) => void }) {
  const { totalProfit, userEmail, remote, ready, activeShow, pendingCount, syncNow, loans, loanPayments, giovanniOwed, momOwed } = useStore();
  const [checking, setChecking] = useState(false);
  const totalOwed = loans.reduce((sum, loan) => {
    const paid = loanPayments.filter((p) => p.loan_id === loan.id).reduce((a, p) => a + Number(p.amount), 0);
    return sum + loanMath(loan, paid).owed;
  }, 0);
  const [updateMsg, setUpdateMsg] = useState<string | null>(() => (consumeJustUpdated() ? "✓ App updated — this is the newest version." : null));

  useEffect(() => { startBackgroundUpdateChecks(); }, []);

  async function onCheckUpdates() {
    setChecking(true);
    setUpdateMsg(null);
    const r = await checkForUpdates();
    if (r === "current") setUpdateMsg("You're up to date ✓ — checked just now.");
    else if (r === "unavailable") setUpdateMsg("Couldn't check right now — updates also land on their own when you reopen the app.");
    // "reloading" never returns a message: the page is already reloading.
    setChecking(false);
  }
  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 p-5 mb-5 shadow">
        <p className="text-slate-800 font-semibold text-sm">Your profit — all time</p>
        <p className="text-5xl font-black text-slate-900 mt-1">{ready ? money(totalProfit) : "…"}</p>
        <p className="text-slate-700 text-sm mt-1">Everything you've made after fees and costs. Week and month are on Check My Profit.</p>
      </div>


      {userEmail ? (
        <button onClick={() => go("account")} className="w-full mb-4 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-semibold">
          👤 Account — sets, invites & sign-in
        </button>
      ) : (
        <button onClick={() => go("account")} className="w-full mb-4 rounded-2xl bg-yellow-400 text-slate-900 py-3.5 font-black">
          🔑 Sign In — get your real books
        </button>
      )}

      <button onClick={() => void onCheckUpdates()} disabled={checking} className="w-full mb-4 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-semibold disabled:opacity-50">
        {checking ? "🔄 Checking for updates…" : "🔄 Check for updates"}
      </button>
      {updateMsg && <p className="text-center text-sm text-emerald-300 font-semibold -mt-2 mb-3">{updateMsg}</p>}

      {pendingCount > 0 && (
        <button onClick={() => void syncNow()} className="w-full mb-4 rounded-2xl bg-sky-600 text-white py-3.5 font-bold">
          ☁️ {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync — tap to sync now
        </button>
      )}

      <div className="grid gap-3">
        <JobButton emoji="🎪" label="Show Mode" sub={activeShow ? `LIVE: ${activeShow.name} — tap to go back in` : "Show day? Buy and sell at the table here"} onClick={() => go("show")} />
        <JobButton emoji="🛒" label="I Bought Product" sub="Add something you just bought" onClick={() => go("buy")} />
        <JobButton emoji="⚡" label="Quick Add" sub="Bought several things? Paste a list or say them out loud" onClick={() => go("quickadd")} />
        <JobButton emoji="💸" label="I Sold on TCGplayer" sub="Upload the orders file from TCGplayer" onClick={() => go("sell")} />
        <JobButton emoji="📷" label="Scan for Price" sub="What is this worth right now?" onClick={() => go("scan")} />
        <JobButton emoji="🤝" label="Who Owes Who" sub={(() => { const youOwe = totalOwed + momOwed; const parts: string[] = []; if (giovanniOwed > 0) parts.push(`Giovanni owes you ${money(giovanniOwed)}`); if (youOwe > 0) parts.push(`You owe ${money(youOwe)}`); return parts.length ? parts.join(" · ") : "Giovanni, Mom & loans — every balance in one place"; })()} onClick={() => go("balances")} />
        <JobButton emoji="📈" label="Check My Profit" sub="Week, month, and all time" onClick={() => go("profit")} />
        <JobButton emoji="📦" label="What I Have For Sale" sub="Everything listed and ready to sell" onClick={() => go("inventory")} />
      </div>

      <button onClick={() => go("bank")} className="w-full mt-6 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-300 font-semibold">🏦 Bank (coming soon)</button>
      <p className="text-center text-xs text-slate-500 mt-4">
        {remote ? "Connected to your cloud books ✓" : "On-phone mode — books saved on this phone"}
      </p>
    </div>
  );
}
