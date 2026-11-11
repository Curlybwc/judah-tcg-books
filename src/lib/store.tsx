import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { SAMPLE_OWNER_ID } from "./config";
import type { BookMember, BookSet, Expense, ExpenseCategory, GiovanniPayment, Lot, MomPayment, Product, Purchase, Sale, Show } from "./types";
import { blobToDataUrl, compressImageFile } from "./photos";
import { momProfitShare, purchaseMath, quickSaleMath, saleMath, taxFromRate } from "./math";

// ---------- Local fallback seed (mirrors supabase/migrations/202611050003_seed_sample.sql) ----------
const SEED_PRODUCTS: Product[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", owner_id: SAMPLE_OWNER_ID, name: "Scarlet & Violet 151 Elite Trainer Box", barcode: "820650853159", product_type: "sealed", market_price: 84.99 },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", owner_id: SAMPLE_OWNER_ID, name: "Prismatic Evolutions Booster Bundle", barcode: "196214112544", product_type: "sealed", market_price: 54.99 },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", owner_id: SAMPLE_OWNER_ID, name: "Charizard ex Premium Collection", barcode: "196214110076", product_type: "sealed", market_price: 119.99 },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", owner_id: SAMPLE_OWNER_ID, name: "Pikachu VMAX (single)", barcode: null, product_type: "single", market_price: 12.5 },
];
const SEED_PURCHASES: Purchase[] = [
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", owner_id: SAMPLE_OWNER_ID, product_id: SEED_PRODUCTS[0].id, product_name: SEED_PRODUCTS[0].name, qty: 4, unit_price: 55, tax: 18, shipping_in: 12, total_cost: 250, cost_basis_unit: 62.5, owner_kind: "mine", judah_pct: 100, paid_via: "USAA", purchased_on: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", owner_id: SAMPLE_OWNER_ID, product_id: SEED_PRODUCTS[1].id, product_name: SEED_PRODUCTS[1].name, qty: 6, unit_price: 32, tax: 0, shipping_in: 0, total_cost: 192, cost_basis_unit: 32, owner_kind: "split", judah_pct: 50, paid_via: "Cash", purchased_on: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) },
];
const SEED_LOTS: Lot[] = [
  { id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", owner_id: SAMPLE_OWNER_ID, product_id: SEED_PRODUCTS[0].id, purchase_id: SEED_PURCHASES[0].id, qty_on_hand: 4, cost_basis_unit: 62.5, owner_kind: "mine", judah_pct: 100 },
  { id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2", owner_id: SAMPLE_OWNER_ID, product_id: SEED_PRODUCTS[1].id, purchase_id: SEED_PURCHASES[1].id, qty_on_hand: 6, cost_basis_unit: 32, owner_kind: "split", judah_pct: 50 },
];

interface LocalData { products: Product[]; purchases: Purchase[]; lots: Lot[]; sales: Sale[]; payments: GiovanniPayment[]; shows: Show[]; momPayments: MomPayment[]; expenses: Expense[]; }
const LOCAL_KEY = "jtb-local-v1";
function loadLocal(): LocalData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) { const d = JSON.parse(raw) as LocalData; if (!d.shows) d.shows = []; if (!d.momPayments) d.momPayments = []; if (!d.expenses) d.expenses = []; return d; }
  } catch { /* ignore */ }
  return { products: SEED_PRODUCTS, purchases: SEED_PURCHASES, lots: SEED_LOTS, sales: [], payments: [], shows: [], momPayments: [], expenses: [] };
}

// ---------- Offline outbox: writes made with no signal queue here and push later ----------
export type OutboxOp =
  | { kind: "insert"; table: string; row: Record<string, unknown> }
  | { kind: "lotDelta"; lotId: string; delta: number }
  | { kind: "showPatch"; id: string; patch: Record<string, unknown> };
const OUTBOX_KEY = "jtb-outbox-v1";
function loadOutbox(): OutboxOp[] {
  try { const raw = localStorage.getItem(OUTBOX_KEY); if (raw) return JSON.parse(raw) as OutboxOp[]; } catch { /* ignore */ }
  return [];
}
function saveOutbox(ops: OutboxOp[]) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops)); } catch { /* ignore */ } }
function saveLocal(d: LocalData) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
export function uuid(): string {
  return (crypto as Crypto).randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}

