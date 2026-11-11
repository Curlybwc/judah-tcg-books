import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { loanMath, money } from "../lib/math";
import { BigButton, Chip, Field, MathRow, MoneyInput, ScreenTitle, inputCls } from "../components/ui";
import type { View } from "../App";
import type { InterestType, Loan, LoanInput } from "../lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysUntil = (d: string) => Math.round((Date.parse(d + "T12:00:00") - Date.parse(today() + "T12:00:00")) / 86400000);

function interestLine(loan: Loan): string | null {
  if (loan.interest_type === "flat" && loan.interest_value > 0) return `+ ${money(loan.interest_value)} interest`;
  if (loan.interest_type === "percent" && loan.interest_value > 0) return `+ ${loan.interest_value}% interest`;
  return null;
}

function DueChip({ dueOn }: { dueOn: string | null }) {
  if (!dueOn) return <Chip>No due date</Chip>;
  const d = daysUntil(dueOn);
  if (d < 0) return <Chip tone="red">Overdue by {-d} day{d === -1 ? "" : "s"} — due {fmtDate(dueOn)}</Chip>;
  if (d === 0) return <Chip tone="amber">Due today</Chip>;
  if (d <= 14) return <Chip tone="amber">Due in {d} day{d === 1 ? "" : "s"} — {fmtDate(dueOn)}</Chip>;
  return <Chip>Due {fmtDate(dueOn)}</Chip>;
}

