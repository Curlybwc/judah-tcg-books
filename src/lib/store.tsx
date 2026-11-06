import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { SAMPLE_OWNER_ID } from "./config";
import type { GiovanniPayment, Lot, Product, Purchase, Sale } from "./types";
import { purchaseMath, saleMath } from "./math";

// ---------- Local fallback seed (mirrors supabase/migrations/202611050003_seed_sample.sql) ----------
const SEED_PRODUCTS: Product[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", owner_id: SAMPLE_OWNER_ID, name: "Scarlet & Violet 151 Elite Trainer Box", barcode: "196214123922", product_type: "sealed", market_price: 84.99 },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", owner_id: SAMPLE_OWNER_ID, name: "Prismatic Evolutions Booster Bundle", barcode: "196214123953", product_type: "sealed", market_price: 54.99 },
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

interface LocalData { products: Product[]; purchases: Purchase[]; lots: Lot[]; sales: Sale[]; payments: GiovanniPayment[]; }
const LOCAL_KEY = "jtb-local-v1";
function loadLocal(): LocalData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalData;
  } catch { /* ignore */ }
  return { products: SEED_PRODUCTS, purchases: SEED_PURCHASES, lots: SEED_LOTS, sales: [], payments: [] };
}
function saveLocal(d: LocalData) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
export function uuid(): string {
  return (crypto as Crypto).randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}

interface Store {
  ready: boolean;
  remote: boolean; // true = data is coming from Supabase; false = on-phone fallback
  notice: string | null;
  userEmail: string | null;
  ownerId: string;
  products: Product[];
  purchases: Purchase[];
  lots: Lot[];
  sales: Sale[];
  payments: GiovanniPayment[];
  giovanniOwed: number;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  addPurchase: (input: { name: string; barcode?: string; qty: number; unitPrice: number; tax: number; shippingIn: number; ownerKind: "mine" | "giovanni" | "split"; judahPct: number; paidVia: "USAA" | "Cash" | "Other" }) => Promise<Purchase>;
  recordSales: (rows: { lot: Lot; qty: number; unitItemPrice: number; shippingCharged: number; shippingPaid: number; orderId: string | null; soldOn: string; orderGroupFirst?: boolean }[]) => Promise<Sale[]>;
  addGiovanniPayment: (amount: number, paidOn: string, note: string) => Promise<void>;
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
  const [data, setData] = useState<LocalData>({ products: [], purchases: [], lots: [], sales: [], payments: [] });
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string>(SAMPLE_OWNER_ID);
  const remoteRef = useRef(false);
  const ownerRef = useRef(SAMPLE_OWNER_ID);

