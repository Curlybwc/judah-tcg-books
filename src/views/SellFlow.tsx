import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useStore } from "../lib/store";
import { money, saleMath } from "../lib/math";
import { BigButton, Chip, inputCls, MathRow, ScreenTitle, StepRail, ownerLabel } from "../components/ui";
import type { View } from "../App";
import type { Lot } from "../lib/types";

const STEPS = ["Upload orders", "Match your stock", "Shipping you paid", "Check the math", "Done"];

interface Row {
  key: number;
  orderId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  shippingCharged: number;
  soldOn: string;
  lotId: string; // "" = unmatched
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function score(a: string, b: string): number {
  const na = norm(a), nb = norm(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  const ta = new Set(na.split(" ")), tb = new Set(nb.split(" "));
  let hit = 0; tb.forEach((t) => { if (ta.has(t)) hit++; });
  return Math.round((hit / Math.max(tb.size, 1)) * 60);
}
function pickField(headers: string[], wants: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const w of wants) {
    const i = lower.findIndex((h) => h.includes(w));
    if (i >= 0) return headers[i];
  }
  return null;
}

export default function SellFlow({ go }: { go: (v: View) => void }) {
  const { lots, products, recordSales, giovanniOwed, sales: existingSales } = useStore();
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [shipPaid, setShipPaid] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ collected: number; owed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stockLots = useMemo(() => lots.filter((l) => l.qty_on_hand > 0), [lots]);
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const productName = (lot: Lot) => products.find((p) => p.id === lot.product_id)?.name ?? "Product";

  function handleFile(file: File) {
    setParseError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        try {
          const headers = res.meta.fields ?? [];
          const fName = pickField(headers, ["product", "item", "name"]);
          const fQty = pickField(headers, ["quantity", "qty"]);
          const fPrice = pickField(headers, ["price", "amount"]);
          const fShip = pickField(headers, ["shipping"]);
          const fOrder = pickField(headers, ["order #", "order id", "order"]);
          const fDate = pickField(headers, ["date"]);
          if (!fName || !fPrice) { setParseError("That file doesn't look like a TCGplayer orders export — I couldn't find product and price columns."); return; }
          const parsed: Row[] = res.data.filter((r) => (r[fName] ?? "").trim()).map((r, i) => {
            const rawName = (r[fName] ?? "").trim();
            let best: Lot | null = null; let bestScore = 0;
            for (const lot of stockLots) { const s = score(rawName, productName(lot)); if (s > bestScore) { bestScore = s; best = lot; } }
            return {
              key: i,
              orderId: fOrder ? (r[fOrder] ?? `row-${i + 1}`).trim() || `row-${i + 1}` : `row-${i + 1}`,
              productName: rawName,
              qty: Math.max(1, parseInt(fQty ? r[fQty] : "1") || 1),
              unitPrice: parseFloat(fPrice ? r[fPrice] : "0") || 0,
              shippingCharged: fShip ? parseFloat(r[fShip]) || 0 : 0,
              soldOn: fDate && r[fDate] ? toISODate(r[fDate]) : new Date().toISOString().slice(0, 10),
              lotId: best && bestScore >= 40 ? best.id : "",
            };
          });
          if (!parsed.length) { setParseError("No product rows found in that file."); return; }
          setRows(parsed);
          const sp: Record<string, string> = {};
          parsed.forEach((r) => { if (!(r.orderId in sp)) sp[r.orderId] = ""; });
          setShipPaid(sp);
          setStep(1);
        } catch { setParseError("Something went wrong reading that file. Try downloading it again from TCGplayer."); }
      },
      error: () => setParseError("Couldn't read that file."),
    });
  }

  // Duplicate guard: a row is a duplicate if the same order + product + qty + line total
  // is already in the books (the database also enforces this with a unique index).
  const dupFlags = useMemo(() => rows.map((r) => {
    const lot = lotById.get(r.lotId);
    const matchedName = lot ? productName(lot) : r.productName;
    const lineTotal = Math.round(r.unitPrice * r.qty * 100) / 100;
    return existingSales.some((s) => s.order_id === r.orderId && s.qty === r.qty
      && Math.abs(Number(s.item_price) - lineTotal) < 0.005 && s.product_name === matchedName);
  }), [rows, lotById, existingSales, products]);
  const dupCount = dupFlags.filter(Boolean).length;

  // Stock guard: a matched row asking for more than the lot holds is skipped, never sold negative.
  const overFlags = useMemo(() => rows.map((r) => {
    const lot = lotById.get(r.lotId);
    return !!lot && r.qty > lot.qty_on_hand;
  }), [rows, lotById]);
  const overCount = overFlags.filter(Boolean).length;

  const orders = useMemo(() => {
    const seen: string[] = [];
    rows.forEach((r, i) => { if (!dupFlags[i] && !overFlags[i] && !seen.includes(r.orderId)) seen.push(r.orderId); });
    return seen;
  }, [rows, dupFlags, overFlags]);

  const computed = useMemo(() => rows.map((r, i) => {
    const lot = lotById.get(r.lotId);
    if (!lot || dupFlags[i] || overFlags[i]) return null;
    const firstInOrder = rows.findIndex((x, j) => x.orderId === r.orderId && !dupFlags[j] && !overFlags[j]) === rows.indexOf(r);
    const sp = firstInOrder ? parseFloat(shipPaid[r.orderId]) || 0 : 0;
    const m = saleMath({ qty: r.qty, unitItemPrice: r.unitPrice, shippingCharged: r.shippingCharged, shippingPaid: sp, costBasisUnit: lot.cost_basis_unit, judahPct: lot.judah_pct });
    if (!firstInOrder) { // $0.30 flat fee is per ORDER, not per row
      m.transactionFee = Math.round((m.transactionFee - 0.3) * 100) / 100;
      m.fees = Math.round((m.fees - 0.3) * 100) / 100;
      m.netProceeds = Math.round((m.netProceeds + 0.3) * 100) / 100;
      m.profit = Math.round((m.profit + 0.3) * 100) / 100;
      m.judahShare = Math.round(m.netProceeds * (lot.judah_pct / 100) * 100) / 100;
    }
    return { row: r, lot, math: m, firstInOrder };
  }), [rows, lotById, shipPaid, dupFlags, overFlags]);

  const allMatched = rows.length > 0 && rows.every((r, i) => dupFlags[i] || r.lotId);
  const hasSavable = rows.some((r, i) => !dupFlags[i] && !overFlags[i] && r.lotId);
  const totals = useMemo(() => {
    let profit = 0, share = 0, net = 0;
    for (const c of computed) if (c) { profit += c.math.profit; share += c.math.judahShare; net += c.math.netProceeds; }
    return { profit: Math.round(profit * 100) / 100, share: Math.round(share * 100) / 100, net: Math.round(net * 100) / 100 };
  }, [computed]);

  async function save() {
    setSaving(true);
    const payload = rows.flatMap((r, i) => {
      const c = computed[i];
      if (!c) return []; // unmatched or duplicate — skipped
      return [{ lot: c.lot, qty: r.qty, unitItemPrice: r.unitPrice, shippingCharged: r.shippingCharged, shippingPaid: c.firstInOrder ? parseFloat(shipPaid[r.orderId]) || 0 : 0, orderId: r.orderId, soldOn: r.soldOn, orderGroupFirst: c.firstInOrder }];
    });
    await recordSales(payload);
    setResult({ collected: totals.share, owed: Math.round((giovanniOwed + totals.share) * 100) / 100 });
    setSaving(false);
    setStep(4);
  }

  return (
    <div>
      <ScreenTitle title="💸 I Sold on TCGplayer" sub="Sales come from the orders file TCGplayer gives you." />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4 text-slate-300 text-sm leading-relaxed">
            <p className="font-bold text-white text-base mb-1">How to get the file</p>
            <p>1. Open TCGplayer → Seller Portal → Orders.</p>
            <p>2. Tap Export / Download CSV.</p>
            <p>3. Come back here and upload it.</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <BigButton onClick={() => fileRef.current?.click()}>📤 Upload the orders file</BigButton>
          {parseError && <p className="mt-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3">{parseError}</p>}
          <p className="text-slate-500 text-sm mt-4">No file handy? <a className="underline text-slate-300" href="/sample-orders.csv" download>Download the sample orders file</a> and upload it here to practice.</p>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-slate-300 mb-3">Check each sale is matched to the right product from your stock. Fix any that are wrong.</p>
          <div className="grid gap-3 mb-4">
            {rows.map((r, i) => {
              const lot = lotById.get(r.lotId);
              return (
                <div key={r.key} className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                  <p className="text-white font-bold">{r.productName}</p>
                  <p className="text-slate-400 text-sm">Order {r.orderId} · {r.qty} × {money(r.unitPrice)} · shipping charged {money(r.shippingCharged)}</p>
                  <div className="mt-2">
                    <select className={inputCls} value={r.lotId} onChange={(e) => { const next = [...rows]; next[i] = { ...r, lotId: e.target.value }; setRows(next); }}>
                      <option value="">— Pick which stock this came from —</option>
                      {stockLots.map((l) => (<option key={l.id} value={l.id}>{productName(l)} ({l.qty_on_hand} on hand, cost {money(l.cost_basis_unit)})</option>))}
                    </select>
                  </div>
                  {dupFlags[i]
                    ? <p className="mt-2"><Chip tone="amber">Already imported — will be skipped</Chip></p>
                    : overFlags[i]
                    ? <p className="mt-2"><Chip tone="red">Only {lot?.qty_on_hand} on hand — this sale asks for {r.qty}. Will be skipped</Chip></p>
                    : lot ? <p className="mt-2"><Chip tone="green">{ownerLabel(lot.owner_kind, lot.judah_pct)}</Chip> <span className="text-slate-400 text-sm">cost {money(lot.cost_basis_unit)} each</span></p>
                    : <p className="mt-2"><Chip tone="red">Not matched yet</Chip></p>}
                </div>
              );
            })}
          </div>
          {dupCount > 0 && <p className="text-amber-300 text-sm mb-3">⚠️ {dupCount} sale{dupCount === 1 ? " is" : "s are"} already in your books from this file — {dupCount === 1 ? "it" : "they"} will be skipped, not counted twice.</p>}
          {overCount > 0 && <p className="text-rose-300 text-sm mb-3">⚠️ {overCount} sale{overCount === 1 ? "" : "s"} ask{overCount === 1 ? "s" : ""} for more than you have in stock — check the match {overCount === 1 ? "is" : "are"} right, or {overCount === 1 ? "it" : "they"} will be skipped. If you sold from a different purchase of the same product, pick that one.</p>}
          {!hasSavable
            ? <BigButton color="slate" onClick={() => go("home")}>{dupCount === rows.length ? "Everything here is already imported — back to start" : "Nothing here can be saved — back to start"}</BigButton>
            : <BigButton disabled={!allMatched} onClick={() => setStep(2)}>{allMatched ? "Matches look right →" : "Match every sale to continue"}</BigButton>}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-slate-300 mb-3">What did YOU pay to ship each order? Tap a preset or type the label amount.</p>
          <div className="grid gap-3 mb-4">
            {orders.map((oid) => (
              <div key={oid} className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                <p className="text-white font-bold mb-2">Order {oid}</p>
                <div className="flex gap-2 mb-2">
                  {[["Stamp $0.78", "0.78"], ["Envelope $1.50", "1.50"], ["Free $0", "0"]].map(([label, v]) => (
                    <button key={v} onClick={() => setShipPaid({ ...shipPaid, [oid]: v })} className={`rounded-full px-3 py-1.5 text-sm font-bold ${shipPaid[oid] === v ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{label}</button>
                  ))}
                </div>
                <input className={inputCls} inputMode="decimal" placeholder="Label amount, e.g. 5.50" value={shipPaid[oid] ?? ""}
                  onChange={(e) => setShipPaid({ ...shipPaid, [oid]: e.target.value.replace(/[^0-9.]/g, "") })} />
              </div>
            ))}
          </div>
          <BigButton onClick={() => setStep(3)}>Next — show me the math →</BigButton>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="grid gap-3 mb-4">
            {computed.map((c, i) => c && (
              <div key={i} className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                <p className="text-white font-bold">{c.row.productName} × {c.row.qty}</p>
                <MathRow label="Sold for + shipping charged" value={money(c.math.base)} />
                <MathRow label="TCGplayer fees" value={`−${money(c.math.fees)}`} negative />
                <MathRow label="Shipping you paid" value={`−${money(c.firstInOrder ? parseFloat(shipPaid[c.row.orderId]) || 0 : 0)}`} negative />
                <MathRow label="Your cost" value={`−${money(c.math.costBasisTotal)}`} negative />
                <MathRow label="Profit" value={money(c.math.profit)} bold />
                <p className="text-slate-400 text-sm mt-1">Your share of the money Giovanni collected: <span className="text-white font-bold">{money(c.math.judahShare)}</span> ({ownerLabel(c.lot.owner_kind, c.lot.judah_pct)})</p>
              </div>
            ))}
          </div>
          {dupCount > 0 && <p className="text-amber-300 text-sm mb-3">Skipping {dupCount} already-imported sale{dupCount === 1 ? "" : "s"} — not counted below.</p>}
          {overCount > 0 && <p className="text-rose-300 text-sm mb-3">Skipping {overCount} sale{overCount === 1 ? "" : "s"} that asked for more than you have in stock — not counted below.</p>}
          <div className="rounded-2xl bg-slate-800 border border-yellow-500/50 p-4 mb-4">
            <MathRow label="Total profit" value={money(totals.profit)} bold />
            <MathRow label="Giovanni collected for you" value={money(totals.share)} bold />
          </div>
          <BigButton color="green" disabled={saving} onClick={save}>{saving ? "Saving…" : "✓ Save these sales"}</BigButton>
        </div>
      )}

      {step === 4 && result && (
        <div className="text-center py-6">
          <p className="text-6xl mb-3">✅</p>
          <p className="text-white text-xl font-bold">Sales saved!</p>
          <p className="text-slate-200 mt-3 text-lg">Giovanni collected <span className="font-bold text-yellow-300">{money(result.collected)}</span> for you.</p>
          <p className="text-slate-200 text-lg">He now owes you <span className="font-bold text-yellow-300">{money(result.owed)}</span> total.</p>
          <div className="grid gap-3 mt-6">
            <BigButton onClick={() => go("profit")}>Check my profit</BigButton>
            <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

function toISODate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