function LoanForm({ initial, onSave, onCancel }: {
  initial?: Loan;
  onSave: (i: LoanInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [lender, setLender] = useState(initial?.lender ?? "");
  const [principal, setPrincipal] = useState(initial ? String(initial.principal) : "");
  const [borrowedOn, setBorrowedOn] = useState(initial?.borrowed_on ?? today());
  const [hasDue, setHasDue] = useState(initial ? initial.due_on != null : true);
  const [dueOn, setDueOn] = useState(initial?.due_on ?? today());
  const [itype, setItype] = useState<InterestType>(initial?.interest_type ?? "none");
  const [ivalue, setIvalue] = useState(initial && initial.interest_type !== "none" ? String(initial.interest_value) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const preview = loanMath({ principal: parseFloat(principal) || 0, interest_type: itype, interest_value: parseFloat(ivalue) || 0 }, 0);
  const valid = lender.trim().length > 0 && (parseFloat(principal) || 0) > 0;

  async function save() {
    setSaving(true);
    await onSave({
      lender: lender.trim(),
      principal: parseFloat(principal) || 0,
      interest_type: itype,
      interest_value: itype === "none" ? 0 : parseFloat(ivalue) || 0,
      borrowed_on: borrowedOn,
      due_on: hasDue ? dueOn : null,
      note: note.trim(),
    });
  }

  return (
    <div className="grid gap-4">
      <Field label="Who did you borrow from?">
        <div className="flex gap-2 mb-2">
          {["Mom", "Dad", "Giovanni"].map((n) => (
            <button key={n} onClick={() => setLender(n)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${lender === n ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{n}</button>
          ))}
        </div>
        <input className={inputCls} placeholder="Or type a name" value={lender} onChange={(e) => setLender(e.target.value)} />
      </Field>
      <Field label="How much did you borrow?">
        <MoneyInput value={principal} onChange={setPrincipal} placeholder="0.00" />
      </Field>
      <Field label="Date you borrowed it">
        <input type="date" className={inputCls} value={borrowedOn} onChange={(e) => setBorrowedOn(e.target.value)} />
      </Field>
      <Field label="When is it due back?">
        <div className="flex gap-2 mb-2">
          <button onClick={() => setHasDue(true)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${hasDue ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>Pick a date</button>
          <button onClick={() => setHasDue(false)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${!hasDue ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>No set date</button>
        </div>
        {hasDue && <input type="date" className={inputCls} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />}
      </Field>
      <Field label="Interest — do you owe extra for borrowing it?">
        <div className="flex gap-2 mb-2">
          {([["none", "No interest"], ["flat", "Flat $ amount"], ["percent", "% of the loan"]] as [InterestType, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setItype(t)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${itype === t ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{label}</button>
          ))}
        </div>
        {itype === "flat" && <MoneyInput value={ivalue} onChange={setIvalue} placeholder="Extra dollars owed, e.g. 20" />}
        {itype === "percent" && <input className={inputCls} inputMode="decimal" placeholder="Percent, e.g. 10" value={ivalue} onChange={(e) => setIvalue(e.target.value.replace(/[^0-9.]/g, ""))} />}
      </Field>
      <Field label="Note (optional)">
        <input className={inputCls} placeholder="What was it for?" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {preview.totalToRepay > 0 && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
          <MathRow label="You borrowed" value={money(preview.totalToRepay - preview.interestAmount)} />
          {preview.interestAmount > 0 && <MathRow label="Interest" value={`+${money(preview.interestAmount)}`} />}
          <MathRow label="You pay back in total" value={money(preview.totalToRepay)} bold />
        </div>
      )}
      <BigButton color="green" disabled={!valid || saving} onClick={save}>{saving ? "Saving…" : initial ? "✓ Save changes" : "✓ Save this loan"}</BigButton>
      <BigButton color="slate" onClick={onCancel}>Cancel</BigButton>
    </div>
  );
}

export default function Loans({ go }: { go: (v: View) => void }) {
  const { loans, loanPayments, addLoan, updateLoan, deleteLoan, addLoanPayment, deleteLoanPayment } = useStore();
  const [mode, setMode] = useState<"list" | "new" | "detail" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [payNote, setPayNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const paidByLoan = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of loanPayments) m.set(p.loan_id, Math.round(((m.get(p.loan_id) ?? 0) + Number(p.amount)) * 100) / 100);
    return m;
  }, [loanPayments]);

  const rows = useMemo(() => loans.map((loan) => ({ loan, m: loanMath(loan, paidByLoan.get(loan.id) ?? 0) })), [loans, paidByLoan]);
  const open = rows.filter((r) => !r.m.paidOff);
  const done = rows.filter((r) => r.m.paidOff);
  const totalOwed = Math.round(open.reduce((s, r) => s + r.m.owed, 0) * 100) / 100;
  const active = rows.find((r) => r.loan.id === activeId) ?? null;
  const activePayments = active ? loanPayments.filter((p) => p.loan_id === active.loan.id) : [];

  if (mode === "new") {
    return (
      <div>
        <ScreenTitle title="💳 I Borrowed Money" sub="Write it down now so paying it back never gets fuzzy." />
        <LoanForm onCancel={() => setMode("list")} onSave={async (i) => { await addLoan(i); setMode("list"); }} />
      </div>
    );
  }

  if (mode === "edit" && active) {
    return (
      <div>
        <ScreenTitle title={`✏️ Edit loan — ${active.loan.lender}`} sub="Fix anything that was entered wrong." />
        <LoanForm initial={active.loan} onCancel={() => setMode("detail")} onSave={async (i) => { await updateLoan(active.loan.id, i); setMode("detail"); }} />
      </div>
    );
  }

  if (mode === "detail" && active) {
    const { loan, m } = active;
    return (
      <div>
        <ScreenTitle title={`💳 You owe ${loan.lender}`} sub={`Borrowed ${fmtDate(loan.borrowed_on)}${loan.note ? ` — ${loan.note}` : ""}`} />
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
          <MathRow label="Borrowed" value={money(loan.principal)} />
          {m.interestAmount > 0 && <MathRow label={`Interest (${interestLine(loan)})`} value={`+${money(m.interestAmount)}`} />}
          <MathRow label="Total to pay back" value={money(m.totalToRepay)} />
          <MathRow label="Paid so far" value={`−${money(m.paid)}`} negative />
          <MathRow label="Still owe" value={money(m.owed)} bold />
          <div className="mt-2">{m.paidOff ? <Chip tone="green">✓ Paid off</Chip> : <DueChip dueOn={loan.due_on} />}</div>
        </div>

        {!m.paidOff && (
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4 grid gap-3">
            <p className="text-white font-bold">💵 I paid some back</p>
            <MoneyInput value={payAmount} onChange={setPayAmount} placeholder="Amount you paid" />
            <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            <input className={inputCls} placeholder="Note (optional) — Zelle, cash…" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            <BigButton color="green" disabled={(parseFloat(payAmount) || 0) <= 0} onClick={async () => {
              await addLoanPayment(loan.id, parseFloat(payAmount) || 0, payDate, payNote.trim());
              setPayAmount(""); setPayNote("");
            }}>✓ Record this payment</BigButton>
          </div>
        )}

        {activePayments.length > 0 && (
          <div className="grid gap-2 mb-4">
            <p className="text-slate-300 font-bold">Payments you made</p>
            {activePayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-4 py-3">
                <span className="text-slate-200">{fmtDate(p.paid_on)} — <span className="font-bold text-white">{money(Number(p.amount))}</span>{p.note ? <span className="text-slate-400"> · {p.note}</span> : null}</span>
                <button onClick={() => void deleteLoanPayment(p.id)} className="text-rose-300 font-bold px-2" aria-label="Delete this payment">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          <BigButton color="slate" onClick={() => { setConfirmDelete(false); setMode("edit"); }}>✏️ Edit this loan</BigButton>
          <BigButton color="slate" onClick={() => setMode("list")}>← Back to all loans</BigButton>
          {confirmDelete
            ? <BigButton color="red" onClick={async () => { await deleteLoan(loan.id); setMode("list"); }}>Tap again to delete this loan for good</BigButton>
            : <button onClick={() => setConfirmDelete(true)} className="text-rose-300/70 text-sm py-1">Delete this loan</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="💳 Money I Owe" sub="Money you borrowed from people — who, how much, and when it's due." />
      <div className="rounded-3xl bg-gradient-to-br from-rose-400 to-red-500 p-5 mb-5 shadow">
        <p className="text-red-950 font-semibold text-sm">You still owe, all together</p>
        <p className="text-5xl font-black text-red-950 mt-1">{money(totalOwed)}</p>
        <p className="text-red-900 text-sm mt-1">{open.length === 0 ? "Nothing outstanding. Nice." : `${open.length} loan${open.length === 1 ? "" : "s"} open.`}</p>
      </div>
      <div className="mb-4">
        <BigButton onClick={() => setMode("new")}>＋ I borrowed money</BigButton>
      </div>
      <div className="grid gap-3">
        {open.map(({ loan, m }) => (
          <button key={loan.id} onClick={() => { setActiveId(loan.id); setConfirmDelete(false); setMode("detail"); }} className="text-left rounded-2xl bg-slate-800 border border-slate-700 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-white font-bold text-lg">{loan.lender}</p>
              <p className="text-rose-300 font-black text-xl">{money(m.owed)} <span className="text-sm font-semibold">left</span></p>
            </div>
            <p className="text-slate-400 text-sm">Borrowed {money(loan.principal)} on {fmtDate(loan.borrowed_on)}{interestLine(loan) ? ` · ${interestLine(loan)}` : ""} · paid {money(m.paid)} of {money(m.totalToRepay)}</p>
            <div className="w-full h-2 rounded-full bg-slate-700 mt-2 mb-2 overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${m.totalToRepay > 0 ? Math.min(100, (m.paid / m.totalToRepay) * 100) : 0}%` }} />
            </div>
            <DueChip dueOn={loan.due_on} />
          </button>
        ))}
        {open.length === 0 && loans.length > 0 && <p className="text-slate-400">Every loan is paid off. 🎉</p>}
        {loans.length === 0 && <p className="text-slate-400">No loans written down yet. When you borrow from someone, put it here so it's clear what you owe, to whom, and by when.</p>}
      </div>
      {done.length > 0 && (
        <div className="mt-6">
          <p className="text-slate-400 font-bold mb-2">✓ Paid off</p>
          <div className="grid gap-2">
            {done.map(({ loan, m }) => (
              <button key={loan.id} onClick={() => { setActiveId(loan.id); setMode("detail"); }} className="text-left rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-slate-300">
                {loan.lender} — {money(m.totalToRepay)} paid in full ✓
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6">
        <BigButton color="slate" onClick={() => go("home")}>← Back to start</BigButton>
      </div>
    </div>
  );
}
