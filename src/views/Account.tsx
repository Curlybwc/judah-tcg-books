import { useState } from "react";
import { useStore } from "../lib/store";
import { BigButton, Field, inputCls, ScreenTitle } from "../components/ui";

export default function Account() {
  const { userEmail, signIn, signOut, remote } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      </div>
    );
  }

  return (
    <div>
      <ScreenTitle title="🔑 Sign In" sub="Right now the app is showing demo books so you can try every button. Sign in with your real account to keep your own books." />
      <Field label="Email">
        <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      </Field>
      <Field label="Password">
        <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="mb-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3">{error}</p>}
      <BigButton disabled={busy || !email || !password} onClick={doSignIn}>{busy ? "Signing in…" : "Sign in"}</BigButton>
      <p className="text-slate-500 text-sm mt-3">No sign-up here — Mom creates the account first (one-time morning setup). {remote ? "Cloud is connected." : "Cloud unreachable right now; demo books are on this phone."}</p>
    </div>
  );
}
