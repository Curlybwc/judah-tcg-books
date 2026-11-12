import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { loanMath, money, profitByPerson } from "../lib/math";
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

export default function Balances({ go }: { go: (v: View) => void }) {
  const { loans, loanPayments, addLoan, updateLoan, deleteLoan, addLoanPayment, deleteLoanPayment,
    giovanniOwed, giovanniShare, giovanniFronted, giovanniOwnNet, payments, addGiovanniPayment, deleteGiovanniPayment,
    momOwed, momShipOwed, momPayments, addMomPayment, deleteMomPayment, purchases, sales, lots,
    jakeOwed, jakeBreakdown, jakePayments, addJakePayment } = useStore();
  const profitSplit = useMemo(() => profitByPerson(sales, lots), [sales, lots]);
  const [mode, setMode] = useState<"list" | "new" | "detail" | "edit">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today());
  const [payNote, setPayNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gioAmount, setGioAmount] = useState("");
  const [gioNote, setGioNote] = useState("");
  const [confirmGioId, setConfirmGioId] = useState<string | null>(null);
  const [momAmount, setMomAmount] = useState("");
  const [jakeAmount, setJakeAmount] = useState("");
  const [jakeNote, setJakeNote] = useState("");
  const [confirmMomId, setConfirmMomId] = useState<string | null>(null);

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
  const paidBack = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const momRepaid = momPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const spent = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of purchases) m.set(p.owner_kind, Math.round(((m.get(p.owner_kind) ?? 0) + Number(p.total_cost)) * 100) / 100);
    return m;
  }, [purchases]);

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
      <ScreenTitle title="🤝 Who Owes Who" sub="Every balance with everybody — Giovanni, Mom, Jake, and loans — in one place." />
      <div className="rounded-3xl bg-slate-800 border border-slate-700 p-4 mb-4">
        <p className="text-slate-400 font-semibold text-sm mb-2">Profit so far — each person's own</p>
        <div className="flex gap-2 text-center">
          <div className="flex-1"><p className="text-slate-400 text-xs font-bold">JUDAH</p><p className="text-emerald-400 font-black text-lg">{money(profitSplit.judah)}</p></div>
          <div className="flex-1"><p className="text-slate-400 text-xs font-bold">GIO</p><p className="text-emerald-400 font-black text-lg">{money(profitSplit.giovanni)}</p></div>
          <div className="flex-1"><p className="text-slate-400 text-xs font-bold">MOM</p><p className="text-emerald-400 font-black text-lg">{money(profitSplit.mom)}</p></div>
          <div className="flex-1"><p className="text-slate-400 text-xs font-bold">JAKE</p><p className="text-emerald-400 font-black text-lg">{money(profitSplit.jake)}</p></div>
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-yellow-400 to-amber-500 p-5 mb-3">
        <p className="text-slate-800 font-semibold text-sm">Giovanni owes you</p>
        <p className="text-4xl font-black text-slate-900">{money(giovanniOwed)}</p>
        <div className="mt-2 text-slate-800 text-sm">
          <p>Your share of TCGplayer sales: {money(giovanniShare)}</p>
          {giovanniFronted > 0 && <p>Shipping fronted on his product — by you or Mom: {money(giovanniFronted)}</p>}
          <p>He has already paid you back {money(paidBack)} by Zelle.</p>
          {giovanniOwnNet > 0 && <p className="mt-1">His own product sold for {money(giovanniOwnNet)} net — that money is his; it went straight to him.</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1"><MoneyInput value={gioAmount} onChange={setGioAmount} placeholder="0.00" /></div>
          <button
            disabled={!(parseFloat(gioAmount) > 0)}
            onClick={() => { void addGiovanniPayment(parseFloat(gioAmount), today(), gioNote.trim()); setGioAmount(""); setGioNote(""); }}
            className="rounded-2xl bg-slate-900 text-white px-4 font-bold disabled:opacity-40">
            He paid me
          </button>
        </div>
        <input className="w-full mt-2 rounded-xl bg-white/70 border border-amber-600/40 px-3 py-2 text-slate-800 placeholder:text-slate-500" placeholder="Note (optional) — Zelle…" value={gioNote} onChange={(e) => setGioNote(e.target.value)} />
        {payments.length > 0 && (
          <div className="grid gap-1.5 mt-3">
            {payments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex justify-between items-center rounded-xl bg-white/60 px-3 py-2">
                <span className="text-slate-800 text-sm">He paid you {money(Number(p.amount))} · {p.paid_on}{p.note ? ` · ${p.note}` : ""}</span>
                <button
                  onClick={() => { if (confirmGioId === p.id) { void deleteGiovanniPayment(p.id); setConfirmGioId(null); } else setConfirmGioId(p.id); }}
                  className={`text-xs font-bold rounded-full px-2.5 py-1 ${confirmGioId === p.id ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-100"}`}>
                  {confirmGioId === p.id ? "Tap again to delete" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-slate-800 border border-sky-500/50 p-5 mb-3">
        <p className="text-sky-300 font-semibold text-sm">You owe Mom</p>
        <p className="text-4xl font-black text-white">{money(momOwed)}</p>
        <p className="text-slate-400 text-sm">The full cost of everything she paid for, plus her 50% of the profit when those things sell (profit = what you got for it, after fees and shipping, minus its cost). You've paid her back {money(momRepaid)} so far.</p>
        {momShipOwed > 0 && <p className="text-slate-400 text-sm mt-1">Includes {money(momShipOwed)} of postage that came out of her bank account (the Pirate Ship labels).</p>}
        <div className="flex gap-2 mt-3">
          <div className="flex-1"><MoneyInput value={momAmount} onChange={setMomAmount} placeholder="0.00" /></div>
          <button
            disabled={!(parseFloat(momAmount) > 0)}
            onClick={() => { void addMomPayment(parseFloat(momAmount), today(), ""); setMomAmount(""); }}
            className="rounded-2xl bg-sky-500 text-white px-4 font-bold disabled:opacity-40">
            I paid Mom
          </button>
        </div>
        {momPayments.length > 0 && (
          <div className="grid gap-1.5 mt-3">
            {momPayments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex justify-between items-center rounded-xl bg-slate-900 border border-slate-700 px-3 py-2">
                <span className="text-slate-300 text-sm">Paid Mom {money(Number(p.amount))} · {p.paid_on}</span>
                <button
                  onClick={() => { if (confirmMomId === p.id) { void deleteMomPayment(p.id); setConfirmMomId(null); } else setConfirmMomId(p.id); }}
                  className={`text-xs font-bold rounded-full px-2.5 py-1 ${confirmMomId === p.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                  {confirmMomId === p.id ? "Tap again to delete" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

            <div className="rounded-3xl bg-slate-800 border border-emerald-800/60 p-5 mb-3">
        <p className="text-emerald-300 font-semibold text-sm">You owe Jake</p>
        <p className="text-4xl font-black text-white">{money(jakeOwed)}</p>
        <p className="text-slate-400 text-sm">His product sells on the shared account too. Giovanni pays you the gross minus fees; you pass Jake the gross minus fees and shipping. What Jake paid for his product is his own business.</p>
        <div className="text-slate-400 text-sm mt-2">
          <p>His sales after fees: {money(jakeBreakdown.gross)}</p>
          {jakeBreakdown.shipping > 0 && <p>Less shipping on his product: {money(jakeBreakdown.shipping)}</p>}
          <p>You've paid him {money(jakeBreakdown.paid)} so far.</p>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1"><MoneyInput value={jakeAmount} onChange={setJakeAmount} placeholder="0.00" /></div>
          <button
            disabled={!(parseFloat(jakeAmount) > 0)}
            onClick={() => { void addJakePayment(parseFloat(jakeAmount), today(), jakeNote.trim()); setJakeAmount(""); setJakeNote(""); }}
            className="rounded-2xl bg-emerald-500 text-slate-900 px-4 font-bold disabled:opacity-40">
            You paid Jake
          </button>
        </div>
        <input className="w-full mt-2 rounded-xl bg-slate-700 border border-slate-600 px-3 py-2 text-white placeholder:text-slate-400" placeholder="Note (optional)" value={jakeNote} onChange={(e) => setJakeNote(e.target.value)} />
        {jakePayments.length > 0 && (
          <div className="grid gap-1.5 mt-3">
            {jakePayments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex justify-between items-center rounded-xl bg-slate-700/60 px-3 py-2">
                <span className="text-slate-200 text-sm">You paid him {money(Number(p.amount))} · {p.paid_on}{p.note ? ` · ${p.note}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

<div className="rounded-3xl bg-slate-800 border border-slate-700 p-5 mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-white font-bold text-lg">💳 Money you borrowed</p>
          <p className="text-rose-300 font-black text-xl">{money(totalOwed)} <span className="text-sm font-semibold">owed</span></p>
        </div>
        <p className="text-slate-400 text-sm mb-3">{open.length === 0 ? "No loans outstanding." : `${open.length} loan${open.length === 1 ? "" : "s"} open — tap one to see it or record a payment.`}</p>
        <div className="mb-3">
          <BigButton onClick={() => setMode("new")}>＋ I borrowed money</BigButton>
        </div>
        <div className="grid gap-3">
          {open.map(({ loan, m }) => (
            <button key={loan.id} onClick={() => { setActiveId(loan.id); setConfirmDelete(false); setMode("detail"); }} className="text-left rounded-2xl bg-slate-900 border border-slate-700 p-4">
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
          {loans.length === 0 && <p className="text-slate-400 text-sm">No loans written down yet. When you borrow from someone, put it here so it's clear what you owe, to whom, and by when.</p>}
        </div>
        {done.length > 0 && (
          <div className="mt-4">
            <p className="text-slate-400 font-bold mb-2 text-sm">✓ Paid off</p>
            <div className="grid gap-2">
              {done.map(({ loan, m }) => (
                <button key={loan.id} onClick={() => { setActiveId(loan.id); setMode("detail"); }} className="text-left rounded-xl bg-slate-900/60 border border-slate-700 px-4 py-3 text-slate-300 text-sm">
                  {loan.lender} — {money(m.totalToRepay)} paid in full ✓
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-slate-800 border border-slate-700 p-5 mb-3">
        <p className="text-white font-bold text-lg mb-2">💰 Spent on product</p>
        <MathRow label="Giovanni spent" value={money(spent.get("giovanni") ?? 0)} />
        <MathRow label="Judah spent" value={money(spent.get("mine") ?? 0)} />
        <MathRow label="Mom spent" value={money((spent.get("mom_payback") ?? 0) + (spent.get("mom_split") ?? 0))} />
        {(spent.get("split") ?? 0) > 0 && <MathRow label="Split buys (shared)" value={money(spent.get("split") ?? 0)} />}
      </div>

      <BigButton color="slate" onClick={() => go("home")}>← Back to start</BigButton>
    </div>
  );
}
