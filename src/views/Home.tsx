import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { JobButton } from "../components/ui";
import type { View } from "../App";

export default function Home({ go }: { go: (v: View) => void }) {
  const { giovanniOwed, userEmail, remote, ready } = useStore();
  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 p-5 mb-5 shadow">
        <p className="text-slate-800 font-semibold text-sm">Giovanni owes you</p>
        <p className="text-5xl font-black text-slate-900 mt-1">{ready ? money(giovanniOwed) : "…"}</p>
        <p className="text-slate-700 text-sm mt-1">He collects the TCGplayer payouts. This is your share he still needs to Zelle you.</p>
      </div>

      <div className="grid gap-3">
        <JobButton emoji="🛒" label="I Bought Product" sub="Add something you just bought" onClick={() => go("buy")} />
        <JobButton emoji="💸" label="I Sold on TCGplayer" sub="Upload the orders file from TCGplayer" onClick={() => go("sell")} />
        <JobButton emoji="📷" label="Scan for Price" sub="What is this worth right now?" onClick={() => go("scan")} />
        <JobButton emoji="🤝" label="Giovanni Paid Me" sub="He sent you a Zelle? Log it here" onClick={() => go("giovanni")} />
        <JobButton emoji="📈" label="Check My Profit" sub="Week, month, and all time" onClick={() => go("profit")} />
        <JobButton emoji="📦" label="What I Have For Sale" sub="Everything listed and ready to sell" onClick={() => go("inventory")} />
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={() => go("bank")} className="flex-1 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-300 font-semibold">🏦 Bank (coming soon)</button>
        <button onClick={() => go("account")} className="flex-1 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-300 font-semibold">{userEmail ? "👤 Account" : "🔑 Sign In"}</button>
      </div>
      <p className="text-center text-xs text-slate-500 mt-4">
        {remote ? "Connected to your cloud books ✓" : "On-phone mode — books saved on this phone"}
      </p>
    </div>
  );
}
