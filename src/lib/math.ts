// Money math — the single source of truth for every number in the app.
// Fee model: TCGplayer Level 1–4 seller (Jen, settled design).

export const COMMISSION_RATE = 0.1075; // 10.75% on (item + shipping charged)
export const TRANSACTION_RATE = 0.025; // 2.5% on (item + shipping charged)
export const TRANSACTION_FLAT = 0.3; // + $0.30 per order

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PurchaseMath {
  totalCost: number;
  costBasisUnit: number;
}

export function purchaseMath(qty: number, unitPrice: number, tax: number, shippingIn: number): PurchaseMath {
  const totalCost = round2(unitPrice * qty + tax + shippingIn);
  const costBasisUnit = qty > 0 ? totalCost / qty : 0;
  return { totalCost, costBasisUnit };
}

export interface SaleMath {
  base: number; // item + shipping charged
  commission: number;
  transactionFee: number;
  fees: number;
  netProceeds: number; // what Giovanni collected for this sale, after fees + shipping paid
  costBasisTotal: number;
  profit: number;
  judahShare: number; // Judah-owned share of net proceeds (the Giovanni-owes number)
}

export function saleMath(args: {
  qty: number;
  unitItemPrice: number;
  shippingCharged: number;
  shippingPaid: number;
  costBasisUnit: number;
  judahPct: number; // 0–100
}): SaleMath {
  const itemTotal = args.unitItemPrice * args.qty;
  const base = round2(itemTotal + args.shippingCharged);
  const commission = round2(base * COMMISSION_RATE);
  const transactionFee = round2(base * TRANSACTION_RATE + TRANSACTION_FLAT);
  const fees = round2(commission + transactionFee);
  const netProceeds = round2(base - fees - args.shippingPaid);
  const costBasisTotal = round2(args.costBasisUnit * args.qty);
  const profit = round2(netProceeds - costBasisTotal);
  const judahShare = round2(netProceeds * (args.judahPct / 100));
  return { base, commission, transactionFee, fees, netProceeds, costBasisTotal, profit, judahShare };
}

export function giovanniBalance(salesJudahShareTotal: number, paymentsTotal: number): number {
  return round2(salesJudahShareTotal - paymentsTotal);
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
