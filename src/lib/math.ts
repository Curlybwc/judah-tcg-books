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

// Tax from the rate printed on the receipt (Jen, 2026-11-06): a receipt shows ONE
// rate applied to everything bought, so the app takes the % and figures the $.
export function taxFromRate(subtotal: number, ratePct: number): number {
  return round2(subtotal * (ratePct / 100));
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

export interface QuickSaleMath {
  gross: number; // what the buyer handed over — no fees, no shipping at a show
  costBasisTotal: number;
  profit: number;
  judahShare: number;
}

// In-person show sale: cash or Venmo, no TCGplayer fees, no shipping.
export function quickSaleMath(args: { qty: number; unitPrice: number; costBasisUnit: number; judahPct: number }): QuickSaleMath {
  const gross = round2(args.unitPrice * args.qty);
  const costBasisTotal = round2(args.costBasisUnit * args.qty);
  const profit = round2(gross - costBasisTotal);
  const judahShare = round2(gross * (args.judahPct / 100));
  return { gross, costBasisTotal, profit, judahShare };
}

// Cash box at a show: starting float + cash taken in − cash spent on buys.
export function showCashExpected(cashFloat: number, cashSalesTotal: number, cashBuysTotal: number): number {
  return round2(cashFloat + cashSalesTotal - cashBuysTotal);
}

export interface TaxSale { item_price: number; shipping_charged: number; shipping_paid: number; fees: number; cost_basis_total: number; profit: number; sold_on: string }
export interface TaxExpense { amount: number; spent_on: string; category: string }
export interface TaxSummary {
  grossReceipts: number;   // Schedule C line 1: item totals + shipping charged
  cogs: number;            // line 4: cost of the items actually sold
  grossProfit: number;     // line 7
  fees: number;            // line 10: commissions & fees (TCGplayer)
  shippingPaid: number;    // postage/delivery — part of other expenses (line 27)
  tableFees: number;       // show table fees — other expenses (line 27)
  expensesByCategory: Record<string, number>; // manual expenses, by category
  manualExpenses: number;
  totalExpenses: number;   // line 28
  netProfit: number;       // line 31
  salesProfit: number;     // cross-check input: sum of sale profits for the year
  purchasesInYear: number; // line 36: product bought during the year
}

// One tax year of books, shaped like Schedule C (Jen, 2026-11-07). Sales profit
// already nets fees + shipping + item cost, so netProfit must always equal
// salesProfit − tableFees − manualExpenses; the page shows that cross-check.
export function taxSummary(
  year: number,
  sales: TaxSale[],
  shows: { table_fee: number; show_date: string }[],
  expenses: TaxExpense[],
  purchases: { total_cost: number; purchased_on: string }[],
): TaxSummary {
  const inYear = (d: string) => d.startsWith(String(year));
  const ys = sales.filter((s) => inYear(s.sold_on));
  const grossReceipts = round2(ys.reduce((s, x) => s + Number(x.item_price) + Number(x.shipping_charged), 0));
  const cogs = round2(ys.reduce((s, x) => s + Number(x.cost_basis_total), 0));
  const fees = round2(ys.reduce((s, x) => s + Number(x.fees), 0));
  const shippingPaid = round2(ys.reduce((s, x) => s + Number(x.shipping_paid), 0));
  const salesProfit = round2(ys.reduce((s, x) => s + Number(x.profit), 0));
  const tableFees = round2(shows.filter((s) => inYear(s.show_date)).reduce((s, x) => s + Number(x.table_fee), 0));
  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses.filter((x) => inYear(x.spent_on))) {
    expensesByCategory[e.category] = round2((expensesByCategory[e.category] ?? 0) + Number(e.amount));
  }
  const manualExpenses = round2(Object.values(expensesByCategory).reduce((s, v) => s + v, 0));
  const grossProfit = round2(grossReceipts - cogs);
  const totalExpenses = round2(fees + shippingPaid + tableFees + manualExpenses);
  return {
    grossReceipts, cogs, grossProfit, fees, shippingPaid, tableFees, expensesByCategory, manualExpenses,
    totalExpenses, netProfit: round2(grossProfit - totalExpenses), salesProfit,
    purchasesInYear: round2(purchases.filter((p) => inYear(p.purchased_on)).reduce((s, x) => s + Number(x.total_cost), 0)),
  };
}

// Mom's cut of a sale (Jen's formula, settled 2026-11-07): when Mom paid for an
// item, Judah owes her the item's full cost back (tracked on the buy side of the
// ledger) PLUS 50% of the sale's actual profit — profit being what he got for it
// after TCGplayer fees and shipping paid, minus the item's cost. A losing sale
// shares the loss the same way, so this can be negative. Judah's share of the
// proceeds themselves is untouched: Giovanni still owes him everything he
// collected, and the Mom ledger is settled from that.
export function momProfitShare(profit: number): number {
  return round2(profit * 0.5);
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export interface LoanLike { principal: number; interest_type: "none" | "flat" | "percent"; interest_value: number }
export interface LoanMathResult { interestAmount: number; totalToRepay: number; paid: number; owed: number; paidOff: boolean }

/** Simple loan math (DECISIONS #34): interest is one flat amount or one
 *  percent of the amount borrowed — never compounding. */
export function loanMath(loan: LoanLike, paidTotal: number): LoanMathResult {
  const interestAmount = loan.interest_type === "flat" ? round2(loan.interest_value)
    : loan.interest_type === "percent" ? round2((loan.principal * loan.interest_value) / 100) : 0;
  const totalToRepay = round2(loan.principal + interestAmount);
  const paid = round2(paidTotal);
  const owed = Math.max(0, round2(totalToRepay - paid));
  return { interestAmount, totalToRepay, paid, owed, paidOff: totalToRepay > 0 && owed <= 0 };
}