interface Store {
  ready: boolean;
  remote: boolean; // true = data is coming from Supabase; false = on-phone fallback
  notice: string | null;
  userEmail: string | null;
  userId: string | null;
  sets: BookSet[];
  members: BookMember[];
  currentSetId: string | null;
  switchSet: (setId: string) => Promise<void>;
  createSet: (name: string) => Promise<string | null>;
  joinSet: (code: string) => Promise<string | null>;
  resetJoinCode: (setId: string) => Promise<string | null>;
  removeMember: (setId: string, userId: string) => Promise<string | null>;
  leaveSet: (setId: string) => Promise<string | null>;
  ownerId: string;
  products: Product[];
  purchases: Purchase[];
  lots: Lot[];
  sales: Sale[];
  payments: GiovanniPayment[];
  shows: Show[];
  momPayments: MomPayment[];
  expenses: Expense[];
  addExpense: (amount: number, spentOn: string, category: ExpenseCategory, note: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setProductImage: (productId: string, url: string) => Promise<void>;
  uploadProductPhoto: (productId: string, file: File) => Promise<boolean>;
  momOwed: number;
  addMomPayment: (amount: number, paidOn: string, note: string) => Promise<void>;
  deleteMomPayment: (id: string) => Promise<void>;
  bulkRemoveLots: (lots: Lot[]) => Promise<number>;
  activeShow: Show | null;
  pendingCount: number;
  syncNow: () => Promise<void>;
  startShow: (name: string, showDate: string, tableFee: number, cashFloat: number) => Promise<Show>;
  closeShow: (show: Show, cashCounted: number | null) => Promise<void>;
  recordQuickSale: (input: { lot: Lot; qty: number; unitPrice: number; channel: "show_cash" | "show_venmo"; showId: string }) => Promise<Sale | null>;
  giovanniOwed: number;
  totalProfit: number;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  addPurchase: (input: { name: string; barcode?: string; qty: number; unitPrice: number; taxRate: number; shippingIn: number; ownerKind: "mine" | "giovanni" | "split" | "mom_payback" | "mom_split"; judahPct: number; paidVia: "USAA" | "Cash" | "Other"; showId?: string }) => Promise<Purchase>;
  recordSales: (rows: { lot: Lot; qty: number; unitItemPrice: number; shippingCharged: number; shippingPaid: number; orderId: string | null; soldOn: string; orderGroupFirst?: boolean }[]) => Promise<Sale[]>;
  addGiovanniPayment: (amount: number, paidOn: string, note: string) => Promise<void>;
  deleteSale: (sale: Sale) => Promise<void>;
  adjustStock: (lot: Lot, qtyRemoved: number, reason: string) => Promise<void>;
  undoPurchaseForLot: (lot: Lot) => Promise<boolean>;
  updatePurchase: (lot: Lot, input: { name: string; barcode: string | null; qty: number; unitPrice: number; taxRate: number; shippingIn: number; ownerKind: "mine" | "giovanni" | "split" | "mom_payback" | "mom_split"; judahPct: number; paidVia: "USAA" | "Cash" | "Other" }) => Promise<string | null>;
  deleteGiovanniPayment: (id: string) => Promise<void>;
  recordBankImport: (filename: string, rowCount: number) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("store not mounted");
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LocalData>({ products: [], purchases: [], lots: [], sales: [], payments: [], shows: [], momPayments: [], expenses: [] });
  const [outbox, setOutbox] = useState<OutboxOp[]>(() => loadOutbox());
  const outboxRef = useRef<OutboxOp[]>(outbox);
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const userRef = useRef<{ id: string; email?: string | null } | null>(null);
  const [sets, setSets] = useState<BookSet[]>([]);
  const setsRef = useRef<BookSet[]>([]);
  useEffect(() => { setsRef.current = sets; }, [sets]);
  const [members, setMembers] = useState<BookMember[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(SAMPLE_OWNER_ID);
  const [ownerId, setOwnerId] = useState<string>(SAMPLE_OWNER_ID);
  const remoteRef = useRef(false);
  const ownerRef = useRef(SAMPLE_OWNER_ID);
  const syncRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async (owner: string) => {
    try {
      const [p, pu, l, s, g, sh, mp, ex] = await Promise.all([
        supabase.from("products").select("*").eq("owner_id", owner),
        supabase.from("purchases").select("*").eq("owner_id", owner).order("purchased_on", { ascending: false }),
        supabase.from("inventory_lots").select("*").eq("owner_id", owner),
        supabase.from("sales").select("*").eq("owner_id", owner).order("sold_on", { ascending: false }),
        supabase.from("giovanni_payments").select("*").eq("owner_id", owner).order("paid_on", { ascending: false }),
        supabase.from("shows").select("*").eq("owner_id", owner).order("show_date", { ascending: false }),
        supabase.from("mom_payments").select("*").eq("owner_id", owner).order("paid_on", { ascending: false }),
        supabase.from("expenses").select("*").eq("owner_id", owner).order("spent_on", { ascending: false }),
      ]);
      if (p.error || pu.error || l.error || s.error || g.error || sh.error || mp.error || ex.error) throw new Error("supabase read failed");
      const d: LocalData = {
        products: (p.data ?? []) as Product[],
        purchases: (pu.data ?? []) as Purchase[],
        lots: (l.data ?? []) as Lot[],
        sales: (s.data ?? []) as Sale[],
        payments: (g.data ?? []) as GiovanniPayment[],
        shows: (sh.data ?? []) as Show[],
        momPayments: (mp.data ?? []) as MomPayment[],
        expenses: (ex.data ?? []) as Expense[],
      };
      setData(d); setRemote(true); remoteRef.current = true;
    } catch {
      setData(loadLocal()); setRemote(false); remoteRef.current = false;
    }
    setReady(true);
  }, []);

  // Resolve who is looking and which set of books they are looking at
  // (DECISIONS #32). Signed out: the demo set. Signed in: the current set
  // from their memberships — owner_id on data rows is a SET id now.
  const boot = useCallback(async (user: { id: string; email?: string | null } | null) => {
    setUserEmail(user?.email ?? null);
    setUserId(user?.id ?? null);
    userRef.current = user;
    if (!user) {
      setSets([]); setMembers([]); setCurrentSetId(SAMPLE_OWNER_ID);
      setOwnerId(SAMPLE_OWNER_ID); ownerRef.current = SAMPLE_OWNER_ID;
      await load(SAMPLE_OWNER_ID);
      return;
    }
    try {
      const mem = await supabase.from("book_members").select("set_id, role").eq("user_id", user.id);
      if (mem.error) throw mem.error;
      const ids = (mem.data ?? []).map((m) => m.set_id as string);
      if (!ids.length) {
        // Signed in but in no set yet: the gate screen offers create/join.
        setSets([]); setMembers([]); setCurrentSetId(null);
        setOwnerId(""); ownerRef.current = "";
        setData({ products: [], purchases: [], lots: [], sales: [], payments: [], shows: [], momPayments: [], expenses: [] });
        setRemote(true); remoteRef.current = true; setReady(true);
        return;
      }
      const [bs, all] = await Promise.all([
        supabase.from("book_sets").select("*").in("id", ids),
        supabase.from("book_members").select("*").in("set_id", ids),
      ]);
      if (bs.error) throw bs.error;
      const list = (bs.data ?? []) as BookSet[];
      setSets(list); setMembers((all.data ?? []) as BookMember[]);
      const saved = localStorage.getItem("jtb-current-set");
      const pick = list.find((s) => s.id === saved) ?? list[0];
      setCurrentSetId(pick.id); setOwnerId(pick.id); ownerRef.current = pick.id;
      await load(pick.id);
    } catch {
      // Sets list unreachable: fall back to the pre-sets behavior for this user.
      setSets([]); setMembers([]); setCurrentSetId(null);
      setOwnerId(user.id); ownerRef.current = user.id;
      await load(user.id);
    }
  }, [load]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      await boot(sess.session?.user ?? null);
      if (outboxRef.current.length) void syncRef.current(); // push anything queued while offline
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      void boot(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [boot]);

  const switchSet: Store["switchSet"] = useCallback(async (setId) => {
    localStorage.setItem("jtb-current-set", setId);
    setCurrentSetId(setId); setOwnerId(setId); ownerRef.current = setId;
    await load(setId);
  }, [load]);

  const createSet: Store["createSet"] = useCallback(async (name) => {
    const user = userRef.current;
    if (!user) return "Sign in first.";
    if (name.trim().length < 2) return "Give the set of books a name.";
    const ins = await supabase.from("book_sets").insert({ name: name.trim(), owner_user_id: user.id }).select("*").single();
    if (ins.error) return ins.error.message;
    const set = ins.data as BookSet;
    const memIns = await supabase.from("book_members").insert({ set_id: set.id, user_id: user.id, email: user.email ?? null, role: "owner" });
    if (memIns.error) return memIns.error.message;
    localStorage.setItem("jtb-current-set", set.id);
    await boot(user);
    return null;
  }, [boot]);

  const joinSet: Store["joinSet"] = useCallback(async (code) => {
    const user = userRef.current;
    if (!user) return "Sign in first.";
    const r = await supabase.rpc("join_book_set", { p_code: code });
    if (r.error) return r.error.message;
    const row = (r.data as { joined_set_id: string }[] | null)?.[0];
    if (row) localStorage.setItem("jtb-current-set", row.joined_set_id);
    await boot(user);
    return null;
  }, [boot]);

  const resetJoinCode: Store["resetJoinCode"] = useCallback(async (setId) => {
    const r = await supabase.rpc("reset_join_code", { p_set: setId });
    if (r.error) return r.error.message;
    if (userRef.current) await boot(userRef.current);
    return null;
  }, [boot]);

  const removeMember: Store["removeMember"] = useCallback(async (setId, memberUserId) => {
    const d = await supabase.from("book_members").delete().eq("set_id", setId).eq("user_id", memberUserId);
    if (d.error) return d.error.message;
    if (userRef.current) await boot(userRef.current);
    return null;
  }, [boot]);

  const leaveSet: Store["leaveSet"] = useCallback(async (setId) => {
    const user = userRef.current;
    if (!user) return "Sign in first.";
    const d = await supabase.from("book_members").delete().eq("set_id", setId).eq("user_id", user.id);
    if (d.error) return d.error.message;
    localStorage.removeItem("jtb-current-set");
    await boot(user);
    return null;
  }, [boot]);

  const applyLocal = useCallback((fn: (d: LocalData) => LocalData) => {
    setData((prev) => { const next = fn(prev); if (!remoteRef.current) saveLocal(next); return next; });
  }, []);

  const enqueue = useCallback((ops: OutboxOp[]) => {
    if (!ops.length) return;
    const next = [...outboxRef.current, ...ops];
    outboxRef.current = next; setOutbox(next); saveOutbox(next);
  }, []);

  // Execute outbox ops against Supabase. Returns the ops that still failed.
  // An insert that hits a primary-key conflict (23505) counts as already applied —
  // client-generated UUIDs make retries safe.
  const runOps = useCallback(async (ops: OutboxOp[]): Promise<OutboxOp[]> => {
    const failed: OutboxOp[] = [];
    for (const op of ops) {
      try {
        if (op.kind === "insert") {
          // A queued row still names the set it was written in. If that set is
          // gone (deleted, or the demo books before sign-in), the row can never
          // land — re-point it at the set that's open now (DECISIONS #33).
          let row = op.row as Record<string, unknown>;
          const oid = row?.owner_id;
          if (typeof oid === "string" && oid !== ownerRef.current
            && setsRef.current.some((x) => x.id === ownerRef.current)
            && !setsRef.current.some((x) => x.id === oid)) {
            row = { ...row, owner_id: ownerRef.current };
          }
          const r = await supabase.from(op.table).insert(row as never);
          if (r.error && r.error.code !== "23505") throw r.error;
        } else if (op.kind === "lotDelta") {
          const cur = await supabase.from("inventory_lots").select("qty_on_hand").eq("id", op.lotId).single();
          if (cur.error) throw cur.error;
          const u = await supabase.from("inventory_lots").update({ qty_on_hand: Math.max(0, (cur.data?.qty_on_hand ?? 0) + op.delta) }).eq("id", op.lotId);
          if (u.error) throw u.error;
        } else if (op.kind === "showPatch") {
          const u = await supabase.from("shows").update(op.patch as never).eq("id", op.id);
          if (u.error) throw u.error;
        }
      } catch { failed.push(op); }
    }
    return failed;
  }, []);

  // Try ops now if we're online; queue whatever fails.
  const commit = useCallback(async (ops: OutboxOp[]) => {
    if (!remoteRef.current) { enqueue(ops); return; }
    const failed = await runOps(ops);
    if (failed.length) { enqueue(failed); setNotice("Saved on this phone — it will sync when you're back online. ☁️"); }
  }, [enqueue, runOps]);

  const syncNow = useCallback(async () => {
    const ops = outboxRef.current;
    if (!ops.length) return;
    const failed = await runOps(ops);
    outboxRef.current = failed; setOutbox(failed); saveOutbox(failed);
    if (!failed.length) { setNotice("All caught up — everything is synced to the cloud. ✓"); await load(ownerRef.current); }
    else setNotice(`${failed.length} item${failed.length === 1 ? "" : "s"} still waiting to sync — check your signal and tap sync again.`);
  }, [runOps, load]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    return error ? error.message : null;
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const addPurchase: Store["addPurchase"] = useCallback(async (input) => {
    const owner = ownerRef.current;
    const tax = taxFromRate(input.qty * input.unitPrice, input.taxRate);
    const { totalCost, costBasisUnit } = purchaseMath(input.qty, input.unitPrice, tax, input.shippingIn);
    let product = data.products.find((x) => x.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    const purchase: Purchase = {
      id: uuid(), owner_id: owner, product_id: product?.id ?? null, product_name: input.name,
      qty: input.qty, unit_price: input.unitPrice, tax, tax_rate: input.taxRate > 0 ? input.taxRate : null, shipping_in: input.shippingIn,
      total_cost: totalCost, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind,
      judah_pct: input.ownerKind === "mine" || input.ownerKind === "mom_payback" || input.ownerKind === "mom_split" ? 100 : input.ownerKind === "giovanni" ? 0 : input.judahPct,
      paid_via: input.paidVia, purchased_on: new Date().toISOString().slice(0, 10),
      show_id: input.showId ?? null,
    };
    const newProduct: Product | null = product ? null : { id: uuid(), owner_id: owner, name: input.name, barcode: input.barcode ?? null, product_type: "sealed", market_price: null };
    if (newProduct) purchase.product_id = newProduct.id;
    product = product ?? (newProduct as Product);
    const lot: Lot = { id: uuid(), owner_id: owner, product_id: product.id, purchase_id: purchase.id, qty_on_hand: input.qty, cost_basis_unit: costBasisUnit, owner_kind: purchase.owner_kind, judah_pct: purchase.judah_pct };
    const ops: OutboxOp[] = [];
    if (newProduct) ops.push({ kind: "insert", table: "products", row: { ...newProduct } as unknown as Record<string, unknown> });
    ops.push({ kind: "insert", table: "purchases", row: { ...purchase } as unknown as Record<string, unknown> });
    ops.push({ kind: "insert", table: "inventory_lots", row: { ...lot } as unknown as Record<string, unknown> });
    await commit(ops);
    applyLocal((d) => ({
      ...d,
      products: newProduct ? [...d.products, newProduct] : d.products,
      purchases: [purchase, ...d.purchases],
      lots: [...d.lots, lot],
    }));
    return purchase;
  }, [data.products, applyLocal, commit]);

  // Edit a buy after the fact (Jen, 2026-11-10): fix the product name or UPC,
  // who it belongs to, how it was paid for, and the money numbers. Sales
  // already recorded keep the numbers they were saved with (history is not
  // rewritten); the edit changes the purchase, the lot's remaining stock, and
  // every future sale. Quantity can never drop below what already left this
  // lot (sold + adjusted out).
  const updatePurchase: Store["updatePurchase"] = useCallback(async (lot, input) => {
    const purchase = data.purchases.find((p) => p.id === lot.purchase_id);
    if (!purchase) return "Couldn't find that buy to edit.";
    const consumed = purchase.qty - lot.qty_on_hand;
    if (input.qty < 1) return "How many bought has to be at least 1.";
    if (input.qty < consumed) return `${consumed} of these already sold or left stock, so the buy can't be smaller than ${consumed}.`;
    if (!(input.unitPrice > 0)) return "Price each has to be more than zero.";
    if (input.name.trim().length < 2) return "The product needs a name.";
    const tax = taxFromRate(input.qty * input.unitPrice, input.taxRate);
    const { totalCost, costBasisUnit } = purchaseMath(input.qty, input.unitPrice, tax, input.shippingIn);
    const judahPct = input.ownerKind === "mine" || input.ownerKind === "mom_payback" || input.ownerKind === "mom_split" ? 100 : input.ownerKind === "giovanni" ? 0 : input.judahPct;
    const taxRate = input.taxRate > 0 ? input.taxRate : null;
    const newOnHand = lot.qty_on_hand + (input.qty - purchase.qty);
    if (remoteRef.current) {
      try {
        if (lot.product_id) { const r = await supabase.from("products").update({ name: input.name.trim(), barcode: input.barcode }).eq("id", lot.product_id); if (r.error) throw r.error; }
        const r2 = await supabase.from("purchases").update({ product_name: input.name.trim(), qty: input.qty, unit_price: input.unitPrice, tax, tax_rate: taxRate, shipping_in: input.shippingIn, total_cost: totalCost, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind, judah_pct: judahPct, paid_via: input.paidVia }).eq("id", purchase.id); if (r2.error) throw r2.error;
        const r3 = await supabase.from("inventory_lots").update({ qty_on_hand: newOnHand, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind, judah_pct: judahPct }).eq("id", lot.id); if (r3.error) throw r3.error;
      } catch { return "Couldn't save that in the cloud \u2014 check your connection and try again."; }
    }
    applyLocal((d) => ({
      ...d,
      products: d.products.map((p) => (p.id === lot.product_id ? { ...p, name: input.name.trim(), barcode: input.barcode } : p)),
      purchases: d.purchases.map((p) => (p.id === purchase.id ? { ...p, product_name: input.name.trim(), qty: input.qty, unit_price: input.unitPrice, tax, tax_rate: taxRate, shipping_in: input.shippingIn, total_cost: totalCost, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind, judah_pct: judahPct, paid_via: input.paidVia } : p)),
      lots: d.lots.map((l) => (l.id === lot.id ? { ...l, qty_on_hand: newOnHand, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind, judah_pct: judahPct } : l)),
    }));
    return null;
  }, [data.purchases, applyLocal]);

  const recordSales: Store["recordSales"] = useCallback(async (rows) => {
    const owner = ownerRef.current;
    const out: Sale[] = [];
    for (const row of rows) {
      if (row.qty > row.lot.qty_on_hand) continue; // stock guard: never sell more than on hand
      const m = saleMath({ qty: row.qty, unitItemPrice: row.unitItemPrice, shippingCharged: row.shippingCharged, shippingPaid: row.shippingPaid, costBasisUnit: row.lot.cost_basis_unit, judahPct: row.lot.judah_pct });
      if (row.orderGroupFirst === false) { // $0.30 transaction flat is per ORDER, not per row
        m.transactionFee = Math.round((m.transactionFee - 0.3) * 100) / 100;
        m.fees = Math.round((m.fees - 0.3) * 100) / 100;
        m.netProceeds = Math.round((m.netProceeds + 0.3) * 100) / 100;
        m.profit = Math.round((m.profit + 0.3) * 100) / 100;
        m.judahShare = Math.round(m.netProceeds * (row.lot.judah_pct / 100) * 100) / 100;
      }
      // Mom-paid lots (Jen's formula): the buy already put the full cost on the
      // owed-to-Mom ledger; the sale adds her 50% of its actual profit. Judah's
      // share of the proceeds stays whole — Giovanni owes him everything he
      // collected, and the Mom ledger settles out of that.
      let momShare = 0;
      if (row.lot.owner_kind === "mom_payback" || row.lot.owner_kind === "mom_split") {
        momShare = momProfitShare(m.profit);
        m.judahShare = m.netProceeds;
      }
      const product = data.products.find((x) => x.id === row.lot.product_id);
      const sale: Sale = {
        id: uuid(), owner_id: owner, product_id: row.lot.product_id, lot_id: row.lot.id,
        product_name: product?.name ?? "Product", qty: row.qty, item_price: Math.round(row.unitItemPrice * row.qty * 100) / 100,
        shipping_charged: row.shippingCharged, shipping_paid: row.shippingPaid, commission: m.commission,
        transaction_fee: m.transactionFee, fees: m.fees, net_proceeds: m.netProceeds,
        cost_basis_total: m.costBasisTotal, profit: m.profit, judah_share: m.judahShare, mom_share: momShare,
        order_id: row.orderId, sold_on: row.soldOn,
      };
      out.push(sale);
      if (remoteRef.current) {
        try {
          const r = await supabase.from("sales").insert(sale); if (r.error) throw r.error;
          const u = await supabase.from("inventory_lots").update({ qty_on_hand: row.lot.qty_on_hand - row.qty }).eq("id", row.lot.id); if (u.error) throw u.error;
        } catch { setNotice("Saved on this phone only — couldn't reach the cloud."); }
      }
    }
    applyLocal((d) => {
      const lots = d.lots.map((l) => {
        const used = rows.filter((r) => r.lot.id === l.id).reduce((sum, r) => sum + r.qty, 0);
        return used ? { ...l, qty_on_hand: l.qty_on_hand - used } : l;
      });
      return { ...d, sales: [...out, ...d.sales], lots };
    });
    return out;
  }, [data.products, applyLocal]);

  const addGiovanniPayment: Store["addGiovanniPayment"] = useCallback(async (amount, paidOn, note) => {
    const payment: GiovanniPayment = { id: uuid(), owner_id: ownerRef.current, amount, paid_on: paidOn, note: note || null };
    if (remoteRef.current) {
      try { const r = await supabase.from("giovanni_payments").insert(payment); if (r.error) throw r.error; }
      catch { setNotice("Saved on this phone only — couldn't reach the cloud."); }
    }
    applyLocal((d) => ({ ...d, payments: [payment, ...d.payments] }));
  }, [applyLocal]);

  const deleteSale: Store["deleteSale"] = useCallback(async (sale) => {
    if (remoteRef.current) {
      try {
        const d = await supabase.from("sales").delete().eq("id", sale.id); if (d.error) throw d.error;
        if (sale.lot_id) {
          const lot = data.lots.find((l) => l.id === sale.lot_id);
          if (lot) { const u = await supabase.from("inventory_lots").update({ qty_on_hand: lot.qty_on_hand + sale.qty }).eq("id", lot.id); if (u.error) throw u.error; }
        }
      } catch { setNotice("Couldn't undo that in the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({
      ...d,
      sales: d.sales.filter((s) => s.id !== sale.id),
      lots: sale.lot_id ? d.lots.map((l) => (l.id === sale.lot_id ? { ...l, qty_on_hand: l.qty_on_hand + sale.qty } : l)) : d.lots,
    }));
  }, [data.lots, applyLocal]);

  const undoPurchaseForLot: Store["undoPurchaseForLot"] = useCallback(async (lot) => {
    if (data.sales.some((s) => s.lot_id === lot.id)) return false; // already sold from — can't undo the buy
    if (remoteRef.current) {
      try {
        const d1 = await supabase.from("inventory_lots").delete().eq("id", lot.id); if (d1.error) throw d1.error;
        if (lot.purchase_id) { const d2 = await supabase.from("purchases").delete().eq("id", lot.purchase_id); if (d2.error) throw d2.error; }
      } catch { setNotice("Couldn't undo that in the cloud — check your connection and try again."); return false; }
    }
    applyLocal((d) => ({
      ...d,
      lots: d.lots.filter((l) => l.id !== lot.id),
      purchases: lot.purchase_id ? d.purchases.filter((p) => p.id !== lot.purchase_id) : d.purchases,
    }));
    return true;
  }, [data.sales, applyLocal]);

  const deleteGiovanniPayment: Store["deleteGiovanniPayment"] = useCallback(async (id) => {
    if (remoteRef.current) {
      try { const d = await supabase.from("giovanni_payments").delete().eq("id", id); if (d.error) throw d.error; }
      catch { setNotice("Couldn't delete that in the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }));
  }, [applyLocal]);

  const addMomPayment: Store["addMomPayment"] = useCallback(async (amount, paidOn, note) => {
    const payment: MomPayment = { id: uuid(), owner_id: ownerRef.current, amount, paid_on: paidOn, note: note || null };
    if (remoteRef.current) {
      try { const r = await supabase.from("mom_payments").insert(payment); if (r.error) throw r.error; }
      catch { setNotice("Saved on this phone only — couldn't reach the cloud."); }
    }
    applyLocal((d) => ({ ...d, momPayments: [payment, ...d.momPayments] }));
  }, [applyLocal]);

  const deleteMomPayment: Store["deleteMomPayment"] = useCallback(async (id) => {
    if (remoteRef.current) {
      try { const d = await supabase.from("mom_payments").delete().eq("id", id); if (d.error) throw d.error; }
      catch { setNotice("Couldn't delete that in the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({ ...d, momPayments: d.momPayments.filter((p) => p.id !== id) }));
  }, [applyLocal]);


  const addExpense: Store["addExpense"] = useCallback(async (amount, spentOn, category, note) => {
    const expense: Expense = { id: uuid(), owner_id: ownerRef.current, amount, spent_on: spentOn, category, note };
    if (remoteRef.current) {
      try { const r = await supabase.from("expenses").insert(expense); if (r.error) throw r.error; }
      catch { setNotice("Saved on this phone only — couldn't reach the cloud."); }
    }
    applyLocal((d) => ({ ...d, expenses: [expense, ...d.expenses] }));
  }, [applyLocal]);

  const deleteExpense: Store["deleteExpense"] = useCallback(async (id) => {
    if (remoteRef.current) {
      try { const d = await supabase.from("expenses").delete().eq("id", id); if (d.error) throw d.error; }
      catch { setNotice("Couldn't delete that in the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
  }, [applyLocal]);

  const setProductImage: Store["setProductImage"] = useCallback(async (productId, url) => {
    if (remoteRef.current) {
      try { const u = await supabase.from("products").update({ image_url: url }).eq("id", productId); if (u.error) throw u.error; }
      catch { setNotice("Couldn't save that photo to the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({ ...d, products: d.products.map((p) => (p.id === productId ? { ...p, image_url: url } : p)) }));
  }, [applyLocal]);

  // Photo pipeline: shrink the picture, then either upload it to the
  // product-photos bucket (cloud mode) or keep it as a small data URL (on-phone mode).
  const uploadProductPhoto: Store["uploadProductPhoto"] = useCallback(async (productId, file) => {
    try {
      const blob = await compressImageFile(file);
      let url: string;
      if (remoteRef.current) {
        const path = `${ownerRef.current}/${productId}-${Date.now()}.jpg`;
        const up = await supabase.storage.from("product-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        url = supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
      } else {
        url = await blobToDataUrl(blob);
      }
      await setProductImage(productId, url);
      return true;
    } catch { setNotice("That photo didn't save — try again."); return false; }
  }, [setProductImage]);

  // Bulk edit (Jen, 2026-11-06): remove whole stock rows that were never sold from.
  // Rows with sales keep their history — those come back as skipped so the UI can say why.
  const bulkRemoveLots: Store["bulkRemoveLots"] = useCallback(async (targets) => {
    const removable = targets.filter((l) => !data.sales.some((s) => s.lot_id === l.id));
    if (remoteRef.current) {
      for (const lot of removable) {
        try {
          const d1 = await supabase.from("inventory_lots").delete().eq("id", lot.id); if (d1.error) throw d1.error;
          if (lot.purchase_id) { const d2 = await supabase.from("purchases").delete().eq("id", lot.purchase_id); if (d2.error) throw d2.error; }
        } catch { setNotice("Some rows couldn't be removed from the cloud — check your connection and try again."); return 0; }
      }
    }
    const ids = new Set(removable.map((l) => l.id));
    const purchaseIds = new Set(removable.map((l) => l.purchase_id).filter(Boolean));
    applyLocal((d) => {
      const lots = d.lots.filter((l) => !ids.has(l.id));
      const purchases = d.purchases.filter((p) => !purchaseIds.has(p.id));
      // A product with no lots and no purchases left is just a name — drop it too.
      const products = d.products.filter((p) => lots.some((l) => l.product_id === p.id) || purchases.some((pu) => pu.product_id === p.id) || d.sales.some((s) => s.product_id === p.id));
      return { ...d, lots, purchases, products };
    });
    return removable.length;
  }, [data.sales, applyLocal]);

  const adjustStock: Store["adjustStock"] = useCallback(async (lot, qtyRemoved, reason) => {
    const qty = Math.min(Math.max(0, qtyRemoved), lot.qty_on_hand);
    if (qty <= 0) return;
    const product = data.products.find((p) => p.id === lot.product_id);
    if (remoteRef.current) {
      try {
        const r = await supabase.from("stock_adjustments").insert({ owner_id: ownerRef.current, lot_id: lot.id, product_name: product?.name ?? "Product", qty_removed: qty, reason });
        if (r.error) throw r.error;
        const u = await supabase.from("inventory_lots").update({ qty_on_hand: lot.qty_on_hand - qty }).eq("id", lot.id);
        if (u.error) throw u.error;
      } catch { setNotice("Couldn't save that adjustment in the cloud — check your connection and try again."); return; }
    }
    applyLocal((d) => ({ ...d, lots: d.lots.map((l) => (l.id === lot.id ? { ...l, qty_on_hand: l.qty_on_hand - qty } : l)) }));
  }, [data.products, applyLocal]);

  const startShow: Store["startShow"] = useCallback(async (name, showDate, tableFee, cashFloat) => {
    const show: Show = { id: uuid(), owner_id: ownerRef.current, name, show_date: showDate, table_fee: tableFee, cash_float: cashFloat, cash_counted: null, status: "open" };
    await commit([{ kind: "insert", table: "shows", row: { ...show } as unknown as Record<string, unknown> }]);
    applyLocal((d) => ({ ...d, shows: [show, ...d.shows] }));
    return show;
  }, [applyLocal, commit]);

  const closeShow: Store["closeShow"] = useCallback(async (show, cashCounted) => {
    await commit([{ kind: "showPatch", id: show.id, patch: { status: "closed", cash_counted: cashCounted } }]);
    applyLocal((d) => ({ ...d, shows: d.shows.map((s) => (s.id === show.id ? { ...s, status: "closed" as const, cash_counted: cashCounted } : s)) }));
  }, [applyLocal, commit]);

  const recordQuickSale: Store["recordQuickSale"] = useCallback(async (input) => {
    if (input.qty > input.lot.qty_on_hand || input.qty <= 0) return null; // stock guard
    const m = quickSaleMath({ qty: input.qty, unitPrice: input.unitPrice, costBasisUnit: input.lot.cost_basis_unit, judahPct: input.lot.judah_pct });
    let judahShare = m.judahShare;
    let momShare = 0;
    if (input.lot.owner_kind === "mom_payback" || input.lot.owner_kind === "mom_split") {
      momShare = momProfitShare(m.profit);
      judahShare = m.gross;
    }
    const product = data.products.find((x) => x.id === input.lot.product_id);
    const sale: Sale = {
      id: uuid(), owner_id: ownerRef.current, product_id: input.lot.product_id, lot_id: input.lot.id,
      product_name: product?.name ?? "Product", qty: input.qty, item_price: m.gross,
      shipping_charged: 0, shipping_paid: 0, commission: 0, transaction_fee: 0, fees: 0,
      net_proceeds: m.gross, cost_basis_total: m.costBasisTotal, profit: m.profit, judah_share: judahShare, mom_share: momShare,
      order_id: null, sold_on: new Date().toISOString().slice(0, 10), show_id: input.showId, channel: input.channel,
    };
    await commit([
      { kind: "insert", table: "sales", row: { ...sale } as unknown as Record<string, unknown> },
      { kind: "lotDelta", lotId: input.lot.id, delta: -input.qty },
    ]);
    applyLocal((d) => ({
      ...d,
      sales: [sale, ...d.sales],
      lots: d.lots.map((l) => (l.id === input.lot.id ? { ...l, qty_on_hand: l.qty_on_hand - input.qty } : l)),
    }));
    return sale;
  }, [data.products, applyLocal, commit]);

  const recordBankImport: Store["recordBankImport"] = useCallback(async (filename, rowCount) => {
    if (remoteRef.current) {
      try { await supabase.from("bank_imports").insert({ owner_id: ownerRef.current, filename, row_count: rowCount, status: "stub" }); } catch { /* stub — ignore */ }
    }
  }, []);

  syncRef.current = syncNow;

  const activeShow = useMemo(() => data.shows.find((s) => s.status === "open") ?? null, [data.shows]);

  // Owed to Mom = every Mom-paid buy at full cost (her money out) + her 50% of
  // each sale's actual profit − repayments Judah has logged. (Jen's formula.)
  const momOwed = useMemo(() => {
    const payback = data.purchases.filter((p) => p.owner_kind === "mom_payback" || p.owner_kind === "mom_split").reduce((s, p) => s + Number(p.total_cost), 0);
    const shares = data.sales.reduce((s, x) => s + Number(x.mom_share ?? 0), 0);
    const repaid = data.momPayments.reduce((s, p) => s + Number(p.amount), 0);
    return Math.round((payback + shares - repaid) * 100) / 100;
  }, [data.purchases, data.sales, data.momPayments]);

  const giovanniOwed = useMemo(() => {
    // Giovanni's balance is a TCGplayer-only number: he collects those payouts.
    // Show sales are cash/Venmo in Judah's own hand, so they never enter it.
    const share = data.sales.filter((x) => !x.channel || x.channel === "tcgplayer").reduce((s, x) => s + Number(x.judah_share), 0);
    const paid = data.payments.reduce((s, x) => s + Number(x.amount), 0);
    return Math.round((share - paid) * 100) / 100;
  }, [data.sales, data.payments]);

  // All-time profit across every sale (TCGplayer + shows) — the Home hero
  // number since Jen's 2026-11-07 ruling. Same sum as Profit's "all time".
  const totalProfit = useMemo(() => Math.round(data.sales.reduce((s, x) => s + Number(x.profit), 0) * 100) / 100, [data.sales]);

  const value: Store = {
    ready, remote, notice, userEmail, userId, sets, members, currentSetId, switchSet, createSet, joinSet, resetJoinCode, removeMember, leaveSet, ownerId,
    products: data.products, purchases: data.purchases, lots: data.lots, sales: data.sales, payments: data.payments,
    shows: data.shows, activeShow, pendingCount: outbox.length, syncNow, startShow, closeShow, recordQuickSale,
    momPayments: data.momPayments, expenses: data.expenses, addExpense, deleteExpense, setProductImage, uploadProductPhoto, momOwed, addMomPayment, deleteMomPayment, bulkRemoveLots,
    giovanniOwed, totalProfit, signIn, signInWithGoogle, signOut, addPurchase, updatePurchase, recordSales, addGiovanniPayment, deleteSale, adjustStock, undoPurchaseForLot, deleteGiovanniPayment, recordBankImport,
    reload: () => load(ownerRef.current),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
