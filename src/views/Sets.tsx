import { useState } from "react";
import { useStore } from "../lib/store";
import { Field, inputCls } from "../components/ui";

// Shared sets of books (DECISIONS #32): create a set, invite by join code,
// join with a code, manage members. Used on the Account screen and on the
// gate screen a signed-in user with no set sees first.
export default function SetsSection() {
  const { sets, members, userId, createSet, joinSet, resetJoinCode, removeMember, leaveSet } = useStore();
  const [newName, setNewName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  async function run(fn: () => Promise<string | null>, okMsg: string) {
    setBusy(true); setErr(null); setMsg(null);
    const e = await fn();
    setBusy(false);
    if (e) setErr(e); else setMsg(okMsg);
  }

  return (
    <div className="mt-8 border-t border-slate-700 pt-5">
      <h2 className="text-lg font-black mb-1">📚 Sets of books</h2>
      <p className="text-slate-400 text-sm mb-4">A set of books is one shared inventory. Everyone in the set sees the same books, each signed in as themselves. You can belong to more than one set and switch at the top of the screen.</p>

      {sets.map((s) => {
        const mine = s.owner_user_id === userId;
        const roster = members.filter((m) => m.set_id === s.id);
        return (
          <div key={s.id} className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-3">
            <p className="text-white font-bold">{s.name} {mine ? <span className="text-yellow-300 text-xs font-black">YOUR SET</span> : <span className="text-slate-400 text-xs font-bold">SHARED WITH YOU</span>}</p>
            {mine && (
              <>
                <p className="text-slate-300 text-sm mt-2">Invite someone: give them this join code. They sign in, type it below under “Join a set”, and they're in.</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="rounded-xl bg-slate-900 border border-slate-600 text-yellow-300 font-black tracking-[0.2em] px-4 py-2 text-lg">{s.join_code}</span>
                  <button disabled={busy}
                    onClick={() => { if (confirmKey === `reset-${s.id}`) { setConfirmKey(null); void run(() => resetJoinCode(s.id), "New join code made — the old one no longer works."); } else setConfirmKey(`reset-${s.id}`); }}
                    className={`rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${confirmKey === `reset-${s.id}` ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-200"}`}>
                    {confirmKey === `reset-${s.id}` ? "Tap again to reset" : "Reset code"}
                  </button>
                </div>
                <div className="mt-3 grid gap-1.5">
                  {roster.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2">
                      <span className="text-slate-300 text-sm">{m.email ?? "A member"} {m.role === "owner" ? "· owner" : ""} {m.user_id === userId ? "· you" : ""}</span>
                      {m.user_id !== userId && (
                        <button disabled={busy}
                          onClick={() => { if (confirmKey === `rm-${m.id}`) { setConfirmKey(null); void run(() => removeMember(s.id, m.user_id), "Member removed."); } else setConfirmKey(`rm-${m.id}`); }}
                          className={`text-xs font-bold rounded-full px-2.5 py-1 disabled:opacity-50 ${confirmKey === `rm-${m.id}` ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                          {confirmKey === `rm-${m.id}` ? "Tap again to remove" : "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {!mine && (
              <button disabled={busy}
                onClick={() => { if (confirmKey === `leave-${s.id}`) { setConfirmKey(null); void run(() => leaveSet(s.id), "You left that set."); } else setConfirmKey(`leave-${s.id}`); }}
                className={`mt-2 text-xs font-bold rounded-full px-2.5 py-1 disabled:opacity-50 ${confirmKey === `leave-${s.id}` ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                {confirmKey === `leave-${s.id}` ? "Tap again to leave for good" : "Leave this set"}
              </button>
            )}
          </div>
        );
      })}

      <Field label="Start a new set of books">
        <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Judah's card business" />
      </Field>
      <button disabled={busy || newName.trim().length < 2} onClick={() => { void run(() => createSet(newName), "Set created — its join code is above."); setNewName(""); }}
        className="w-full rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-semibold disabled:opacity-40 mb-4">Create set</button>

      <Field label="Join a set with a code">
        <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8-letter code" autoCapitalize="characters" />
      </Field>
      <button disabled={busy || code.trim().length < 4} onClick={() => { void run(() => joinSet(code), "You're in — the set is at the top of the screen."); setCode(""); }}
        className="w-full rounded-2xl bg-yellow-400 text-slate-900 py-3 font-black disabled:opacity-40">Join set</button>

      {err && <p className="mt-3 rounded-xl bg-rose-900/50 border border-rose-700 text-rose-200 px-4 py-3 text-sm">{err}</p>}
      {msg && <p className="text-emerald-300 text-sm font-semibold mt-3">{msg}</p>}
    </div>
  );
}