  const load = useCallback(async (owner: string) => {
    try {
      const [p, pu, l, s, g] = await Promise.all([
        supabase.from("products").select("*").eq("owner_id", owner),
        supabase.from("purchases").select("*").eq("owner_id", owner).order("purchased_on", { ascending: false }),
        supabase.from("inventory_lots").select("*").eq("owner_id", owner),
        supabase.from("sales").select("*").eq("owner_id", owner).order("sold_on", { ascending: false }),
        supabase.from("giovanni_payments").select("*").eq("owner_id", owner).order("paid_on", { ascending: false }),
      ]);
      if (p.error || pu.error || l.error || s.error || g.error) throw new Error("supabase read failed");
      const d: LocalData = {
        products: (p.data ?? []) as Product[],
        purchases: (pu.data ?? []) as Purchase[],
        lots: (l.data ?? []) as Lot[],
        sales: (s.data ?? []) as Sale[],
        payments: (g.data ?? []) as GiovanniPayment[],
      };
      setData(d); setRemote(true); remoteRef.current = true;
    } catch {
      setData(loadLocal()); setRemote(false); remoteRef.current = false;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (user) { setUserEmail(user.email ?? null); setOwnerId(user.id); ownerRef.current = user.id; await load(user.id); }
      else await load(SAMPLE_OWNER_ID);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user;
      setUserEmail(user?.email ?? null);
      const oid = user?.id ?? SAMPLE_OWNER_ID;
      setOwnerId(oid); ownerRef.current = oid;
      void load(oid);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const applyLocal = useCallback((fn: (d: LocalData) => LocalData) => {
    setData((prev) => { const next = fn(prev); if (!remoteRef.current) saveLocal(next); return next; });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const addPurchase: Store["addPurchase"] = useCallback(async (input) => {
    const owner = ownerRef.current;
    const { totalCost, costBasisUnit } = purchaseMath(input.qty, input.unitPrice, input.tax, input.shippingIn);
    let product = data.products.find((x) => x.name.trim().toLowerCase() === input.name.trim().toLowerCase());
    const purchase: Purchase = {
      id: uuid(), owner_id: owner, product_id: product?.id ?? null, product_name: input.name,
      qty: input.qty, unit_price: input.unitPrice, tax: input.tax, shipping_in: input.shippingIn,
      total_cost: totalCost, cost_basis_unit: costBasisUnit, owner_kind: input.ownerKind,
      judah_pct: input.ownerKind === "mine" ? 100 : input.ownerKind === "giovanni" ? 0 : input.judahPct,
      paid_via: input.paidVia, purchased_on: new Date().toISOString().slice(0, 10),
    };
    const newProduct: Product | null = product ? null : { id: uuid(), owner_id: owner, name: input.name, barcode: input.barcode ?? null, product_type: "sealed", market_price: null };
    if (newProduct) purchase.product_id = newProduct.id;
    product = product ?? (newProduct as Product);
    const lot: Lot = { id: uuid(), owner_id: owner, product_id: product.id, purchase_id: purchase.id, qty_on_hand: input.qty, cost_basis_unit: costBasisUnit, owner_kind: purchase.owner_kind, judah_pct: purchase.judah_pct };
    if (remoteRef.current) {
      try {
        if (newProduct) { const r = await supabase.from("products").insert(newProduct); if (r.error) throw r.error; }
        const r1 = await supabase.from("purchases").insert({ ...purchase }); if (r1.error) throw r1.error;
        const r2 = await supabase.from("inventory_lots").insert(lot); if (r2.error) throw r2.error;
      } catch { setNotice("Saved on this phone only — couldn't reach the cloud."); }
    }
    applyLocal((d) => ({
      ...d,
      products: newProduct ? [...d.products, newProduct] : d.products,
      purchases: [purchase, ...d.purchases],
      lots: [...d.lots, lot],
    }));
    return purchase;
  }, [data.products, applyLocal]);

  const recordSales: Store["recordSales"] = useCallback(async (rows) => {
    const owner = ownerRef.current;
    const out: Sale[] = [];
    for (const row of rows) {
      const m = saleMath({ qty: row.qty, unitItemPrice: row.unitItemPrice, shippingCharged: row.shippingCharged, shippingPaid: row.shippingPaid, costBasisUnit: row.lot.cost_basis_unit, judahPct: row.lot.judah_pct });
      if (row.orderGroupFirst === false) { // $0.30 transaction flat is per ORDER, not per row
        m.transactionFee = Math.round((m.transactionFee - 0.3) * 100) / 100;
        m.fees = Math.round((m.fees - 0.3) * 100) / 100;
        m.netProceeds = Math.round((m.netProceeds + 0.3) * 100) / 100;
        m.profit = Math.round((m.profit + 0.3) * 100) / 100;
        m.judahShare = Math.round(m.netProceeds * (row.lot.judah_pct / 100) * 100) / 100;
      }
      const product = data.products.find((x) => x.id === row.lot.product_id);
      const sale: Sale = {
        id: uuid(), owner_id: owner, product_id: row.lot.product_id, lot_id: row.lot.id,
        product_name: product?.name ?? "Product", qty: row.qty, item_price: Math.round(row.unitItemPrice * row.qty * 100) / 100,
        shipping_charged: row.shippingCharged, shipping_paid: row.shippingPaid, commission: m.commission,
        transaction_fee: m.transactionFee, fees: m.fees, net_proceeds: m.netProceeds,
        cost_basis_total: m.costBasisTotal, profit: m.profit, judah_share: m.judahShare,
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

  const recordBankImport: Store["recordBankImport"] = useCallback(async (filename, rowCount) => {
    if (remoteRef.current) {
      try { await supabase.from("bank_imports").insert({ owner_id: ownerRef.current, filename, row_count: rowCount, status: "stub" }); } catch { /* stub — ignore */ }
    }
  }, []);

  const giovanniOwed = useMemo(() => {
    const share = data.sales.reduce((s, x) => s + Number(x.judah_share), 0);
    const paid = data.payments.reduce((s, x) => s + Number(x.amount), 0);
    return Math.round((share - paid) * 100) / 100;
  }, [data.sales, data.payments]);

  const value: Store = {
    ready, remote, notice, userEmail, ownerId,
    products: data.products, purchases: data.purchases, lots: data.lots, sales: data.sales, payments: data.payments,
    giovanniOwed, signIn, signOut, addPurchase, recordSales, addGiovanniPayment, recordBankImport,
    reload: () => load(ownerRef.current),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
