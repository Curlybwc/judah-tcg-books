import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money, personTaxSummary, kindOfLot, isMomKind, type ProfitPerson } from "../lib/math";
import { BigButton, Field, inputCls, MoneyInput, ScreenTitle } from "../components/ui";
import type { ExpenseCategory } from "../lib/types";

// Books & Taxes (Jen, 2026-11-07): one page shaped like Schedule C, so at tax
// time she opens this, picks the year, and copies the numbers onto the form.
// NOTE (Jen's ruling, 2026-11-07, DECISIONS #27): there is deliberately NO
// supplies category here — shipping supplies (boxes, 4x6 envelopes) are
// minimal and bought by Mom herself, so they are not Judah's expense and are
// not tracked in his books.
const CATEGORY_LABELS: Record<ExpenseCategory, { label: string; line: string }> = {
  postage: { label: "Postage & shipping (extra)", line: "Line 27 — Other expenses" },
  advertising: { label: "Advertising", line: "Line 8 — Advertising" },
  other: { label: "Other expense", line: "Line 27 — Other expenses" },
};

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2 border-b border-slate-700/60 ${bold ? "" : ""}`}>
      <span className={bold ? "text-white font-bold" : "text-slate-300"}>{label}</span>
      <span className={`${bold ? "text-white font-black text-lg" : "text-slate-100 font-semibold"}`}>{money(value)}</span>
    </div>
  );
}

export default function Books() {
  const { sales, shows, purchases, expenses, lots, addExpense, deleteExpense } = useStore();
  const [person, setPerson] = useState<ProfitPerson>("judah");
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("postage");
  const [note, setNote] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    for (const s of sales) set.add(parseInt(s.sold_on.slice(0, 4)));
    for (const p of purchases) set.add(parseInt(p.purchased_on.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [sales, purchases, thisYear]);

  const t = useMemo(() => personTaxSummary(person, year, sales, lots, shows, expenses, purchases), [person, year, sales, lots, shows, expenses, purchases]);
  const scopedSales = useMemo(() => sales.filter((s) => { const k = kindOfLot(lots, s.lot_id); return person === "judah" ? k !== "giovanni" : person === "giovanni" ? k === "giovanni" : isMomKind(k); }), [sales, lots, person]);
  const yearExpenses = useMemo(() => expenses.filter((e) => e.spent_on.startsWith(String(year))), [expenses, year]);
  const inventoryAtCost = useMemo(() => Math.round(lots.reduce((s, l) => s + l.qty_on_hand * Number(l.cost_basis_unit), 0) * 100) / 100, [lots]);
  const inventoryUnits = lots.reduce((s, l) => s + l.qty_on_hand, 0);

  function downloadCsv() {
    const title = person === "judah" ? "Judah TCG Books — Schedule C summary (Judah only)" : person === "giovanni" ? "Giovanni's numbers — memo only, NOT part of Judah's Schedule C" : "Mom's numbers — memo only";
    const rows: string[][] = [
      [title, String(year)],
      ["Line 1 — Gross receipts or sales", t.grossReceipts.toFixed(2)],
      ["Line 4 — Cost of goods sold", t.cogs.toFixed(2)],
      ["Line 7 — Gross profit", t.grossProfit.toFixed(2)],
      ["Line 10 — Commissions and fees (TCGplayer)", t.fees.toFixed(2)],
      ...(person === "judah" && t.momShareTotal !== 0 ? [["Mom's profit share — her cut of her items' profit", t.momShareTotal.toFixed(2)]] : []),
      ...(person === "mom" ? [["Judah's cut of the profit (he sold the items)", t.judahCutTotal.toFixed(2)]] : []),
      ["Other — Postage & shipping paid on sales", t.shippingPaid.toFixed(2)],
      ["Other — Show table fees", t.tableFees.toFixed(2)],
      ...Object.entries(t.expensesByCategory).map(([c, v]) => [`Expense — ${CATEGORY_LABELS[c as ExpenseCategory]?.label ?? c}`, v.toFixed(2)]),
      ["Line 28 — Total expenses", t.totalExpenses.toFixed(2)],
      ["Line 31 — Net profit", t.netProfit.toFixed(2)],
      ["Info — Purchases during the year (Line 36)", t.purchasesInYear.toFixed(2)],
      ["Info — Inventory on hand at cost (Line 41)", inventoryAtCost.toFixed(2)],
      [],
      ["SALES DETAIL", "date", "product", "qty", "item total", "shipping charged", "fees", "shipping paid", "cost of items", "profit"],
      ...scopedSales.filter((s) => s.sold_on.startsWith(String(year))).map((s) => [s.sold_on, s.product_name, String(s.qty), Number(s.item_price).toFixed(2), Number(s.shipping_charged).toFixed(2), Number(s.fees).toFixed(2), Number(s.shipping_paid).toFixed(2), Number(s.cost_basis_total).toFixed(2), Number(s.profit).toFixed(2)]),
      [],
      ["EXPENSE DETAIL", "date", "category", "amount", "note"],
      ...yearExpenses.map((e) => [e.spent_on, CATEGORY_LABELS[e.category]?.label ?? e.category, Number(e.amount).toFixed(2), e.note]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = person === "judah" ? `schedule-c-judah-${year}.csv` : person === "giovanni" ? `giovanni-numbers-${year}.csv` : `mom-numbers-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <ScreenTitle title="🧾 Books & Taxes" sub="Your whole year in Schedule C shape — open this page at tax time and copy the numbers onto the form." />
      <Field label="Whose numbers?">
        <select className={inputCls} value={person} onChange={(e) => setPerson(e.target.value as ProfitPerson)}>
          <option value="judah">Judah — the Schedule C</option>
          <option value="giovanni">Giovanni — his numbers (memo, not on Judah's Schedule C)</option>
          <option value="mom">Mom — her numbers (memo)</option>
        </select>
      </Field>
      <Field label="Tax year">
        <select className={inputCls} value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </Field>

      <div className="rounded-3xl bg-slate-800 border border-slate-700 p-5 mb-4">
        <Line label="Line 1 — Gross receipts or sales" value={t.grossReceipts} />
        <Line label="Line 4 — Cost of goods sold (items sold)" value={t.cogs} />
        <Line label="Line 7 — Gross profit" value={t.grossProfit} bold />
        <p className="text-slate-400 text-sm font-bold mt-4 mb-1">Expenses</p>
        <Line label="Line 10 — Commissions & fees (TCGplayer)" value={t.fees} />
        {person === "judah" && t.momShareTotal !== 0 && <Line label="Mom's profit share (her cut of her items' profit)" value={t.momShareTotal} />}
        {person === "mom" && <Line label="Judah's cut of the profit (he sold them)" value={t.judahCutTotal} />}
        <Line label="Postage & shipping paid on sales" value={t.shippingPaid} />
        <Line label="Show table fees" value={t.tableFees} />
        {Object.entries(t.expensesByCategory).map(([c, v]) => (
          <Line key={c} label={CATEGORY_LABELS[c as ExpenseCategory]?.label ?? c} value={v} />
        ))}
        <Line label="Line 28 — Total expenses" value={t.totalExpenses} bold />
        <div className="flex items-baseline justify-between pt-3">
          <span className="text-white font-black">{person === "judah" ? "Line 31 — Net profit" : "Net profit (memo)"}</span>
          <span className="text-3xl font-black text-yellow-300">{money(t.netProfit)}</span>
        </div>
        <p className="text-slate-500 text-sm mt-3">
          {person === "judah" && <>Cross-check: sale profits {money(t.salesProfit)} − Mom's profit share {money(t.momShareTotal)} − table fees {money(t.tableFees)} − other expenses {money(t.manualExpenses)} = {money(t.netProfit)} ✓. Giovanni's sales are not in any of these numbers.</>}
          {person === "giovanni" && <>Giovanni's own items only. None of this is on Judah's Schedule C — it's the memo for Giovanni (and for the 1099 conversation).</>}
          {person === "mom" && <>Cross-check: her items' profit {money(t.salesProfit)} − Judah's cut {money(t.judahCutTotal)} = her profit {money(t.netProfit)} ✓. Her cost comes back through the Who Owes Who ledger, not here.</>}
          {" "}Also for the form: product bought in {year} was {money(t.purchasesInYear)} (Line 36), and inventory on hand right now is {inventoryUnits} items worth {money(inventoryAtCost)} at cost (Line 41).
        </p>
      </div>

      <button onClick={downloadCsv} className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-bold mb-6">⬇️ Download this year as a file (CSV)</button>

      {person === "judah" && (<>
      <h3 className="text-white font-black text-lg mb-1">Log an expense</h3>
      <p className="text-slate-400 text-sm mb-3">Sleeves, mailers, postage, ads — anything the business spent money on that isn't product. It lands on this page for taxes.</p>
      <Field label="How much?">
        <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
      </Field>
      <Field label="What kind?">
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.line}</option>)}
        </select>
      </Field>
      <Field label="When?">
        <input className={inputCls} type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
      </Field>
      <Field label="Note (optional)">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 200 mailers from Amazon" />
      </Field>
      <BigButton disabled={!(parseFloat(amount) > 0) || !spentOn} onClick={async () => { await addExpense(parseFloat(amount), spentOn, category, note.trim()); setAmount(""); setNote(""); }}>
        Add expense
      </BigButton>

      </>)}
      {person === "judah" && yearExpenses.length > 0 && (
        <div className="mt-6">
          <h3 className="text-white font-black mb-2">Expenses in {year}</h3>
          <div className="grid gap-2">
            {yearExpenses.map((e) => (
              <div key={e.id} className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-white font-semibold">{money(Number(e.amount))} — {CATEGORY_LABELS[e.category]?.label ?? e.category}</p>
                  <p className="text-slate-400 text-sm">{e.spent_on}{e.note ? ` · ${e.note}` : ""}</p>
                </div>
                {confirmId === e.id ? (
                  <button onClick={() => { void deleteExpense(e.id); setConfirmId(null); }} className="rounded-xl bg-rose-600 text-white px-3 py-2 font-bold text-sm">Tap again to delete</button>
                ) : (
                  <button onClick={() => setConfirmId(e.id)} className="rounded-xl bg-slate-700 text-slate-200 px-3 py-2 font-bold text-sm">Delete</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
