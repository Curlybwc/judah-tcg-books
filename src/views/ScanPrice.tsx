import { useRef, useState } from "react";
import { priceProvider, type PriceResult } from "../lib/priceProvider";
import { money } from "../lib/math";
import { BigButton, Chip, Field, inputCls, ScreenTitle, StepRail } from "../components/ui";
import type { View } from "../App";

const STEPS = ["What is it?", "Looking it up", "Price"];

export default function ScanPrice({ go }: { go: (v: View) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [result, setResult] = useState<PriceResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function lookup() {
    setStep(1);
    const r = await priceProvider.lookup(name.trim());
    setResult(r);
    setStep(2);
  }

  return (
    <div>
      <ScreenTitle title="📷 Scan for Price" sub="Point, type, or say the name — get the going price." />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <Field label="Product name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prismatic Evolutions Booster Bundle" autoFocus />
          </Field>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={() => { if (!name) setName("Photo product"); }} />
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl bg-slate-700 text-white py-3.5 font-semibold mb-4">📷 Take a photo instead</button>
          <BigButton disabled={name.trim().length < 2} onClick={lookup}>What's it worth? →</BigButton>
          <p className="text-slate-500 text-sm mt-3">Tip: on your phone keyboard, tap the microphone to say the name instead of typing.</p>
        </div>
      )}

      {step === 1 && (
        <div className="text-center py-10">
          <p className="text-5xl mb-3 animate-pulse">🔎</p>
          <p className="text-white font-bold text-lg">Looking up “{name}”…</p>
          <p className="text-slate-400 text-sm mt-1">Checking the price source. This step is automatic.</p>
        </div>
      )}

      {step === 2 && result && (
        <div>
          <div className="rounded-3xl bg-slate-800 border border-slate-700 p-6 text-center mb-4">
            <p className="text-slate-300 font-semibold">{name}</p>
            <p className="text-6xl font-black text-white mt-2">{money(result.price)}</p>
            <p className="mt-3">{result.isSample ? <Chip tone="amber">SAMPLE PRICE — demo only, not a real market price</Chip> : <Chip tone="green">{result.provider}</Chip>}</p>
            {result.isSample && <p className="text-slate-400 text-sm mt-2">Real prices turn on when the TCG price key is added (a quick daytime setup with Mom).</p>}
          </div>
          <div className="grid gap-3">
            <BigButton onClick={() => go("buy")}>🛒 I bought this</BigButton>
            <BigButton color="slate" onClick={() => { setStep(0); setResult(null); setName(""); }}>Scan another</BigButton>
            <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
