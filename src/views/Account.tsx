import { useState } from "react";
import { useStore } from "../lib/store";
import { getPriceApiKey, priceProvider, setPriceApiKey } from "../lib/priceProvider";
import { money } from "../lib/math";
import { BigButton, Field, inputCls, ScreenTitle } from "../components/ui";
import SetsSection from "./Sets";

function PriceKeySection() {
  const { priceKeyInBooks, savePriceKey } = useStore();
  const [key, setKey] = useState(getPriceApiKey());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const hasKey = !!getPriceApiKey() || priceKeyInBooks;

  async function save() {
    await savePriceKey(key);
    setSaved(true);
    setTestMsg(null);
  }

  async function test() {
    setPriceApiKey(key);
    setTesting(true);
    setTestMsg(null);
    const r = await priceProvider.lookup("Charizard");
    setTesting(false);
    setTestMsg(r.isSample
      ? `Still sample prices. What actually happened: ${r.provider}`
      : `It works — real prices are on. Test lookup: Charizard, ${money(r.price)} right now.`);
  }

  return (
    <div className="mt-8 border-t border-slate-700 pt-5">
      <h2 className="text-lg font-black mb-1">💲 Real prices</h2>
      <p className="text-slate-400 text-sm mb-3">
        {priceKeyInBooks
          ? "The price key is saved in your shared books, so Price Scanner and Inventory use real market prices (TCG API) on every device in this set. The free key covers 100 lookups a day."
          : hasKey
            ? "A price key is saved on this device only. Save it again here while signed in and it goes into your shared books too, so it works on every device."
            : "Right now price lookups show SAMPLE prices. Paste the free TCG API key (starts with tcg_live_) and save — while you're signed in it goes into your shared books and works on every device in the set."}
      </p>
      <Field label="TCG API key">
        <input className={inputCls} type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} placeholder={priceKeyInBooks && !getPriceApiKey() ? "Key is in your shared books — type a new one to replace it" : "tcg_live_…"} />
      </Field>
      <div className="flex gap-3">
        <button onClick={() => void save()} className="flex-1 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-semibold">{saved ? "✓ Saved" : "Save key"}</button>
        <button onClick={() => void test()} disabled={testing || !key.trim()} className="flex-1 rounded-2xl bg-yellow-400 text-slate-900 py-3 font-black disabled:opacity-40">{testing ? "Testing…" : "Test it"}</button>
      </div>
      {testMsg && <p className="text-slate-300 text-sm mt-3">{testMsg}</p>}
    </div>
  );
}

export default function Account() {
  const { userEmail, signIn, signInWithGoogle, signOut, remote } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doGoogle() {
    setBusy(true); setError(null);
    const err = await signInWithGoogle();
    setBusy(false);
    if (err) setError(`Google sign-in didn't start: ${err}`);
  }

  async function doSignIn() {
    setBusy(true); setError(null);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
  }

  if (userEmail) {
    return (
      <div>
        <ScreenTitle title="👤 Account" sub={`Signed in as ${userEmail}`} />
        <p className="text-slate-300 mb-4">Your books are saved to your own account in the cloud.</p>
        <BigButton color="slate" onClick={() => void signOut()}>Sign out</BigButton>
        <SetsSection />
        <PriceKeySection />
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="🔑 Sign In" sub="Right now the app is showing demo books so you can try every button. Sign in with your real account to keep your own books." />
      <button onClick={() => void doGoogle()} disabled={busy}
        className="w-full rounded-2xl bg-white text-slate-900 py-4 font-black text-lg mb-3 disabled:opacity-50">
        Sign in with Google
      </button>
      <p className="text-slate-400 text-sm mb-4">That makes these books your own private ones under your Google account — anything already in the demo books gets moved over. Or use email and password below if Mom set one up.</p>
      <Field label="Email">
        <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      </Field>
      <Field label="Password">
        <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="mb-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3">{error}</p>}
      <BigButton disabled={busy || !email || !password} onClick={doSignIn}>{busy ? "Signing in…" : "Sign in"}</BigButton>
      <p className="text-slate-500 text-sm mt-3">{remote ? "Cloud is connected." : "Cloud unreachable right now; demo books are on this phone."}</p>
      <PriceKeySection />
    </div>
  );
}
