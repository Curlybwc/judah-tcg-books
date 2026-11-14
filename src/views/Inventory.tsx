import { useEffect, useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { money , profitAtMarket } from "../lib/math";
import { BigButton, Chip, Field, inputCls, MoneyInput, ScreenTitle, ownerLabel } from "../components/ui";
import BarcodeScanner from "../components/BarcodeScanner";
import { catalogLookup, normalizeBarcode } from "../lib/catalog";
import type { Lot, OwnerKind, PaidVia } from "../lib/types";
import { identifyByPhoto, priceProvider, type IdentifyOutcome, type PriceResult } from "../lib/priceProvider";
import { blobToDataUrl, compressImageFile } from "../lib/photos";
import { useRef } from "react";
import type { View } from "../App";

export default function Inventory({ go }: { go: (v: View) => void }) {
  const { lots, products, sales, undoPurchaseForLot, adjustStock, bulkRemoveLots, setProductImage, uploadProductPhoto, applyIdentified, currentSetId, priceRequests, requestPrices, refreshPriceRequests } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [editBuyId, setEditBuyId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustReason, setAdjustReason] = useState<string>("damaged");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState<string | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPhotoProduct = useRef<string | null>(null);
  const identifyRef = useRef<HTMLInputElement>(null);
  const pendingIdentify = useRef<{ productId: string; name: string } | null>(null);
  const [identifyBusy, setIdentifyBusy] = useState(false);
  const [fixPanel, setFixPanel] = useState<{ productId: string; name: string; mode: "name" | "ask" | "photo"; nameResult?: PriceResult; outcome?: IdentifyOutcome } | null>(null);

  // Fix-name flow (DECISIONS #44): the FREE name search goes first. A photo
  // scan — a limited balance — is spent only when the name search can't pin
  // the product down AND the user taps to spend one.
  async function startFixName(productId: string, name: string) {
    setIdentifyBusy(true); setPriceMsg(null); setFixPanel(null);
    const r = await priceProvider.lookup(name);
    setIdentifyBusy(false);
    if (!r.isSample) setFixPanel({ productId, name, mode: "name", nameResult: r });
    else setFixPanel({ productId, name, mode: "ask" });
  }

  function pickIdentify(productId: string, name: string) {
    pendingIdentify.current = { productId, name };
    identifyRef.current?.click();
  }

  async function onIdentifyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const target = pendingIdentify.current;
    if (!f || !target) return;
    setIdentifyBusy(true); setPriceMsg(null);
    const dataUrl = await blobToDataUrl(await compressImageFile(f));
    const outcome = await identifyByPhoto(dataUrl);
    setIdentifyBusy(false);
    setFixPanel({ productId: target.productId, name: target.name, mode: "photo", outcome });
  }

  async function applyCandidate(productId: string, candName: string, price: number) {
    let p = price;
    if (!(p > 0)) {
      const r = await priceProvider.lookup(candName);
      if (!r.isSample && !r.choices && r.price > 0) p = r.price;
    }
    if (!(p > 0)) { setPriceMsg(`Found their name — ${candName} — but no price came with it. The name was not changed; try 💲 Look up price after renaming by hand.`); return; }
    const ok = await applyIdentified(productId, candName, p);
    setFixPanel(null);
    if (ok) setPriceMsg(`Renamed to their exact name: ${candName} · market ${money(p)} ✓ — future lookups for it are plain name searches now.`);
  }

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

  // One item through the Maven door (DECISIONS #72).
  async function lookupOne(g: { productId: string | null; name: string }) {
    if (!g.productId || priceBusy) return;
    if (!currentSetId || currentSetId === "11111111-1111-4111-8111-111111111111") { setPriceMsg("Sign in with your real books first — prices come through Maven there."); return; }
    setPriceBusy(true); setPriceMsg(null);
    const ok = await requestPrices([{ product_id: g.productId, name: g.name }]);
    setPriceBusy(false);
    setPriceMsg(ok ? `${g.name}: sent to Maven — the price lands here when he's done.` : `${g.name}: couldn't send — check your connection and tap again.`);
  }

  // Update prices = one door request covering every in-stock product
  // (DECISIONS #72). No clipboard, no pasting, no Muse account for
  // Judah — Maven works it from Jen's side and writes prices back.
  async function lookupAll() {
    const targets = groups.filter((g) => g.productId && g.lots.reduce((a, l) => a + l.qty_on_hand, 0) > 0);
    if (!targets.length || priceBusy) return;
    if (!currentSetId || currentSetId === "11111111-1111-4111-8111-111111111111") { setPriceMsg("Sign in with your real books first — prices come through Maven there."); return; }
    setPriceBusy(true); setPriceMsg(null);
    const ok = await requestPrices(targets.map((g) => ({ product_id: g.productId!, name: g.name })));
    setPriceBusy(false);
    setPriceMsg(ok ? `Sent ${targets.length} product${targets.length === 1 ? "" : "s"} to Maven — he's pricing them from TCGplayer now.` : "Couldn't send the price request — check your connection and tap again.");
  }

  async function findOnlinePhoto(productId: string, name: string) {
    setPhotoBusy(true);
    setPhotoMsg(null);
    const r = await priceProvider.lookup(name);
    setPhotoBusy(false);
    const img = r.imageUrl ?? r.choices?.[0]?.imageUrl;
    if (img) { await setProductImage(productId, img); setPhotoMsg("Online product photo added ✓"); }
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
    const map = new Map<string, { name: string; market: number | null; marketAt: string | null; source: string | null; productId: string | null; imageUrl: string | null; lots: typeof lots }>();
    for (const lot of lots) {
      if (lot.qty_on_hand <= 0) continue;
      const p = products.find((x) => x.id === lot.product_id);
      const name = p?.name ?? "Product";
      if (!map.has(name)) map.set(name, { name, market: p?.market_price ?? null, marketAt: p?.market_price_at ?? null, source: p?.market_price_source ?? null, productId: p?.id ?? null, imageUrl: p?.image_url ?? null, lots: [] });
      map.get(name)!.lots.push(lot);
    }
    return [...map.values()];
  }, [lots, products]);

  // The Maven price door (DECISIONS #72): the newest request drives the
  // button state and the status line; while one is open, this screen
  // re-checks every 20 seconds so prices land on their own.
  const latestRequest = priceRequests[0] ?? null;
  const doorBusy = latestRequest?.status === "pending" || latestRequest?.status === "working";
  const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  useEffect(() => {
    if (!doorBusy) return;
    const t = setInterval(() => { void refreshPriceRequests(); }, 20000);
    return () => clearInterval(t);
  }, [doorBusy, refreshPriceRequests]);

  const totalUnits = groups.reduce((s, g) => s + g.lots.reduce((a, l) => a + l.qty_on_hand, 0), 0);
  const q = query.trim().toLowerCase();
  const visibleGroups = q ? groups.filter((g) => {
    const p = products.find((x) => x.id === g.productId);
    return g.name.toLowerCase().includes(q) || (p?.barcode ?? "").includes(query.trim());
  }) : groups;
  const visibleLots = q ? lots.filter((l) => {
    const p = products.find((x) => x.id === l.product_id);
    return (p?.name ?? "").toLowerCase().includes(q) || (p?.barcode ?? "").includes(query.trim());
  }) : lots;

  return (
    <div>
      <ScreenTitle title="📦 Inventory" sub={`${totalUnits} items in stock. (Your personal collection stays in Collectr — this is only for-sale stock.)`} />
      <div className="mb-3">
        <BigButton color="green" onClick={() => { try { sessionStorage.setItem("jtb-open-scanner", "1"); } catch { /* ignore */ } go("buy"); }}>📷 Scan a barcode — add inventory</BigButton>
      </div>
      <div className="mb-3">
        <BigButton onClick={() => void lookupAll()} disabled={priceBusy || doorBusy}>{doorBusy ? "⏳ Maven is pricing…" : "💲 Update prices — Maven gets them from TCGplayer"}</BigButton>
      </div>
      {latestRequest && (
        <p className="text-slate-400 text-sm mb-3 -mt-1">
          {latestRequest.status === "pending" && <>Price request sent to Maven {fmtWhen(latestRequest.created_at)} — prices land here when he's done.</>}
          {latestRequest.status === "working" && <>Maven is pricing your stock right now…</>}
          {latestRequest.status === "done" && <>✓ Maven updated {latestRequest.report?.updated?.length ?? 0} price{(latestRequest.report?.updated?.length ?? 0) === 1 ? "" : "s"} · {fmtWhen(latestRequest.completed_at ?? latestRequest.created_at)}{(latestRequest.report?.skipped?.length ?? 0) > 0 ? ` · ${latestRequest.report?.skipped?.length} couldn't be matched — tap 💲 on those to send one at a time.` : ""}</>}
          {latestRequest.status === "failed" && <>⚠️ The last price run didn't finish — tap Update prices to send it again.</>}
        </p>
      )}
      <div className="mb-3">
        <BigButton onClick={() => go("buy")}>＋ Add inventory — I bought product</BigButton>
      </div>
      <button onClick={() => go("quickadd")} className="w-full mb-3 rounded-2xl bg-slate-800 border border-slate-700 py-3 text-slate-200 font-bold">⚡ Quick Add — bought several things at once</button>
      <input className={`${inputCls} mb-4`} placeholder="🔍 Search your stock — type a name or barcode…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {q && <p className="text-slate-400 text-sm mb-3">{visibleGroups.length} product{visibleGroups.length === 1 ? "" : "s"} match "{query}".</p>}
      <button onClick={() => { setEditMode(!editMode); setSelected(new Set()); setEditMsg(null); setConfirmRemove(false); }}
        className={`w-full rounded-2xl py-3 font-bold mb-4 ${editMode ? "bg-yellow-400 text-slate-900" : "bg-slate-800 border border-slate-700 text-slate-200"}`}>
        {editMode ? "✓ Done editing" : "✏️ Bulk edit stock"}
      </button>

      {editMode && (
        <div className="mb-5">
          <p className="text-slate-300 text-sm mb-2">Tap rows to select them — including rows at zero, so leftovers can be removed for good. Then zero them out (kept in the adjustment record) or remove the rows completely (only works if nothing ever sold from them).</p>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSelected(new Set(visibleLots.map((l) => l.id)))} className="flex-1 rounded-xl bg-slate-700 text-white py-2 font-bold text-sm">Select all</button>
            <button onClick={() => setSelected(new Set())} className="flex-1 rounded-xl bg-slate-700 text-white py-2 font-bold text-sm">Select none</button>
          </div>
          <div className="grid gap-2 mb-3">
            {visibleLots.map((l) => {
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
            {visibleLots.length === 0 && <p className="text-slate-400">{lots.length === 0 ? "No stock rows at all." : "Nothing matches that search."}</p>}
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

      {!editMode && editMsg && <p className="text-emerald-300 text-sm font-semibold mb-3">{editMsg}</p>}
      {!editMode && priceMsg && <p className="text-emerald-300 text-sm font-semibold mb-3">{priceMsg}</p>}
      <input ref={identifyRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onIdentifyFile(e)} />
      {!editMode && identifyBusy && <p className="text-slate-300 text-sm font-semibold mb-3">🔎 Checking… give it a few seconds.</p>}
      {!editMode && fixPanel && (
        <div className="rounded-2xl bg-slate-800 border border-sky-700 p-4 mb-3">
          <div className="flex justify-between items-start gap-3">
            <p className="text-white font-bold">🏷️ Fix name — {fixPanel.name}</p>
            <button onClick={() => setFixPanel(null)} className="text-slate-400 font-black px-2">✕</button>
          </div>
          {fixPanel.mode === "name" && fixPanel.nameResult && !fixPanel.nameResult.choices && (
            <>
              <p className="text-slate-300 text-sm mt-1">The <b>free name search already finds this one</b> — no photo scan needed. They call it:</p>
              <p className="text-white font-black text-lg mt-1">{fixPanel.nameResult.matchedName} · {money(fixPanel.nameResult.price)}</p>
              <button onClick={() => void applyCandidate(fixPanel.productId, fixPanel.nameResult!.matchedName ?? fixPanel.name, fixPanel.nameResult!.price)} className="mt-2 rounded-xl bg-yellow-400 text-slate-900 px-4 py-2.5 font-black">Use their name + price</button>
            </>
          )}
          {fixPanel.mode === "name" && fixPanel.nameResult?.choices && (
            <>
              <p className="text-slate-400 text-sm mt-1 mb-2">The free name search found these — tap the right one to rename + save its price:</p>
              <div className="grid gap-2">
                {fixPanel.nameResult.choices.map((c, i) => (
                  <button key={i} onClick={() => void applyCandidate(fixPanel.productId, c.matchedName ?? "", c.price)} className="flex items-center gap-3 rounded-xl bg-slate-700/60 border border-slate-600 p-2.5 text-left">
                    {c.imageUrl && <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-700" />}
                    <span className="flex-1 text-slate-100 font-bold text-sm">{c.matchedName}</span>
                    <span className="text-white font-black">{money(c.price)}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => pickIdentify(fixPanel.productId, fixPanel.name)} className="mt-3 rounded-xl bg-slate-700 text-slate-100 px-4 py-2.5 font-bold">None of these — 📷 use a photo scan (1 scan)</button>
            </>
          )}
          {fixPanel.mode === "ask" && (
            <>
              <p className="text-slate-300 text-sm mt-1">The free name search <b>can't find “{fixPanel.name}”</b> in their catalog. A photo scan can read the box itself — it uses 1 scan from the account (25 free to start).</p>
              <button onClick={() => pickIdentify(fixPanel.productId, fixPanel.name)} className="mt-2 rounded-xl bg-yellow-400 text-slate-900 px-4 py-2.5 font-black">📷 Scan the box</button>
            </>
          )}
          {fixPanel.mode === "photo" && fixPanel.outcome && (
            <>
              {(fixPanel.outcome.status === "matched" || fixPanel.outcome.status === "ambiguous") && fixPanel.outcome.candidates.length > 0 ? (
                <>
                  <p className="text-slate-400 text-sm mt-1 mb-2">Tap the right one to rename this product to their exact name and save its price. After that, lookups are plain name searches — no more photo scans needed for it.</p>
                  <div className="grid gap-2">
                    {fixPanel.outcome.candidates.slice(0, 4).map((c, i) => (
                      <button key={i} onClick={() => void applyCandidate(fixPanel.productId, c.matchedName ?? "", c.price)} className="flex items-center gap-3 rounded-xl bg-slate-700/60 border border-slate-600 p-2.5 text-left">
                        {c.imageUrl && <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-700" />}
                        <span className="flex-1 text-slate-100 font-bold text-sm">{c.matchedName}</span>
                        <span className="text-white font-black">{c.price > 0 ? money(c.price) : "price on tap"}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-amber-200 text-sm mt-1">{fixPanel.outcome.status === "retake" ? `One more photo: ${fixPanel.outcome.message ?? "the picture wasn't clear enough."}` : fixPanel.outcome.status === "not_found" ? "The photo read fine, but nothing in their catalog matches it." : fixPanel.outcome.message ?? "The photo scan didn't work."}</p>
              )}
              {fixPanel.outcome.scansRemaining != null && <p className="text-slate-500 text-xs mt-2">📷 {fixPanel.outcome.scansRemaining} photo scans left on the account</p>}
            </>
          )}
        </div>
      )}
      {!editMode && groups.length === 0 && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 text-slate-300">
          Nothing in inventory yet. Tap “＋ Add inventory” when you buy something to sell.
        </div>
      )}
      {!editMode && (
      <div className="grid gap-3">
        {q && visibleGroups.length === 0 && <p className="text-slate-400 mb-3">Nothing in stock matches that search.</p>}
        {visibleGroups.map((g) => {
          const units = g.lots.reduce((a, l) => a + l.qty_on_hand, 0);
          const atMarket = g.market !== null && units > 0 ? profitAtMarket(g.lots, g.market) : null;
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
                      <button disabled={priceBusy} onClick={() => void lookupOne(g)} className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-200 disabled:opacity-50">💲 Look up price</button>
                      <button disabled={identifyBusy} onClick={() => void startFixName(g.productId!, g.name)} className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-200 disabled:opacity-50">🏷️ Fix name</button>
                    </div>
                  )}
                </div>
              </div>
              {g.market !== null ? (
                <p className="text-slate-400 text-sm mt-1">
                  Market <span className="text-slate-100 font-bold">{money(g.market)}</span> each{g.source === "tcgplayer" && <> · <span className="text-emerald-400 font-semibold">TCGplayer ✓</span></>}
                  {units > 0 && <> · {units} on hand ≈ <span className="text-slate-100 font-semibold">{money(g.market * units)}</span></>}
                  {atMarket !== null && <> · profit if sold <span className={`font-bold ${atMarket >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{atMarket >= 0 ? `+${money(atMarket)}` : `−${money(Math.abs(atMarket))}`}</span></>}
                  {g.marketAt
                    ? <> · as of {new Date(g.marketAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                    : <> · <span className="text-amber-300">on file, never checked</span></>}
                  {!g.marketAt && <> <Chip tone="amber">SAMPLE price</Chip></>}
                </p>
              ) : (
                <p className="text-slate-500 text-sm mt-1">No market price yet — tap 💲 Look up price.</p>
              )}
              <div className="mt-2 grid gap-1.5">
                {g.lots.map((l) => {
                  const soldFrom = sales.some((s) => s.lot_id === l.id);
                  return (
                    <div key={l.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-slate-400 text-sm">{l.qty_on_hand} × at {money(Number(l.cost_basis_unit))} cost · <span className="text-slate-200 font-semibold">{ownerLabel(l.owner_kind, Number(l.judah_pct))}</span></p>
                        <span className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditBuyId(editBuyId === l.id ? null : l.id); setAdjustId(null); }}
                            className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-700 text-slate-200">
                            ✏️ Edit buy
                          </button>
                          <button
                            onClick={() => { setAdjustId(adjustId === l.id ? null : l.id); setAdjustQty(1); setAdjustReason("damaged"); setEditBuyId(null); }}
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
                      {editBuyId === l.id && (
                        <EditBuyPanel lot={l} soldFrom={soldFrom} onClose={() => setEditBuyId(null)} onSaved={() => { setEditBuyId(null); setEditMsg("Buy updated \u2713"); }} />
                      )}
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

function EditBuyPanel({ lot, soldFrom, onClose, onSaved }: { lot: Lot; soldFrom: boolean; onClose: () => void; onSaved: () => void }) {
  const { products, purchases, updatePurchase } = useStore();
  const purchase = purchases.find((p) => p.id === lot.purchase_id);
  const product = products.find((p) => p.id === lot.product_id);
  const [name, setName] = useState(product?.name ?? purchase?.product_name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [qty, setQty] = useState(String(purchase?.qty ?? lot.qty_on_hand));
  const [unitPrice, setUnitPrice] = useState(purchase ? String(Number(purchase.unit_price)) : "");
  const [taxRate, setTaxRate] = useState(purchase?.tax_rate != null ? String(Number(purchase.tax_rate)) : "");
  const [shippingIn, setShippingIn] = useState(purchase ? String(Number(purchase.shipping_in)) : "");
  const [ownerKind, setOwnerKind] = useState<OwnerKind>(lot.owner_kind);
  const [splitPct, setSplitPct] = useState(Number(lot.judah_pct) || 50);
  const [paidVia, setPaidVia] = useState<PaidVia>(purchase?.paid_via ?? "Other");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!purchase) return null;
  const cat = barcode.trim() && normalizeBarcode(barcode) !== normalizeBarcode(product?.barcode ?? "") ? catalogLookup(barcode) : undefined;

  async function save() {
    setSaving(true);
    const err = await updatePurchase(lot, {
      name: name.trim(),
      barcode: barcode.trim() ? normalizeBarcode(barcode) : null,
      qty: parseInt(qty) || 0,
      unitPrice: parseFloat(unitPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      shippingIn: parseFloat(shippingIn) || 0,
      ownerKind, judahPct: splitPct, paidVia,
    });
    setSaving(false);
    if (err) setError(err); else onSaved();
  }

  return (
    <div className="mt-2 rounded-xl bg-slate-900 border border-slate-700 p-3">
      <p className="text-slate-200 text-sm font-bold mb-3">Fix this buy — name, UPC, whose it is, how it was paid for, the numbers.</p>
      <Field label="Product name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="UPC / barcode">
        <input className={inputCls} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="The numbers under the barcode" inputMode="numeric" />
      </Field>
      <button onClick={() => setScanning(true)} className="w-full rounded-xl bg-slate-700 text-white py-2.5 font-semibold mb-3 text-sm">📷 Scan the barcode</button>
      {scanning && <BarcodeScanner onCode={(code) => { setBarcode(code); setScanning(false); }} onClose={() => setScanning(false)} />}
      {cat && <p className="text-sky-300 text-sm mb-3">📚 The starter library calls this barcode “{cat.name}”.</p>}
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="How many bought">
            <input className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Price each">
            <MoneyInput value={unitPrice} onChange={setUnitPrice} placeholder="0.00" />
          </Field>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Field label="Tax rate %">
            <input className={inputCls} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" placeholder="0" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Shipping in">
            <MoneyInput value={shippingIn} onChange={setShippingIn} placeholder="0.00" />
          </Field>
        </div>
      </div>
      <p className="text-slate-300 text-sm font-semibold mb-1.5">Whose is it?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([["mine", "\uD83D\uDFE1 Mine"], ["giovanni", "\uD83D\uDD35 Giovanni's"], ["split", "\uD83D\uDFE3 Split"], ["mom_payback", "\uD83D\uDFE6 Mom paid"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setOwnerKind(k)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${ownerKind === k ? "bg-yellow-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{label}</button>
        ))}
      </div>
      {ownerKind === "split" && (
        <Field label={`My share: ${splitPct}%`}>
          <input type="range" min={5} max={95} step={5} value={splitPct} onChange={(e) => setSplitPct(parseInt(e.target.value))} className="w-full accent-yellow-400" />
        </Field>
      )}
      <p className="text-slate-300 text-sm font-semibold mb-1.5">How was it paid for?</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["USAA", "Cash", "Other"] as const).map((v) => (
          <button key={v} onClick={() => setPaidVia(v)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${paidVia === v ? "bg-sky-400 text-slate-900" : "bg-slate-700 text-slate-200"}`}>{v}</button>
        ))}
      </div>
      {soldFrom && <p className="text-amber-300 text-sm mb-3">Heads up: some of these already sold. Those sales keep the numbers they were saved with — this fix changes the buy itself, what's still in stock, and future sales.</p>}
      {error && <p className="text-rose-300 text-sm font-semibold mb-3">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving} onClick={() => void save()} className="flex-1 rounded-xl bg-yellow-400 text-slate-900 py-3 font-black disabled:opacity-50">{saving ? "Saving\u2026" : "\u2713 Save the fix"}</button>
        <button onClick={onClose} className="rounded-xl bg-slate-700 text-white px-5 py-3 font-bold">Cancel</button>
      </div>
    </div>
  );
}
