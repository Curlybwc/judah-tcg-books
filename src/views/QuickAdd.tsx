import { useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { allocateShipping, parseQuickBuyLine, parseQuickBuyText, type QuickBuyRow } from "../lib/quickbuy";
import { BigButton, Field, inputCls, ScreenTitle } from "../components/ui";
import type { View } from "../App";
import type { OwnerKind } from "../lib/types";

// Quick Add (Jen, 2026-11-07 — mined from Card Splitter's Quick Entry): bought
// several things at once? Paste a list or say them out loud, check the rows,
// save them all as buys in one go — one owner, one payment, one tax rate and
// one shipping charge (split across the items by value) for the whole batch.
const TAX_RATE_KEY = "jtb-tax-rate";

interface SR {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { length: number; [i: number]: { isFinal: boolean; length: number; [j: number]: { transcript: string } } }; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
}

export default function QuickAdd({ go }: { go: (v: View) => void }) {
  const { addPurchase } = useStore();
  const [mode, setMode] = useState<"paste" | "voice">("paste");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<QuickBuyRow[]>([]);
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("mine");
  const [splitPct, setSplitPct] = useState(50);
  const [paidVia, setPaidVia] = useState<"USAA" | "Cash" | "Other">("Cash");
  const [taxRate, setTaxRate] = useState(() => { try { return localStorage.getItem(TAX_RATE_KEY) ?? ""; } catch { return ""; } });
  const [shippingTotal, setShippingTotal] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const recRef = useRef<SR | null>(null);

  const rate = parseFloat(taxRate) || 0;
  const ship = parseFloat(shippingTotal) || 0;
  const valid = rows.filter((r) => !r.error && r.qty > 0 && r.unitPrice > 0 && r.name.trim().length >= 2);
  const subtotal = valid.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const taxTotal = Math.round(subtotal * (rate / 100) * 100) / 100;
  const grand = Math.round((subtotal + taxTotal + ship) * 100) / 100;
  const alloc = useMemo(() => allocateShipping(valid, ship), [valid, ship]);
  const voiceSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function addRows(newRows: QuickBuyRow[]) {
    setRows((prev) => [...prev, ...newRows]);
  }

  function startVoice() {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const line = res[0].transcript.trim();
          if (line) addRows([parseQuickBuyLine(line)]);
        } else interim += res[0].transcript;
      }
      setHeard(interim);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function stopVoice() {
    recRef.current?.stop();
    setListening(false);
  }

  async function saveAll() {
    setSaving(true);
    let n = 0;
    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      await addPurchase({
        name: r.name.trim(), qty: r.qty, unitPrice: r.unitPrice, taxRate: rate,
        shippingIn: alloc[i] ?? 0, ownerKind, judahPct: splitPct, paidVia,
      });
      n++;
    }
    setSaving(false);
    setSavedCount(n);
    setRows([]);
    setText("");
  }

  if (savedCount !== null) {
    return (
      <div className="text-center py-6">
        <p className="text-6xl mb-3">✅</p>
        <p className="text-white text-xl font-bold">Saved {savedCount} buy{savedCount === 1 ? "" : "s"}!</p>
        <p className="text-slate-300 mt-2">They're all in your for-sale stock now, each with its own cost per item.</p>
        <div className="grid gap-3 mt-6">
          <BigButton onClick={() => setSavedCount(null)}>Add more</BigButton>
          <BigButton color="slate" onClick={() => go("inventory")}>See inventory</BigButton>
          <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="⚡ Quick Add" sub="Bought several things at once? Add them all here — paste a list or say them out loud." />
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("paste")} className={`flex-1 rounded-2xl py-3 font-bold ${mode === "paste" ? "bg-yellow-400 text-slate-900" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>📋 Paste a list</button>
        <button onClick={() => setMode("voice")} className={`flex-1 rounded-2xl py-3 font-bold ${mode === "voice" ? "bg-yellow-400 text-slate-900" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>🎤 Say them</button>
      </div>

      {mode === "paste" && (
        <div>
          <Field label="One product per line — name, how many, price each">
            <textarea className={`${inputCls} min-h-32`} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={"Delta Reign ETB | 4 | 61.00\n151 Elite Trainer Box x2 @ 80\nBooster Bundle, 6, 32"} />
          </Field>
          <BigButton disabled={!text.trim()} onClick={() => { addRows(parseQuickBuyText(text)); setText(""); }}>Read the list ↓</BigButton>
        </div>
      )}

      {mode === "voice" && (
        <div className="mb-2">
          {voiceSupported ? (
            <>
              <p className="text-slate-300 text-sm mb-3">Tap the mic and say each thing like this: <span className="text-white font-semibold">"Two Delta Reign ETB at sixty-one each."</span> Pause between items. Each one you say lands in the list below — check it before saving.</p>
              <button onClick={() => (listening ? stopVoice() : startVoice())}
                className={`w-full rounded-2xl py-4 font-black text-lg ${listening ? "bg-rose-500 text-white" : "bg-yellow-400 text-slate-900"}`}>
                {listening ? "🔴 Listening… tap to stop" : "🎤 Start talking"}
              </button>
              {listening && heard && <p className="text-slate-400 text-sm mt-2">Hearing: “{heard}”</p>}
            </>
          ) : (
            <p className="text-slate-300">Talking isn't supported in this browser. The paste tab works everywhere — type the list there instead.</p>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-5">
          <h3 className="text-white font-black mb-2">Check the list ({valid.length} ready{rows.length > valid.length ? `, ${rows.length - valid.length} need${rows.length - valid.length === 1 ? "s" : ""} fixing` : ""})</h3>
          <div className="grid gap-2 mb-4">
            {rows.map((r, i) => (
              <div key={i} className={`rounded-2xl border px-3 py-2.5 ${r.error ? "bg-rose-950/40 border-rose-800" : "bg-slate-800 border-slate-700"}`}>
                <div className="flex gap-2 items-center">
                  <input className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white" value={r.name}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value, error: undefined } : x)))} placeholder="Product name" />
                  <input className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-center" inputMode="numeric" value={r.qty || ""}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, qty: parseInt(e.target.value) || 0, error: undefined } : x)))} placeholder="Qty" />
                  <input className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-center" inputMode="decimal" value={r.unitPrice || ""}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, unitPrice: parseFloat(e.target.value) || 0, error: undefined } : x)))} placeholder="$ ea" />
                  <button onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 font-black px-1.5" aria-label="Remove row">✕</button>
                </div>
                {r.error && <p className="text-rose-300 text-sm mt-1.5">Couldn't read “{r.raw}” — fix the name, qty, and price, or remove the row.</p>}
              </div>
            ))}
          </div>

          <p className="text-slate-300 font-semibold mb-2">Whose are they, and how did you pay? (same for the whole batch)</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {([["mine", "🟡 Mine"], ["giovanni", "🔵 Giovanni's"], ["split", "🟣 Split"], ["mom_payback", "🟦 Mom paid"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setOwnerKind(k)} className={`rounded-xl px-3 py-2.5 font-bold text-sm ${ownerKind === k ? "bg-yellow-400 text-slate-900" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>{label}</button>
            ))}
            {(["USAA", "Cash", "Other"] as const).map((v) => (
              <button key={v} onClick={() => setPaidVia(v)} className={`rounded-xl px-3 py-2.5 font-bold text-sm ${paidVia === v ? "bg-sky-400 text-slate-900" : "bg-slate-800 text-slate-200 border border-slate-700"}`}>{v}</button>
            ))}
          </div>
          {ownerKind === "split" && (
            <Field label={`My share: ${splitPct}%`}>
              <input type="range" min={5} max={95} step={5} value={splitPct} onChange={(e) => setSplitPct(parseInt(e.target.value))} className="w-full accent-yellow-400" />
            </Field>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Field label="Tax rate % (receipt)">
                <input className={inputCls} inputMode="decimal" value={taxRate} onChange={(e) => { setTaxRate(e.target.value); try { localStorage.setItem(TAX_RATE_KEY, e.target.value); } catch { /* ignore */ } }} placeholder="0" />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Shipping for it all">
                <input className={inputCls} inputMode="decimal" value={shippingTotal} onChange={(e) => setShippingTotal(e.target.value)} placeholder="0.00" />
              </Field>
            </div>
          </div>
          <p className="text-slate-300 mb-4">Total: <span className="text-white font-black">{money(grand)}</span> <span className="text-slate-400 text-sm">({money(subtotal)} of product + {money(taxTotal)} tax + {money(ship)} shipping, split across the items by value)</span></p>
          <BigButton color="green" disabled={saving || valid.length === 0} onClick={() => void saveAll()}>{saving ? "Saving…" : `✓ Save all ${valid.length} buy${valid.length === 1 ? "" : "s"}`}</BigButton>
        </div>
      )}
    </div>
  );
}
