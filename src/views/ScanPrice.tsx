import { useRef, useState } from "react";
import { identifyByPhoto, priceProvider, type PriceResult } from "../lib/priceProvider";
import { blobToDataUrl, compressImageFile } from "../lib/photos";
import { money } from "../lib/math";
import { BigButton, Chip, Field, inputCls, ScreenTitle, StepRail } from "../components/ui";
import type { View } from "../App";

const STEPS = ["What is it?", "Looking it up", "Price"];

export default function ScanPrice({ go }: { go: (v: View) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [result, setResult] = useState<PriceResult | null>(null);
  const [lookingLabel, setLookingLabel] = useState("Looking it up");
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scansLeft, setScansLeft] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function lookup() {
    setLookingLabel("Looking it up");
    setStep(1);
    const r = await priceProvider.lookup(name.trim());
    setResult(r);
    setStep(2);
  }

  async function priceByName(c: PriceResult) {
    setLookingLabel("Looking it up");
    setStep(1);
    const r = await priceProvider.lookup(c.matchedName ?? "");
    setResult(r.isSample ? { ...c, provider: r.provider } : r);
    setStep(2);
  }

  async function lookupPhoto(file: File) {
    setScanMsg(null);
    setLookingLabel("Reading the photo");
    setStep(1);
    const dataUrl = await blobToDataUrl(await compressImageFile(file));
    const out = await identifyByPhoto(dataUrl);
    if (out.scansRemaining != null) setScansLeft(out.scansRemaining);
    if (out.status === "matched" && out.candidates.length) {
      const c = out.candidates[0];
      setName(c.matchedName ?? "");
      if (c.price > 0) { setResult(c); setStep(2); } else await priceByName(c);
      return;
    }
    if (out.status === "ambiguous" && out.candidates.length) {
      setResult({ price: 0, provider: "TCG API — photo scan", isSample: false, choices: out.candidates });
      setStep(2);
      return;
    }
    if (out.status === "retake") setScanMsg(`📷 One more photo: ${out.message ?? "the picture wasn't clear enough to read."} One item, fill the frame, tilt away from glare.`);
    else if (out.status === "not_found") setScanMsg("🔍 The photo read fine, but nothing in their catalog matches it. Try typing the name instead.");
    else if (out.status === "unsupported") setScanMsg("🔍 That item isn't in their catalog (unsupported game or language). Try typing the name instead.");
    else setScanMsg(out.message ?? "The photo scan didn't work — try again.");
    setStep(0);
  }

  return (
    <div>
      <ScreenTitle title="📷 Price Scanner" sub="Point, type, or say the name — get the going price." />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <Field label="Product name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prismatic Evolutions Booster Bundle" autoFocus />
          </Field>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void lookupPhoto(f); }} />
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl bg-slate-700 text-white py-3.5 font-semibold mb-4">📷 Scan it with a photo instead</button>
          {scanMsg && <p className="rounded-xl bg-amber-900/40 border border-amber-700 text-amber-200 px-4 py-3 mb-4 text-sm">{scanMsg}</p>}
          <BigButton disabled={name.trim().length < 2} onClick={lookup}>What's it worth? →</BigButton>
          <p className="text-slate-500 text-sm mt-3">Tip: on your phone keyboard, tap the microphone to say the name instead of typing.</p>
        </div>
      )}

      {step === 1 && (
        <div className="text-center py-10">
          <p className="text-5xl mb-3 animate-pulse">🔎</p>
          <p className="text-white font-bold text-lg">{lookingLabel}{name ? <> “{name}”…</> : "…"}</p>
          <p className="text-slate-400 text-sm mt-1">This step is automatic — give it a few seconds.</p>
        </div>
      )}

      {step === 2 && result && result.choices && (
        <div>
          <p className="text-white font-black text-lg mb-1">Which one is it?</p>
          <p className="text-slate-400 text-sm mb-4">The price list has more than one “{name}”. Tap the right one — prices differ a lot between a single box and a case.</p>
          <div className="grid gap-3 mb-4">
            {result.choices.map((c, i) => (
              <button key={i} onClick={() => { if (c.price > 0) setResult(c); else void priceByName(c); }} className="flex items-center gap-3 rounded-2xl bg-slate-800 border border-slate-700 p-3 text-left">
                {c.imageUrl && <img src={c.imageUrl} alt={c.matchedName ?? ""} className="w-14 h-14 rounded-xl object-cover bg-slate-700" />}
                <span className="flex-1">
                  <span className="block text-white font-bold">{c.matchedName}</span>
                  <span className="block text-slate-400 text-sm">Tap to use this price</span>
                </span>
                <span className="text-xl font-black text-white">{c.price > 0 ? money(c.price) : "price on tap"}</span>
              </button>
            ))}
          </div>
          <BigButton color="slate" onClick={() => { setStep(0); setResult(null); setName(""); }}>Scan another</BigButton>
        </div>
      )}

      {step === 2 && result && !result.choices && (
        <div>
          {result.isSample ? (
            <div className="rounded-3xl bg-slate-800 border border-slate-700 p-6 text-center mb-4">
              <p className="text-white font-black text-xl">No real price found for that name.</p>
              <p className="text-slate-400 text-sm mt-2">If it's in your inventory, Maven can price it straight from TCGplayer — Inventory → 💲 Look up price.</p>
            </div>
          ) : (
          <div className="rounded-3xl bg-slate-800 border border-slate-700 p-6 text-center mb-4">
            <p className="text-slate-300 font-semibold">{name}</p>
            <p className="text-6xl font-black text-white mt-2">{money(result.price)}</p>
            {result.imageUrl && <img src={result.imageUrl} alt={result.matchedName ?? name} className="mx-auto mt-3 w-40 h-40 rounded-2xl object-cover bg-slate-700" />}
            {result.matchedName && <p className="text-slate-400 text-sm mt-2">Matched: {result.matchedName}</p>}
            <p className="mt-3"><Chip tone="green">{result.provider}</Chip></p>
          </div>
          )}
          {scansLeft != null && <p className="text-center text-slate-500 text-sm mb-3">📷 {scansLeft} photo scans left on the account</p>}
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
