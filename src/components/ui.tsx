import React from "react";

export function StepRail({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap gap-1.5 mb-5" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            active ? "bg-yellow-400 text-slate-900" : done ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300"}`}>
            <span>{done ? "✓" : i + 1}</span> {s}
          </li>
        );
      })}
    </ol>
  );
}

export function BigButton({ children, onClick, color = "yellow", disabled }: {
  children: React.ReactNode; onClick?: () => void; color?: "yellow" | "green" | "blue" | "slate" | "red"; disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    yellow: "bg-yellow-400 text-slate-900 active:bg-yellow-300",
    green: "bg-emerald-500 text-white active:bg-emerald-400",
    blue: "bg-sky-500 text-white active:bg-sky-400",
    slate: "bg-slate-700 text-white active:bg-slate-600",
    red: "bg-rose-500 text-white active:bg-rose-400",
  };
  return (
    <button disabled={disabled} onClick={onClick}
      className={`w-full rounded-2xl px-5 py-4 text-lg font-bold shadow ${colors[color]} disabled:opacity-40 disabled:shadow-none`}>
      {children}
    </button>
  );
}

export function JobButton({ emoji, label, sub, onClick }: { emoji: string; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl bg-slate-800 border border-slate-700 px-5 py-5 text-left shadow active:bg-slate-700 flex items-center gap-4">
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <span>
        <span className="block text-xl font-bold text-white">{label}</span>
        {sub && <span className="block text-sm text-slate-400">{sub}</span>}
      </span>
      <span className="ml-auto text-slate-500 text-2xl">›</span>
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3.5 text-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400";

export function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">$</span>
      <input inputMode="decimal" className={`${inputCls} pl-8`} value={value} placeholder={placeholder ?? "0.00"}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
    </div>
  );
}

export function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-extrabold text-white">{title}</h1>
      {sub && <p className="text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function MathRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "border-t border-slate-600 mt-1 pt-2.5 text-lg font-bold text-white" : "text-slate-300"}`}>
      <span>{label}</span>
      <span className={negative ? "text-rose-400" : undefined}>{value}</span>
    </div>
  );
}

export function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-700 text-slate-200", green: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-slate-900", red: "bg-rose-600 text-white",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function ownerLabel(kind: string, pct: number): string {
  if (kind === "mine") return "Mine";
  if (kind === "giovanni") return "Giovanni's";
  if (kind === "mom_payback" || kind === "mom_split") return "Mom's — cost + half the profit";
  return `Split — ${pct}% mine`;
}
