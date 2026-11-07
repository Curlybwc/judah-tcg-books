import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money } from "../lib/math";
import { Chip, ScreenTitle, ownerLabel } from "../components/ui";
import { priceProvider } from "../lib/priceProvider";
import { useRef } from "react";
import type { View } from "../App";

export default function Inventory({ go }: { go: (v: View) => void }) {
  const { lots, products, sales, undoPurchaseForLot, adjustStock, bulkRemoveLots, setProductImage, uploadProductPhoto } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState<string>("damaged");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPhotoProduct = useRef<string | null>(null);

  function pickPhoto(productId: string) {
    pendingPhotoProduct.current = productId;
    fileRef.current?.click();
  }

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const pid = pendingPhotoProduct.current;
    if (!f || !pid) return;
    setPhotoBusy(true);
    const ok = await uploadProductPhoto(pid, f);
    setPhotoBusy(false);
    setPhotoMsg(ok ? "Photo saved ✓" : "That photo didn't save — try again.");
  }

  async function findOnlinePhoto(productId: string, name: string) {
    setPhotoBusy(true);
    setPhotoMsg(null);
    const r = await priceProvider.lookup(name);
    setPhotoBusy(false);
    if (r.imageUrl) { await setProductImage(productId, r.imageUrl); setPhotoMsg("Online product photo added ✓"); }
    else setPhotoMsg(r.isSample ? "No online photo yet — that needs the real price key (Account screen). Your own photo always works." : "No online photo found for that name — try your own photo.");
  }

  function toggleSel(id: string) {
    setConfirmRemove(false);
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  const selectedLots = lots.filter((l) => selected.has(l.id));

  async function zeroSelected() {
    setBusy(true);
    for (const lot of selectedLots) {
      if (lot.qty_on_hand > 0) await adjustStock(lot, lot.qty_on_hand, "other");
    }
    setBusy(false);
    setEditMsg(`Zeroed out ${selectedLots.filter((l) => l.qty_on_hand > 0).length} row${selectedLots.length === 1 ? "" : "s"} — the removals are in the stock-adjustment record.`);
    setSelected(new Set());
  }

  async function removeSelected() {
    setBusy(true);
    const removed = await bulkRemoveLots(selectedLots);
    const skipped = selectedLots.length - removed;
    setBusy(false);
    setConfirmRemove(false);
    setEditMsg(`Removed ${removed} row${removed === 1 ? "" : "s"} completely (buy + stock).${skipped > 0 ? ` ${skipped} couldn't be removed — something already sold from ${skipped === 1 ? "it" : "them"}, so the history stays. Zero those out instead.` : ""}`);
    setSelected(new Set());
  }
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; market: number | null; productId: string | null; imageUrl: string | null; lots: typeof lots }>();
    for (const lot of lots) {
      if (lot.qty_on_hand <= 0) continue;
      const p = products.find((x) => x.id === lot.product_id);
      const name = p?.name ?? "Product";
      if (!map.has(name)) map.set(name, { name, market: p?.market_price ?? null, productId: p?.id ?? null, imageUrl: p?.image_url ?? null, lots: [] });
      map.get(name)!.lots.push(lot);
    }
    return [...map.values()];
  }, [lots, products]);
  const totalUnits = groups.reduce((s, g) => s + g.lots.reduce((a, l) => a + l.qty_on_hand, 0), 0);

  return (
    <div>
      <ScreenTitle title="📦 What I Have For Sale" sub={`${totalUnits} items ready to sell. (Your personal collection stays in Collectr — this is only for-sale stock.)`} />
      <button onClick={() => { setEditMode(!editMode); setSelected(new Set()); setEditMsg(null); setConfirmRemove(false); }}
        className={`w-full rounded-2xl py-3 font-bold mb-4 ${editMode ? "bg-yellow-400 text-slate-900" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>
        {editMode ? "✓ Done editing" : "✏️ Bulk edit stock"}
      </button>

      {editMode && (
        <div className="mb-5">
          <p className="text-slate-300 text-sm mb-2">Tap rows to select them — including rows at zero, so leftovers can be removed for good. Then zero them out (kept in the adjustment record) or remove the rows completely (only works if nothing ever sold from them).</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSelected(new Set(lots.map((l) => l.id)))} className="flex-1 rounded-xl bg-slate-700 text-white py-2 font-bold text-sm">Select all</button>
            <button onClick={() => setSelected(new Set())} className="flex-1 rounded-xl bg-slate-700 text-white py-2 font-bold text-sm">Select none</button>
          </div>
          <div className="grid gap-2 mb-3">
            {lots.map((l) => {
              const p = products.find((x) => x.id === l.product_id);
              const soldFrom = sales.some((s) => s.lot_id === l.id);
              const on = selected.has(l.id);
              return (
                <button key={l.id} onClick={() => toggleSel(l.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left border ${on ? "bg-yellow-400/15 border-yellow-400" : "bg-slate-800 border-slate-700"}`}>
                  <span className="flex justify-between items-center gap-2">
                    <span className="text-white font-semibold">{on ? "☑️ " : "⬜ "}{p?.name ?? "Product"}</span>
                    <span className="text-slate-300 text-sm font-bold whitespace-nowrap">{l.qty_on_hand} on hand</span>
                  </span>
                  <span className="text-slate-400 text-sm block">{money(Number(l.cost_basis_unit))} cost · {ownerLabel(l.owner_kind, Number(l.judah_pct))}{soldFrom ? " · has sales (can't fully remove)" : ""}</span>
                </button>
              );
            })}
            {lots.length === 0 && <p className="text-slate-400">No stock rows at all.</p>}
          </div>
          {editMsg && <p className="text-emerald-300 text-sm font-semibold mb-3">{editMsg}</p>}
          <div className="grid gap-2">
            <button disabled={busy || selectedLots.length === 0} onClick={() => void zeroSelected()}
              className="w-full rounded-2xl bg-slate-700 text-white py-3.5 font-bold disabled:opacity-40">
              Zero out selected ({selectedLots.length})
            </button>
            <button disabled={busy || selectedLots.length === 0}
              onClick={() => { if (confirmRemove) void removeSelected(); else setConfirmRemove(true); }}
              className={`w-full rounded-2xl py-3.5 font-bold disabled:opacity-40 ${confirmRemove ? "bg-rose-500 text-white" : "bg-slate-700 text-white"}`}>
              {confirmRemove ? `Tap again to remove ${selectedLots.length} row${selectedLots.length === 1 ? "" : "s"} for good` : `Remove selected rows completely (${selectedLots.length})`}
            </button>
          </div>
        </div>
      )}

      {!editMode && groups.length === 0 && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 text-slate-300">
          Nothing for sale yet. Tap “I Bought Product” when you buy something to sell.
        </div>
      )}
      {!editMode && (
      <div className="grid gap-3">
        {groups.map((g) => {
          const units = g.lots.reduce((a, l) => a + l.qty_on_hand, 0);
          return (
            <div key={g.name} className="rounded-3xl bg-slate-800 border border-slate-700 p-5">
              <div className="flex gap-3">
                {g.imageUrl
                  ? <img src={g.imageUrl} alt={g.name} className="w-16 h-16 rounded-2xl object-cover bg-slate-700 shrink-0" />
                  : <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center text-2xl shrink-0">📦</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-white font-bold text-lg leading-snug">{g.name}</p>
                    <span className="rounded-full bg-yellow-400 text-slate-900 font-black px-3 py-1 text-sm whitespace-nowrap">{units} on hand</span>
                  </div>
                  {g.productId && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <button disabled={photoBusy} onClick={() => pickPhoto(g.productId!)} className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-200 disabled:opacity-50">{g.imageUrl ? "📷 Change photo" : "📷 Add your photo"}</button>
                      {!g.imageUrl && <button disabled={photoBusy} onClick={() => void findOnlinePhoto(g.productId!, g.name)} className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-200 disabled:opacity-50">🌐 Find online photo</button>}
                    </div>
                  )}
                </div>
              </div>
              {g.market !== null && <p className="text-slate-400 text-sm mt-1">Selling for about {money(g.market)} each <Chip tone="amber">SAMPLE price</Chip></p>}
              <div className="mt-2 grid gap-1.5">
                {g.lots.map((l) => {
                  const soldFrom = sales.some((s) => s.lot_id === l.id);
                  return (
                    <div key={l.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-slate-400 text-sm">{l.qty_on_hand} × at {money(Number(l.cost_basis_unit))} cost · <span className="text-slate-200 font-semibold">{ownerLabel(l.owner_kind, Number(l.judah_pct))}</span></p>
                        <span className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => { setAdjustId(adjustId === l.id ? null : l.id); setAdjustQty(1); setAdjustReason("damaged"); }}
                            className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-300">
                            Adjust stock
                          </button>
                          {!soldFrom && (
                            <button
                              onClick={() => { if (confirmId === l.id) { void undoPurchaseForLot(l); setConfirmId(null); } else setConfirmId(l.id); }}
                              className={`text-xs font-bold rounded-full px-2.5 py-1 ${confirmId === l.id ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-300"}`}>
                              {confirmId === l.id ? "Tap again to undo this buy" : "Undo buy"}
                            </button>
                          )}
                        </span>
                      </div>
                      {adjustId === l.id && (
                        <div className="mt-2 rounded-xl bg-slate-900 border border-slate-700 p-3">
                          <p className="text-slate-300 text-sm font-semibold mb-2">Take out of stock without a sale — what happened?</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {[["damaged", "💔 Damaged"], ["kept", "⭐ Kept for my collection"], ["returned", "↩️ Returned it"], ["lost", "❓ Lost"], ["other", "Other"]].map(([v, label]) => (
                              <button key={v} onClick={() => setAdjustReason(v)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${adjustReason === v ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{label}</button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <button onClick={() => setAdjustQty(Math.max(1, adjustQty - 1))} className="w-10 h-10 rounded-full bg-slate-700 text-white text-xl font-black">−</button>
                            <span className="text-white font-black text-xl w-8 text-center">{adjustQty}</span>
                            <button onClick={() => setAdjustQty(Math.min(l.qty_on_hand, adjustQty + 1))} className="w-10 h-10 rounded-full bg-slate-700 text-white text-xl font-black">+</button>
                            <span className="text-slate-400 text-sm">of {l.qty_on_hand} on hand</span>
                          </div>
                          <button
                            onClick={() => { void adjustStock(l, adjustQty, adjustReason); setAdjustId(null); }}
                            className="w-full rounded-xl bg-rose-500 text-white py-2.5 font-bold">
                            Remove {adjustQty} from stock
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoFile(e)} />
      {photoMsg && <p className="text-emerald-300 text-sm font-semibold mt-3">{photoMsg}</p>}
      <button onClick={() => go("buy")} className="w-full mt-5 rounded-2xl bg-yellow-400 text-slate-900 py-4 font-bold text-lg">🛒 I bought more product</button>
    </div>
  );
}
