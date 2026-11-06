import { useRef, useState } from "react";
import { useStore } from "../lib/store";
import { BigButton, ScreenTitle } from "../components/ui";

export default function BankStub() {
  const { recordBankImport } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      const rows = text.split(/\r?\n/).filter((l) => l.trim()).length;
      await recordBankImport(file.name, rows);
      setMsg(`Got it — ${file.name} has ${rows} lines. Matching bank lines to your buys and sales is Phase 2 (coming with the USAA connection), so nothing else happens with this file yet.`);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <ScreenTitle title="🏦 Bank" sub="Your USAA account connects in Phase 2." />
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 text-slate-300 leading-relaxed mb-4">
        <p className="text-white font-bold mb-1">What's coming</p>
        <p>Soon the app will read your USAA account (through Teller) and match deposits and card charges to your buys and sales automatically.</p>
        <p className="mt-2">For now, if you download a USAA CSV, you can drop it here so it's on file. The app counts the lines and saves the upload record — matching comes in Phase 2.</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <BigButton color="blue" onClick={() => fileRef.current?.click()}>📤 Upload a USAA CSV (stub)</BigButton>
      {msg && <p className="mt-3 rounded-xl bg-sky-900/50 border border-sky-700 text-sky-100 px-4 py-3">{msg}</p>}
    </div>
  );
}
