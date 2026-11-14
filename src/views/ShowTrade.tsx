import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money, purchaseMath, quickSaleMath } from "../lib/math";
import { priceProvider, type PriceResult } from "../lib/priceProvider";
import { BigButton, Field, inputCls, MoneyInput, ScreenTitle, ownerLabel } from "../components/ui";
import type { View } from "../App";
import type { Lot } from "../lib/types";

// ---------------- BUY AT SHOW: one screen, ten seconds ----------------
export function ShowBuy({ go }: { go: (v: View) => void }) {
  const { activeShow, addPurchase, products, requestPrices, priceRequests } = useStore();
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [ownerKind, setOwnerKind] = useState<"mine" | "giovanni" | "split" | "mom_payback" | "mom_split">("mine");
  const [splitPct, setSplitPct] = useState(50);
  const [paidVia, setPaidVia] = useState<"Cash" | "Other">("Cash");
  const [market, setMarket] = useState<PriceResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ basis: number; total: number } | null>(null);
  const [savedPid, setSavedPid] = useState<string | null>(null);
  const [doorSent, setDoorSent] = useState(false);

  const up = parseFloat(unitPrice) || 0;
  const math = useMemo(() => purchaseMath(qty, up, 0, 0), [qty, up]);
  const suggestions = useMemo(() => {
    const t = name.trim().toLowerCase();
    if (t.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 3);
  }, [name, products]);

  if (!activeShow) return <NoShow go={go} />;
  if (saved) {
    return (
      <div className="text-center py-6">
        <p className="text-6xl mb-3">✅</p>
        <p className="text-white text-xl font-bold">Bought!</p>
        <p className="text-slate-300 mt-2">{qty} × {name} at {money(saved.basis)} cost each ({money(saved.total)} total) — in your stock, tagged to {activeShow.name}.</p>
        {savedPid && products.find((x) => x.id === savedPid)?.market_price_source !== "tcgplayer" && (
          doorSent || priceRequests.some((r) => (r.status === "pending" || r.status === "working") && r.items.some((i) => i.product_id === savedPid))
            ? <p className="text-sky-300 font-semibold mt-4">Sent to Maven — the TCGplayer price lands in ~15 min ✓</p>
            : <div className="mt-5"><BigButton color="slate" onClick={() => void sendDoor()}>💲 Get the TCGplayer price — Maven, ~15 min</BigButton></div>
        )}
        <div className="grid gap-3 mt-6">
          <BigButton onClick={() => { setSaved(null); setSavedPid(null); setDoorSent(false); setName(""); setUnitPrice(""); setQty(1); setMarket(null); }}>Buy another</BigButton>
          <BigButton color="slate" onClick={() => go("show")}>Back to the show</BigButton>
        </div>
      </div>
    );
  }

  async function lookup() {
    if (name.trim().length < 2) return;
    setLooking(true);
    setMarket(await priceProvider.lookup(name.trim()));
    setLooking(false);
  }
  // The hybrid (DECISIONS #74): instant prices come from the price
  // service; the TCGplayer price comes through the door (~15 min).
  async function sendDoor() {
    if (!savedPid) return;
    if (await requestPrices([{ product_id: savedPid, name: name.trim() }])) setDoorSent(true);
  }
  async function save() {
    setSaving(true);
    const p = await addPurchase({ name: name.trim(), qty, unitPrice: up, taxRate: 0, shippingIn: 0, ownerKind, judahPct: splitPct, paidVia, showId: activeShow!.id });
    setSaved({ basis: p.cost_basis_unit, total: p.total_cost });
    setSavedPid(p.product_id ?? null);
    setDoorSent(false);
    setSaving(false);
  }

  return (
    <div>
      <ScreenTitle title="🛒 Buy at Show" sub={activeShow.name} />
      <Field label="What is it?">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" autoFocus />
      </Field>
      {suggestions.map((p) => (
        <button key={p.id} onClick={() => { setName(p.name); if (p.market_price != null) setMarket({ price: Number(p.market_price), provider: p.market_price_source === "tcgplayer" ? "TCGplayer — via Maven" : "On file", isSample: false, source: p.market_price_source ?? undefined, matchedName: p.name }); }} className="block w-full text-left rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 mb-2 text-white text-sm">{p.name}</button>
      ))}

      <button onClick={lookup} disabled={looking || name.trim().length < 2} className="w-full rounded-2xl bg-slate-700 text-white py-3 font-semibold mb-3 disabled:opacity-40">
        {looking ? "Looking…" : "🔎 Check the market price first"}
      </button>
      {market && market.isSample && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
          <p className="text-white font-bold">No real price found for that name.</p>
          <p className="text-slate-400 text-sm mt-1">Buy on your judgment — once it's saved, you can send it to Maven for the TCGplayer price.</p>
        </div>
      )}
      {market && !market.isSample && market.choices && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
          <p className="text-white font-bold mb-2">Which one is it?</p>
          <div className="grid gap-2">
            {market.choices.map((c, i) => (
              <button key={i} onClick={() => setMarket(c)} className="flex items-center justify-between gap-3 rounded-xl bg-slate-700 px-3 py-2.5 text-left">
                <span className="text-white font-semibold text-sm">{c.matchedName}</span>
                <span className="text-white font-black">{money(c.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {market && !market.isSample && !market.choices && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
          <p className="text-slate-300 text-sm">Market price</p>
          <p className="text-3xl font-black text-white">{money(market.price)}</p>
          {market.source === "tcgplayer"
            ? <p className="text-emerald-400 text-sm font-semibold mt-1">TCGplayer ✓</p>
            : <p className="text-slate-500 text-sm mt-1">Instant price — TCGplayer's may differ</p>}
          <p className="text-slate-400 text-sm mt-2 mb-1.5">Tap an offer price (your buylist %):</p>
          <div className="flex gap-2">
            {[50, 60, 70, 80].map((pct) => (
              <button key={pct} onClick={() => setUnitPrice((Math.round(market.price * pct) / 100).toFixed(2))}
                className="flex-1 rounded-xl bg-yellow-400 text-slate-900 py-2 font-black text-sm">{pct}%<br /><span className="font-bold">{money(market.price * pct / 100)}</span></button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <span className="text-slate-300 font-semibold">How many</span>
        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 rounded-full bg-slate-700 text-white text-2xl font-black">−</button>
        <span className="text-white font-black text-2xl w-8 text-center">{qty}</span>
        <button onClick={() => setQty(qty + 1)} className="w-11 h-11 rounded-full bg-slate-700 text-white text-2xl font-black">+</button>
      </div>
      <Field label="Price you paid for EACH one">
        <MoneyInput value={unitPrice} onChange={setUnitPrice} />
      </Field>
      <div className="flex flex-wrap gap-2 mb-3">
        {(["mine", "giovanni", "split", "mom_payback"] as const).map((k) => (
          <button key={k} onClick={() => setOwnerKind(k)} className={`rounded-xl px-3 py-2.5 font-bold text-sm ${ownerKind === k ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>
            {k === "mine" ? "Mine" : k === "giovanni" ? "Giovanni's" : k === "split" ? "Split" : "Mom paid"}
          </button>
        ))}
      </div>
      {ownerKind === "split" && (
        <Field label={`My share: ${splitPct}%`}>
          <input type="range" min={5} max={95} step={5} value={splitPct} onChange={(e) => setSplitPct(parseInt(e.target.value))} className="w-full accent-yellow-400" />
        </Field>
      )}
      <div className="flex gap-2 mb-4">
        {(["Cash", "Other"] as const).map((k) => (
          <button key={k} onClick={() => setPaidVia(k)} className={`flex-1 rounded-xl py-2.5 font-bold text-sm ${paidVia === k ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>
            {k === "Cash" ? "💵 Cash" : "📱 Venmo / other"}
          </button>
        ))}
      </div>
      {up > 0 && <p className="text-slate-300 mb-3">Total: <span className="font-bold text-white">{money(math.totalCost)}</span> · cost basis {money(math.costBasisUnit)} each</p>}
      <BigButton color="green" disabled={saving || name.trim().length < 2 || up <= 0} onClick={save}>{saving ? "Saving…" : "✓ Bought it"}</BigButton>
      <button onClick={() => go("show")} className="w-full py-3 mt-2 text-slate-400 font-semibold">← Back to the show</button>
    </div>
  );
}

// ---------------- SELL AT SHOW: pick stock, price, cash/venmo, done ----------------
export function ShowSell({ go }: { go: (v: View) => void }) {
  const { activeShow, lots, products, recordQuickSale } = useStore();
  const [lotId, setLotId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [channel, setChannel] = useState<"show_cash" | "show_venmo">("show_cash");
  const [saving, setSaving] = useState(false);
  const [sold, setSold] = useState<{ profit: number; gross: number; momShare: number } | null>(null);

  const stock = useMemo(() => lots.filter((l) => l.qty_on_hand > 0), [lots]);
  const lot: Lot | undefined = stock.find((l) => l.id === lotId);
  const productName = (l: Lot) => products.find((p) => p.id === l.product_id)?.name ?? "Product";
  const unit = parseFloat(price) || 0;
  const preview = lot ? quickSaleMath({ qty, unitPrice: unit, costBasisUnit: lot.cost_basis_unit, judahPct: lot.judah_pct }) : null;

  if (!activeShow) return <NoShow go={go} />;
  if (sold) {
    return (
      <div className="text-center py-6">
        <p className="text-6xl mb-3">💵</p>
        <p className="text-white text-xl font-bold">Sold for {money(sold.gross)}!</p>
        <p className="text-slate-300 mt-2">Profit on that sale: <span className={`font-bold ${sold.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{money(sold.profit)}</span></p>
        {sold.momShare > 0 && <p className="text-slate-300 mt-1">Mom's cut of the profit: <span className="font-bold text-white">{money(sold.momShare)}</span> — added to the owed-to-Mom tab.</p>}
        {sold.momShare < 0 && <p className="text-slate-300 mt-1">That one lost money — the loss splits too, so Mom's tab went down by <span className="font-bold text-white">{money(Math.abs(sold.momShare))}</span>.</p>}
        <div className="grid gap-3 mt-6">
          <BigButton onClick={() => { setSold(null); setLotId(""); setPrice(""); setQty(1); }}>Sell another</BigButton>
          <BigButton color="slate" onClick={() => go("show")}>Back to the show</BigButton>
        </div>
      </div>
    );
  }

  async function save() {
    if (!lot) return;
    setSaving(true);
    const s = await recordQuickSale({ lot, qty, unitPrice: unit, channel, showId: activeShow!.id });
    setSaving(false);
    if (s) setSold({ profit: s.profit, gross: s.item_price, momShare: Number(s.mom_share ?? 0) });
  }

  return (
    <div>
      <ScreenTitle title="💵 Sell at Show" sub={activeShow.name} />
      {!lot ? (
        <div>
          <p className="text-slate-300 mb-3 font-semibold">Tap what you're selling:</p>
          {stock.length === 0 && <p className="text-slate-400">Nothing in stock. Buy something first!</p>}
          <div className="grid gap-2">
            {stock.map((l) => {
              const p = products.find((x) => x.id === l.product_id);
              return (
                <button key={l.id} onClick={() => { setLotId(l.id); setQty(1); if (p?.market_price) setPrice(String(p.market_price)); }}
                  className="w-full rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3.5 text-left">
                  <span className="text-white font-bold block">{productName(l)}</span>
                  <span className="text-slate-400 text-sm">{l.qty_on_hand} on hand · cost {money(Number(l.cost_basis_unit))} · {ownerLabel(l.owner_kind, Number(l.judah_pct))}{p?.market_price ? ` · market ~${money(Number(p.market_price))} (SAMPLE)` : ""}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => go("show")} className="w-full py-3 mt-3 text-slate-400 font-semibold">← Back to the show</button>
        </div>
      ) : (
        <div>
          <p className="text-white font-bold text-lg">{productName(lot)}</p>
          <p className="text-slate-400 text-sm mb-4">{lot.qty_on_hand} on hand · your cost {money(Number(lot.cost_basis_unit))} each · {ownerLabel(lot.owner_kind, Number(lot.judah_pct))}</p>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-slate-300 font-semibold">How many</span>
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 rounded-full bg-slate-700 text-white text-2xl font-black">−</button>
            <span className="text-white font-black text-2xl w-8 text-center">{qty}</span>
            <button onClick={() => setQty(Math.min(lot.qty_on_hand, qty + 1))} className="w-11 h-11 rounded-full bg-slate-700 text-white text-2xl font-black">+</button>
          </div>
          <Field label="Selling price for EACH one">
            <MoneyInput value={price} onChange={setPrice} />
          </Field>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setChannel("show_cash")} className={`flex-1 rounded-xl py-3 font-bold ${channel === "show_cash" ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>💵 Cash</button>
            <button onClick={() => setChannel("show_venmo")} className={`flex-1 rounded-xl py-3 font-bold ${channel === "show_venmo" ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>📱 Venmo</button>
          </div>
          {preview && unit > 0 && (
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
              <p className="text-slate-300">They pay <span className="text-white font-bold">{money(preview.gross)}</span> · your cost {money(preview.costBasisTotal)} · <span className={`font-bold ${preview.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>profit {money(preview.profit)}</span></p>
              <p className="text-slate-500 text-sm">No TCGplayer fees at a show — the whole price is yours.</p>
            </div>
          )}
          <BigButton color="green" disabled={saving || unit <= 0} onClick={save}>{saving ? "Saving…" : "✓ Sold it"}</BigButton>
          <button onClick={() => setLotId("")} className="w-full py-3 mt-2 text-slate-400 font-semibold">← Pick something else</button>
        </div>
      )}
    </div>
  );
}

function NoShow({ go }: { go: (v: View) => void }) {
  return (
    <div>
      <ScreenTitle title="🎪 No show running" sub="Start a show first, then buying and selling tag to it." />
      <BigButton onClick={() => go("show")}>Go start a show</BigButton>
    </div>
  );
}
