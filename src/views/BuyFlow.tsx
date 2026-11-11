import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { money, purchaseMath, taxFromRate } from "../lib/math";
import { BigButton, Field, inputCls, MathRow, MoneyInput, ScreenTitle, StepRail } from "../components/ui";
import BarcodeScanner from "../components/BarcodeScanner";
import { catalogLookup, normalizeBarcode } from "../lib/catalog";
import type { View } from "../App";
import type { OwnerKind } from "../lib/types";

const TAX_RATE_KEY = "jtb-tax-rate";

const STEPS = ["What is it?", "How many & price", "Tax & shipping", "Whose is it?", "How did you pay?", "Check the math", "Done"];

export default function BuyFlow({ go }: { go: (v: View) => void }) {
  const { addPurchase, products, purchases, uploadProductPhoto } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [taxRate, setTaxRate] = useState(() => { try { return localStorage.getItem(TAX_RATE_KEY) ?? ""; } catch { return ""; } });
  const [shippingIn, setShippingIn] = useState("");
  const [ownerKind, setOwnerKind] = useState<OwnerKind>("mine");
  const [splitPct, setSplitPct] = useState(50);
  const [paidVia, setPaidVia] = useState<"USAA" | "Cash" | "Other">("USAA");
  const [saving, setSaving] = useState(false);
  const [savedBasis, setSavedBasis] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);

  // Own-library barcode lookup (Jen, 2026-11-07): a barcode the app has seen
  // before names the product itself — no online library involved.
  const recognized = useMemo(() => {
    const code = normalizeBarcode(barcode);
    if (code.length < 6) return undefined;
    return products.find((p) => p.barcode && normalizeBarcode(p.barcode) === code);
  }, [barcode, products]);
  // Starter-library match (seeded from TCGplayer's catalog): names a product
  // he has never bought before. His own products above always win.
  const catalogMatch = useMemo(() => (recognized ? undefined : catalogLookup(barcode)), [recognized, barcode]);
  const lastPaid = useMemo(() => {
    if (!recognized) return undefined;
    const ps = purchases.filter((p) => p.product_id === recognized.id);
    return ps.length ? ps.reduce((a, b) => (a.purchased_on >= b.purchased_on ? a : b)) : undefined;
  }, [recognized, purchases]);
  const filledFor = useRef("");
  useEffect(() => {
    const fillName = recognized?.name ?? catalogMatch?.name;
    if (fillName && filledFor.current !== normalizeBarcode(barcode)) {
      filledFor.current = normalizeBarcode(barcode);
      setName(fillName);
    }
  }, [recognized, catalogMatch, barcode]);

  const q = parseInt(qty) || 0;
  const up = parseFloat(unitPrice) || 0;
  const rate = parseFloat(taxRate) || 0;
  const tx = useMemo(() => taxFromRate(q * up, rate), [q, up, rate]);
  const sh = parseFloat(shippingIn) || 0;
  const math = useMemo(() => purchaseMath(q, up, tx, sh), [q, up, tx, sh]);

  function changeRate(v: string) {
    setTaxRate(v);
    try { localStorage.setItem(TAX_RATE_KEY, v); } catch { /* ignore */ }
  }
  const suggestions = useMemo(() => {
    const t = name.trim().toLowerCase();
    if (t.length < 2) return [];
    return products.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 4);
  }, [name, products]);

  async function save() {
    setSaving(true);
    const p = await addPurchase({ name: name.trim(), barcode: barcode ? normalizeBarcode(barcode) : undefined, qty: q, unitPrice: up, taxRate: rate, shippingIn: sh, ownerKind, judahPct: splitPct, paidVia });
    if (photoFile && p.product_id) await uploadProductPhoto(p.product_id, photoFile);
    setSavedBasis(p.cost_basis_unit);
    setSaving(false);
    setStep(6);
  }

  return (
    <div>
      <ScreenTitle title="🛒 I Bought Product" sub="One step at a time. Big buttons only." />
      <StepRail steps={STEPS} current={step} />

      {step === 0 && (
        <div>
          <Field label="Type the product name (or tap one you already have)">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 151 Elite Trainer Box" autoFocus />
          </Field>
          {suggestions.map((p) => (
            <button key={p.id} onClick={() => setName(p.name)} className="block w-full text-left rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 mb-2 text-white">{p.name}</button>
          ))}
          <Field label="Barcode (optional)">
            <input className={inputCls} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barcode numbers" inputMode="numeric" />
          </Field>
          <button onClick={() => setScanning(true)} className="w-full rounded-2xl bg-slate-700 text-white py-3 font-semibold mb-3">📷 Scan the barcode with the camera</button>
          {scanning && <BarcodeScanner onCode={(code) => { setBarcode(code); setScanning(false); }} onClose={() => setScanning(false)} />}
          {recognized ? (
            <p className="rounded-2xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 px-4 py-3 mb-3">
              ✓ You've bought this before — <span className="font-bold text-white">{recognized.name}</span>. Name filled in for you.
              {lastPaid && <span className="block text-sm mt-1">Last time: {lastPaid.qty} at {money(Number(lastPaid.unit_price))} each.</span>}
            </p>
          ) : catalogMatch ? (
            <p className="rounded-2xl bg-sky-950/60 border border-sky-700 text-sky-200 px-4 py-3 mb-3">
              📚 Starter library match — <span className="font-bold text-white">{catalogMatch.name}</span>. Name filled in for you; it's your first time buying this one.
              {catalogMatch.a && <span className="block text-sm mt-1">This barcode covers assorted versions of this product — check the name matches your exact box, and fix it if it doesn't.</span>}
            </p>
          ) : barcode.trim().length >= 8 ? (
            <p className="rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 px-4 py-3 mb-3">New barcode — it'll be remembered with this product when you save, so next time it fills itself in.</p>
          ) : null}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(f); if (!name) setName("Photo product (rename me)"); } }} />
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl bg-slate-700 text-white py-3.5 font-semibold mb-4">{photoFile ? "📷 Photo attached ✓ — tap to retake it" : "📷 Take a photo of it"}</button>
          <BigButton disabled={name.trim().length < 2} onClick={() => setStep(1)}>That's it →</BigButton>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-white text-lg font-bold mb-3">{name}</p>
          <Field label="How many did you buy?">
            <input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
          <Field label="Price for EACH one (before tax)">
            <MoneyInput value={unitPrice} onChange={setUnitPrice} />
          </Field>
          <BigButton disabled={q < 1 || up <= 0} onClick={() => setStep(2)}>Next →</BigButton>
          <BackBtn onClick={() => setStep(0)} />
        </div>
      )}

      {step === 2 && (
        <div>
          <Field label="Tax rate on your receipt (%)">
            <div className="relative">
              <input className={inputCls} inputMode="decimal" value={taxRate} onChange={(e) => changeRate(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.000" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
            </div>
          </Field>
          {rate > 0 && (
            <p className="text-slate-300 text-sm mb-4 -mt-2">That's <span className="font-bold text-white">{money(tx)}</span> tax on {money(q * up)} of product — check it against your receipt. The rate stays filled in for next time.</p>
          )}
          {rate <= 0 && <p className="text-slate-400 text-sm mb-4">No tax? Leave it at 0. The receipt shows one rate for everything — type that in and the app figures the dollars.</p>}
          <Field label="Shipping you paid to GET it (total)">
            <MoneyInput value={shippingIn} onChange={setShippingIn} placeholder="0.00" />
          </Field>
          <p className="text-slate-400 text-sm mb-4">Bought it in a store? Shipping is $0.</p>
          <BigButton onClick={() => setStep(3)}>Next →</BigButton>
          <BackBtn onClick={() => setStep(1)} />
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-slate-300 mb-3 font-semibold">Whose product is this?</p>
          <div className="grid gap-3 mb-4">
            <PickBtn active={ownerKind === "mine"} onClick={() => setOwnerKind("mine")} label="🟡 Mine — I paid for it" />
            <PickBtn active={ownerKind === "giovanni"} onClick={() => setOwnerKind("giovanni")} label="🔵 Giovanni's — he paid for it" />
            <PickBtn active={ownerKind === "split"} onClick={() => setOwnerKind("split")} label="🟣 We split it" />
            <PickBtn active={ownerKind === "mom_payback"} onClick={() => setOwnerKind("mom_payback")} label="🟦 Mom paid — I owe her the cost + half the profit" />
          </div>
          {ownerKind === "split" && (
            <Field label={`My share: ${splitPct}%`}>
              <input type="range" min={5} max={95} step={5} value={splitPct} onChange={(e) => setSplitPct(parseInt(e.target.value))} className="w-full accent-yellow-400" />
              <div className="flex justify-between text-slate-400 text-sm"><span>Me {splitPct}%</span><span>Giovanni {100 - splitPct}%</span></div>
            </Field>
          )}
          {ownerKind === "mom_payback" && (
            <p className="text-slate-400 text-sm mb-4">Mom fronted {money(math.totalCost)} for this — that goes on your owed-to-Mom tab right away. When it sells, the app figures the actual profit (what you got for it, after fees and shipping, minus this cost) and adds half of it to what you owe her. You keep the other half. Watch it and log repayments on Check My Profit.</p>
          )}
          <BigButton onClick={() => setStep(4)}>Next →</BigButton>
          <BackBtn onClick={() => setStep(2)} />
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="text-slate-300 mb-3 font-semibold">How did you pay?</p>
          <div className="grid gap-3 mb-4">
            {(["USAA", "Cash", "Other"] as const).map((v) => (
              <PickBtn key={v} active={paidVia === v} onClick={() => setPaidVia(v)} label={v === "USAA" ? "🏦 USAA" : v === "Cash" ? "💵 Cash" : "❓ Other"} />
            ))}
          </div>
          <BigButton onClick={() => setStep(5)}>Next →</BigButton>
          <BackBtn onClick={() => setStep(3)} />
        </div>
      )}

      {step === 5 && (
        <div>
          <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
            <p className="text-white font-bold text-lg mb-1">{name}</p>
            <MathRow label={`${q} × ${money(up)}`} value={money(q * up)} />
            <MathRow label={rate > 0 ? `Tax (${rate}%)` : "Tax"} value={money(tx)} />
            <MathRow label="Shipping in" value={money(sh)} />
            <MathRow label="You paid in total" value={money(math.totalCost)} bold />
            <MathRow label="Cost per item (your cost basis)" value={money(math.costBasisUnit)} bold />
          </div>
          <p className="text-slate-400 text-sm mb-4">This cost per item is what the app uses to figure your profit when it sells.</p>
          <BigButton color="green" disabled={saving} onClick={save}>{saving ? "Saving…" : "✓ Save it — I bought this"}</BigButton>
          <BackBtn onClick={() => setStep(4)} />
        </div>
      )}

      {step === 6 && (
        <div className="text-center py-6">
          <p className="text-6xl mb-3">✅</p>
          <p className="text-white text-xl font-bold">Saved!</p>
          <p className="text-slate-300 mt-2">{q} × {name} is now in your for-sale stock at {savedBasis !== null ? money(savedBasis) : ""} cost each.</p>
          <div className="grid gap-3 mt-6">
            <BigButton onClick={() => go("inventory")}>See inventory</BigButton>
            <BigButton color="slate" onClick={() => go("home")}>Back to start</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="w-full py-3 mt-2 text-slate-400 font-semibold">← Back</button>;
}
function PickBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`w-full rounded-2xl px-5 py-4 text-left text-lg font-bold border ${active ? "bg-yellow-400 text-slate-900 border-yellow-300" : "bg-slate-800 text-white border-slate-700"}`}>{label}</button>
  );
}
