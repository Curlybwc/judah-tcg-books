import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useStore } from "../lib/store";
import { money, saleMath } from "../lib/math";
import { extractPsRows, isLedgerFile, extractLedgerAmounts, orderKey, nameKey, psTotalsByOrder, psTotalsByName } from "../lib/pirateship";
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
  buyerName: string;
  soldOn: string;
  lotId: string; // "" = unmatched
  orderTotal?: number; // set when the row came from TCGplayer's order-LIST export (totals only, no product lines)
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
  const psRef = useRef<HTMLInputElement>(null);
  const [psNote, setPsNote] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);
  const [psFilled, setPsFilled] = useState<Set<string>>(new Set());
  const [shipPayer, setShipPayer] = useState<Record<string, string>>({});
  const [ledger, setLedger] = useState<{ date: string; cost: number }[] | null>(null);
  const [ledgerDates, setLedgerDates] = useState<string[]>([]);
  const [ledgerDate, setLedgerDate] = useState("");
  const [pickedChip, setPickedChip] = useState<number | null>(null);
  const [usedChips, setUsedChips] = useState<Set<number>>(new Set());
  const [fileNote, setFileNote] = useState<string | null>(null);
  const keyRef = useRef(1000);

  async function readTableFile(file: File): Promise<Record<string, string>[] | null> {
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer());
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        return raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
      } catch { return null; }
    }
    return new Promise((resolve) => {
      Papa.parse<Record<string, string>>(file, { header: true, skipEmptyLines: true, complete: (res) => resolve(res.data), error: () => resolve(null) });
    });
  }

  async function handlePsFile(file: File) {
    const data = await readTableFile(file);
    if (!data) { setPsNote({ tone: "red", text: "Couldn't read that file." }); return; }
    if (isLedgerFile(data)) {
      const { amounts, error } = extractLedgerAmounts(data);
      if (error) { setPsNote({ tone: "red", text: error }); return; }
      const dates = [...new Set(amounts.map((a) => a.date))].sort().reverse();
      setLedger(amounts); setLedgerDates(dates); setLedgerDate(dates[0] ?? "");
      setUsedChips(new Set()); setPickedChip(null);
      setPsNote({ tone: "amber", text: "That's Pirate Ship's billing list — it has the label amounts but doesn't say which order each label was for. Pick a day below, tap an amount, then tap which order it belongs to. They all count as Mom-paid (her bank account)." });
      return;
    }
    {
        const { rows: psRows, error } = extractPsRows(data);
        if (error) { setPsNote({ tone: "red", text: error }); return; }
        const byOrder = psTotalsByOrder(psRows);
        const byName = psTotalsByName(psRows);
        const next = { ...shipPaid };
        const filled = new Set<string>();
        let matchedCost = 0;
        for (const oid of orders) {
          let t = byOrder.get(orderKey(oid));
          if (t == null) {
            const buyer = rows.find((r) => r.orderId === oid)?.buyerName ?? "";
            if (buyer) t = byName.get(nameKey(buyer));
          }
          if (t != null) { next[oid] = t.toFixed(2); filled.add(oid); matchedCost += t; }
        }
        const orderKeys = new Set(orders.map((o) => orderKey(o)));
        const stray = psRows.filter((r) => r.orderId && !orderKeys.has(orderKey(r.orderId))).length;
        setShipPaid(next);
        setPsFilled(filled);
        setShipPayer((prev) => { const np = { ...prev }; filled.forEach((oid) => { np[oid] = "mom"; }); return np; });
        if (!filled.size) setPsNote({ tone: "amber", text: "None of the Pirate Ship labels matched these orders. Check the export includes the Order ID column — or just type the amounts below." });
        else setPsNote({ tone: stray ? "amber" : "green", text: `🚢 Pirate Ship filled in ${filled.size} of ${orders.length} orders — $${matchedCost.toFixed(2)} of postage.${stray ? ` ${stray} label${stray === 1 ? "" : "s"} in the file didn't match an order here.` : ""} Check the numbers below; you can change any of them.` });
    }
  }

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
          const lower = headers.map((h) => h.toLowerCase().trim());
          // TCGplayer's real Orders export is an order LIST: one row per
          // order with a Product Amt total — no product lines at all
          // (DECISIONS #49, from Jen's actual file). Judah tells us which
          // product each order was; the file proves the money.
          const isOrderList = lower.some((h) => h.startsWith("order #")) && lower.some((h) => h.includes("product amt"));
          if (isOrderList) {
            const col = (want: string) => headers[lower.findIndex((h) => h.includes(want))];
            const fO = col("order #"), fD = col("order date"), fSt = col("status"), fB = col("buyer name");
            const fPA = col("product amt"), fSA = col("shipping amt");
            let skipped = 0;
            const parsed: Row[] = [];
            res.data.forEach((r, i) => {
              const oid = (r[fO] ?? "").trim();
              if (!oid) return;
              if (/cancel|refund/i.test(r[fSt] ?? "")) { skipped++; return; }
              const total = parseFloat(r[fPA] ?? "0") || 0;
              parsed.push({
                key: i, orderId: oid, productName: "", qty: 1, unitPrice: total,
                shippingCharged: parseFloat(r[fSA] ?? "0") || 0,
                buyerName: (r[fB] ?? "").trim(),
                soldOn: fD && r[fD] ? toISODate(r[fD]) : new Date().toISOString().slice(0, 10),
                lotId: "", orderTotal: total,
              });
            });
            if (!parsed.length) { setParseError("That file has the right shape but no orders in it — check the date range you picked when you exported."); return; }
            setFileNote(`This is TCGplayer's order list: ${parsed.length} orders with totals, but it doesn't say which products they were. On the next step you pick the product (and how many) for each order — the amounts are already filled in.${skipped ? ` ${skipped} cancelled/refunded order${skipped === 1 ? " was" : "s were"} left out.` : ""}`);
            setRows(parsed);
            const sp: Record<string, string> = {};
            parsed.forEach((r) => { if (!(r.orderId in sp)) sp[r.orderId] = ""; });
            setShipPaid(sp);
            setStep(1);
            return;
          }
          const fName = pickField(headers.filter((h) => !/buyer/i.test(h)), ["product", "item", "name"]);
          const fQty = pickField(headers, ["quantity", "qty"]);
          const fPrice = pickField(headers, ["price", "amount"]);
          const fShip = pickField(headers, ["shipping"]);
          const fOrder = pickField(headers, ["order #", "order id", "order"]);
          const fDate = pickField(headers, ["date"]);
          const fBuyer = pickField(headers, ["buyer", "customer", "recipient"]);
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
              buyerName: fBuyer ? (r[fBuyer] ?? "").trim() : "",
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
      return [{ lot: c.lot, qty: r.qty, unitItemPrice: r.unitPrice, shippingCharged: r.shippingCharged, shippingPaid: c.firstInOrder ? parseFloat(shipPaid[r.orderId]) || 0 : 0, shipPaidBy: c.firstInOrder ? (shipPayer[r.orderId] ?? "mom") : "judah", orderId: r.orderId, soldOn: r.soldOn, orderGroupFirst: c.firstInOrder }];
    });
    await recordSales(payload);
    const fronted = computed.reduce((sum, c) => (c && c.firstInOrder && c.lot.owner_kind === "giovanni" ? sum + (parseFloat(shipPaid[c.row.orderId]) || 0) : sum), 0);
    setResult({ collected: totals.share, owed: Math.round((giovanniOwed + totals.share + fronted) * 100) / 100 });
    setSaving(false);
    setStep(4);
  }

  return (
    <div>
      <ScreenTitle title="💸 Sales" sub="From the orders file TCGplayer gives you." />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4 text-slate-300 text-sm leading-relaxed">
            <p className="font-bold text-white text-base mb-1">How to get the file</p>
            <p>1. Open TCGplayer → Seller Portal → Orders.</p>
            <p>2. Tap Export — you get a file named TCGplayer_OrderList…</p>
            <p>3. Come back here and upload it. It lists each order's total; you'll say which product each one was.</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <BigButton onClick={() => fileRef.current?.click()}>📤 Upload the orders file</BigButton>
          <p className="text-slate-400 text-sm mt-3">🚢 Have a Pirate Ship file too? It comes later — on the <b className="text-slate-200">Shipping you paid</b> step, after you match the sales.</p>
          {parseError && <p className="mt-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3">{parseError}</p>}
          <p className="text-slate-500 text-sm mt-4">No file handy? <a className="underline text-slate-300" href={`${import.meta.env.BASE_URL}sample-orders.csv`} download>Download the sample orders file</a> and upload it here to practice.</p>
        </div>
      )}

      {step === 1 && (
        <div>
          {fileNote
            ? <p className="text-slate-300 mb-3 rounded-xl bg-sky-900/40 border border-sky-700/60 px-4 py-3">{fileNote}</p>
            : <p className="text-slate-300 mb-3">Check each sale is matched to the right product from your stock. Fix any that are wrong.</p>}
          <div className="grid gap-3 mb-4">
            {rows.map((r, i) => {
              const lot = lotById.get(r.lotId);
              return (
                <div key={r.key} className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                  <p className="text-white font-bold">{r.productName || (lot ? productName(lot) : "Which product was this?")}</p>
                  <p className="text-slate-400 text-sm">Order {r.orderId}{r.buyerName ? ` · ${r.buyerName}` : ""} · {r.qty} × {money(r.unitPrice)} · shipping charged {money(r.shippingCharged)}{r.orderTotal != null ? ` · TCGplayer product total ${money(r.orderTotal)}` : ""}</p>
                  {r.orderTotal != null && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-slate-400 text-sm">How many?</span>
                      <button onClick={() => { const q = Math.max(1, r.qty - 1); const next = [...rows]; next[i] = { ...r, qty: q, unitPrice: Math.round((r.orderTotal! / q) * 100) / 100 }; setRows(next); }} className="rounded-lg bg-slate-700 text-white px-3 py-1.5 font-bold">−</button>
                      <span className="text-white font-bold w-6 text-center">{r.qty}</span>
                      <button onClick={() => { const q = r.qty + 1; const next = [...rows]; next[i] = { ...r, qty: q, unitPrice: Math.round((r.orderTotal! / q) * 100) / 100 }; setRows(next); }} className="rounded-lg bg-slate-700 text-white px-3 py-1.5 font-bold">+</button>
                      <span className="text-slate-400 text-sm">at</span>
                      <input className="w-24 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 px-2 py-1.5" inputMode="decimal" value={r.unitPrice} onChange={(e) => { const next = [...rows]; next[i] = { ...r, unitPrice: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0 }; setRows(next); }} />
                      <span className="text-slate-400 text-sm">each</span>
                      <button onClick={() => { const next = [...rows]; next.splice(i + 1, 0, { ...r, key: ++keyRef.current, qty: 1, unitPrice: 0, shippingCharged: 0, lotId: "", orderTotal: undefined, productName: "" }); setRows(next); }} className="ml-auto text-sky-300 text-sm underline">＋ another product in this order</button>
                    </div>
                  )}
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
          <div className="rounded-2xl bg-slate-800 border border-sky-700/60 p-4 mb-4">
            <p className="text-white font-bold mb-1">🚢 Bought your labels on Pirate Ship?</p>
            <p className="text-slate-400 text-sm mb-3">Two files work. The <b className="text-slate-200">Shipments</b> export (Ship → shipments list → Export, Order ID and cost columns on) matches each order by itself. The <b className="text-slate-200">Transactions</b> list (Account → Transactions, the .xlsx) only has amounts — you pick a day and tap each amount onto its order. Either way the labels count as Mom-paid: they come out of her bank account.</p>
            <input ref={psRef} type="file" accept=".csv,.xlsx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePsFile(f); e.target.value = ""; }} />
            <button onClick={() => psRef.current?.click()} className="rounded-xl bg-sky-600 text-white px-4 py-2.5 font-bold">📤 Fill from a Pirate Ship export</button>
            <a className="ml-3 underline text-slate-400 text-sm" href={`${import.meta.env.BASE_URL}sample-pirateship.csv`} download>Sample file</a>
            {psNote && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${psNote.tone === "green" ? "bg-emerald-900/50 text-emerald-200" : psNote.tone === "amber" ? "bg-amber-900/50 text-amber-200" : "bg-rose-900/50 text-rose-200"}`}>{psNote.text}</p>}
            {ledger && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-slate-300 text-sm">Labels bought on</span>
                  <select className="rounded-lg bg-slate-900 border border-slate-700 text-slate-100 px-2 py-1.5" value={ledgerDate} onChange={(e) => { setLedgerDate(e.target.value); setPickedChip(null); }}>
                    {ledgerDates.map((d) => (<option key={d} value={d}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</option>))}
                  </select>
                  <span className="text-slate-400 text-sm">{ledger.filter((a) => a.date === ledgerDate).length} labels · {money(ledger.filter((a) => a.date === ledgerDate).reduce((x, a) => x + a.cost, 0))}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ledger.map((a, ci) => a.date === ledgerDate && (
                    <button key={ci} disabled={usedChips.has(ci)} onClick={() => setPickedChip(pickedChip === ci ? null : ci)}
                      className={`rounded-full px-3 py-1.5 text-sm font-bold ${usedChips.has(ci) ? "bg-slate-900 text-slate-600 line-through" : pickedChip === ci ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>
                      {money(a.cost)}
                    </button>
                  ))}
                </div>
                {pickedChip != null && <p className="text-sky-300 text-sm mt-2">Now tap “Put it here” on the order that label belongs to.</p>}
              </div>
            )}
          </div>
          <div className="grid gap-3 mb-4">
            {orders.map((oid) => (
              <div key={oid} className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                <p className="text-white font-bold mb-2">Order {oid}{psFilled.has(oid) && <span className="ml-2 align-middle"><Chip tone="green">🚢 from Pirate Ship</Chip></span>}</p>
                {pickedChip != null && ledger && (
                  <button onClick={() => { setShipPaid({ ...shipPaid, [oid]: ledger[pickedChip].cost.toFixed(2) }); setShipPayer({ ...shipPayer, [oid]: "mom" }); const u = new Set(usedChips); u.add(pickedChip); setUsedChips(u); setPickedChip(null); }} className="mb-2 rounded-xl bg-yellow-400 text-slate-900 px-3 py-2 font-black text-sm">⬇ Put it here — {money(ledger[pickedChip].cost)}</button>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400 text-sm">Who paid?</span>
                  {([["mom", "Mom"], ["judah", "Judah"]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setShipPayer({ ...shipPayer, [oid]: v })} className={`rounded-full px-3 py-1.5 text-sm font-bold ${(shipPayer[oid] ?? "mom") === v ? "bg-sky-500 text-white" : "bg-slate-700 text-slate-200"}`}>{label}</button>
                  ))}
                  <span className="text-slate-500 text-xs">Mom-paid postage goes on what Judah owes her.</span>
                </div>
                <div className="flex gap-2 mb-2">
                  {[["Stamp $0.78", "0.78"], ["Envelope $1.50", "1.50"], ["Free $0", "0"]].map(([label, v]) => (
                    <button key={v} onClick={() => setShipPaid({ ...shipPaid, [oid]: v })} className={`rounded-full px-3 py-1.5 text-sm font-bold ${shipPaid[oid] === v ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{label}</button>
                  ))}
                </div>
                <input className={inputCls} inputMode="decimal" placeholder="Label amount, e.g. 5.50" value={shipPaid[oid] ?? ""}
                  onChange={(e) => { setShipPaid({ ...shipPaid, [oid]: e.target.value.replace(/[^0-9.]/g, "") }); if (psFilled.has(oid)) { const n = new Set(psFilled); n.delete(oid); setPsFilled(n); } }} />
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
  const d = new Date(s.replace(/^[^,]+,\s*/, ""));
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
