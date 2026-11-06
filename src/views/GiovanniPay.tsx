import { useState } from "react";
import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { BigButton, Field, inputCls, MoneyInput, ScreenTitle, StepRail } from "../components/ui";
import type { View } from "../App";

const STEPS = ["How much?", "Check it", "Done"];

export default function GiovanniPay({ go }: { go: (v: View) => void }) {
  const { giovanniOwed, addGiovanniPayment } = useStore();
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amt = parseFloat(amount) || 0;
  const today = new Date().toISOString().slice(0, 10);

  async function save() {
    setSaving(true);
    await addGiovanniPayment(amt, today, note);
    setSaving(false);
    setStep(2);
  }

  return (
    <div>
      <ScreenTitle title="🤝 Giovanni Paid Me" sub={`Right now he owes you ${money(giovanniOwed)}.`} />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <Field label="How much did he Zelle you?">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAmount(giovanniOwed > 0 ? giovanniOwed.toFixed(2) : "")} className="rounded-full bg-slate-700 text-slate-100 px-4 py-2 font-bold text-sm">All of it ({money(giovanniOwed)})</button>
          </div>
          <Field label="Note (optional)">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Zelle from Giovanni" />
          </Field>
          <BigButton disabled={amt <= 0} onClick={() => setStep(1)}>Next →</BigButton>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 mb-4 text-center">
            <p className="text-slate-300">Giovanni paid you</p>
            <p className="text-4xl font-black text-white my-1">{money(amt)}</p>
            <p className="text-slate-300">After this, he will owe you</p>
            <p className="text-4xl font-black text-yellow-300 my-1">{money(Math.round((giovanniOwed - amt) * 100) / 100)}</p>
          </div>
          <BigButton color="green" disabled={saving} onClick={save}>{saving ? "Saving…" : "✓ Yes, he paid me this"}</BigButton>
          <button onClick={() => setStep(0)} className="w-full py-3 mt-2 text-slate-400 font-semibold">← Back</button>
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-6">
          <p className="text-6xl mb-3">✅</p>
          <p className="text-white text-xl font-bold">Logged!</p>
          <p className="text-slate-300 mt-2">Giovanni now owes you {money(Math.round((giovanniOwed) * 100) / 100)}.</p>
          <div className="grid gap-3 mt-6">
            <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
