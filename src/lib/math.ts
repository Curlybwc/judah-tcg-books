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

export interface TaxSale { item_price: number; shipping_charged: number; shipping_paid: number; fees: number; cost_basis_total: number; profit: number; sold_on: string; lot_id?: string | null; mom_share?: number | null }
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

// ——— Per-person profit (DECISIONS #58, Jen 2026-11-12) ———
// "We need a better formula for figuring out Judah's profit vs Gio's
// profit vs Mom's profit." Profit is figured sale by sale (payout after
// fees and postage, minus the stock's cost), then it lands on whoever's
// stock it was: Giovanni's stock → Giovanni's profit, all of it; Judah's
// stock → Judah's; Mom's stock → split — her recorded mom_share is her
// profit, the rest of that sale's profit is Judah's (he sold it). And
// the Schedule C is Judah's alone: Giovanni's numbers never touch it.
export type ProfitPerson = "judah" | "giovanni" | "mom" | "jake";
export const isMomKind = (kind: string) => kind === "mom_payback" || kind === "mom_split";
export function kindOfLot(lots: LotKind[], lotId: string | null | undefined): string {
  if (!lotId) return "mine"; // lot-less rows (e.g. show sales) are Judah's business
  return lots.find((l) => l.id === lotId)?.owner_kind ?? "mine";
}
export function profitForPerson(person: ProfitPerson, sale: { profit: number; mom_share?: number | null }, kind: string): number {
  const profit = Number(sale.profit);
  if (kind === "giovanni") return person === "giovanni" ? profit : 0;
  if (kind === "jake") return person === "jake" ? profit : 0;
  if (isMomKind(kind)) {
    const ms = Number(sale.mom_share ?? 0);
    if (person === "mom") return ms;
    if (person === "judah") return round2(profit - ms);
    return 0;
  }
  return person === "judah" ? profit : 0;
}
export function profitByPerson(sales: { lot_id?: string | null; profit: number; mom_share?: number | null }[], lots: LotKind[]): Record<ProfitPerson, number> {
  const out: Record<ProfitPerson, number> = { judah: 0, giovanni: 0, mom: 0, jake: 0 };
  for (const s of sales) {
    const kind = kindOfLot(lots, s.lot_id);
    out.judah = round2(out.judah + profitForPerson("judah", s, kind));
    out.giovanni = round2(out.giovanni + profitForPerson("giovanni", s, kind));
    out.mom = round2(out.mom + profitForPerson("mom", s, kind));
    out.jake = round2(out.jake + profitForPerson("jake", s, kind));
  }
  return out;
}

export interface PersonTaxSummary extends TaxSummary { person: ProfitPerson; momShareTotal: number; judahCutTotal: number }
export interface PersonPurchase { total_cost: number; purchased_on: string; owner_kind: string }

/** One person's tax-shaped year. Judah's IS the Schedule C: his stock +
 *  Mom's stock (she's his supplier — her profit share is a cost line),
 *  all shows and loose expenses, none of Giovanni's anything. Giovanni's
 *  and Mom's are memos in the same shape, their own numbers only. */
export function personTaxSummary(
  person: ProfitPerson, year: number,
  sales: TaxSale[], lots: LotKind[],
  shows: { table_fee: number; show_date: string }[],
  expenses: TaxExpense[],
  purchases: PersonPurchase[],
): PersonTaxSummary {
  const kind = (s: TaxSale) => kindOfLot(lots, s.lot_id);
  const inScope = (k: string) => person === "judah" ? (k !== "giovanni" && k !== "jake") : person === "giovanni" ? k === "giovanni" : person === "jake" ? k === "jake" : isMomKind(k);
  const scopedSales = sales.filter((s) => inScope(kind(s)));
  const scopedPurchases = purchases.filter((p) => inScope(p.owner_kind));
  const base = taxSummary(year, scopedSales, person === "judah" ? shows : [], person === "judah" ? expenses : [], scopedPurchases);
  const inYear = (d: string) => d.startsWith(String(year));
  const momSales = sales.filter((s) => inYear(s.sold_on) && isMomKind(kind(s)));
  const momShareTotal = round2(momSales.reduce((sum, s) => sum + Number(s.mom_share ?? 0), 0));
  const judahCutTotal = round2(momSales.reduce((sum, s) => sum + round2(Number(s.profit) - Number(s.mom_share ?? 0)), 0));
  const out: PersonTaxSummary = { ...base, person, momShareTotal, judahCutTotal };
  if (person === "judah" && momShareTotal !== 0) {
    out.totalExpenses = round2(base.totalExpenses + momShareTotal);
    out.netProfit = round2(base.netProfit - momShareTotal);
  }
  if (person === "mom") {
    out.totalExpenses = round2(base.totalExpenses + judahCutTotal);
    out.netProfit = round2(base.netProfit - judahCutTotal);
  }
  return out;
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

export interface FrontedSale { lot_id: string | null; shipping_paid: number; channel?: string | null; ship_paid_by?: string | null }
export interface LotKind { id: string; owner_kind: string }

/** Shipping Judah fronted on GIOVANNI's product (DECISIONS #36, Jen's
 *  ruling): Judah takes no cut of Giovanni's sales, but he must not eat
 *  the postage either — shipping he paid on Giovanni-owned TCGplayer
 *  sales is Giovanni's cost, owed back to Judah — whoever fronted it
 *  (DECISIONS #66: Mom-paid counts too; see below). Only the first row of
 *  an order carries shipping_paid, so summing rows never double-counts. */
export function frontedShipping(sales: FrontedSale[], lots: LotKind[]): number {
  const kind = new Map(lots.map((l) => [l.id, l.owner_kind]));
  let total = 0;
  for (const s of sales) {
    if (s.channel && s.channel !== "tcgplayer") continue;
    // DECISIONS #66 (Jen, 2026-11-12): shipping on Giovanni's product is
    // Giovanni's debt to Judah WHOEVER fronted it. If Mom paid it, Judah
    // owes Mom (momShippingOwed) and collects it back from Giovanni —
    // the two legs are the same dollars passing through, not a double count.
    if (s.lot_id && kind.get(s.lot_id) === "giovanni") total += Number(s.shipping_paid) || 0;
  }
  return round2(total);
}

export interface JakeSale { lot_id: string | null; item_price: number; shipping_charged: number; fees: number; shipping_paid: number; channel?: string | null }

/** What Judah owes Jake (DECISIONS #67, Jen 2026-11-12): Jake's product
 *  sells on the shared account as a pass-through — Giovanni pays Judah
 *  the gross minus fees (counted inside giovanniShareGross), and Judah
 *  pays Jake the gross minus fees AND shipping. Jake's own cost basis
 *  is Jake's business, never Judah's income. */
export function jakeOwed(sales: JakeSale[], lots: LotKind[], paymentsTotal: number): number {
  const kind = new Map(lots.map((l) => [l.id, l.owner_kind]));
  let total = 0;
  for (const s of sales) {
    if (s.channel && s.channel !== "tcgplayer") continue;
    if (!s.lot_id || kind.get(s.lot_id) !== "jake") continue;
    total += (Number(s.item_price) || 0) + (Number(s.shipping_charged) || 0) - (Number(s.fees) || 0) - (Number(s.shipping_paid) || 0);
  }
  return round2(total - paymentsTotal);
}

export interface ShareSale { lot_id: string | null; item_price: number; shipping_charged: number; fees: number; channel?: string | null }

/** Judah's share of Giovanni's collections, GROSS of postage (DECISIONS
 *  #66, Jen: "gio owes the gross"): what TCGplayer actually paid out on
 *  Judah's and Mom's stock — item + shipping charged − TCGplayer fees.
 *  Postage is NOT deducted here: it came out of Mom's bank account, not
 *  out of Giovanni's payout, and it is settled on its own lines. */
export function giovanniShareGross(sales: ShareSale[], lots: LotKind[]): number {
  const kind = new Map(lots.map((l) => [l.id, l.owner_kind]));
  let total = 0;
  for (const s of sales) {
    if (s.channel && s.channel !== "tcgplayer") continue;
    if (!s.lot_id || kind.get(s.lot_id) === "giovanni") continue;
    total += (Number(s.item_price) || 0) + (Number(s.shipping_charged) || 0) - (Number(s.fees) || 0);
  }
  return round2(total);
}

/** Profit if everything on hand sold at the current market price
 *  (DECISIONS #69, Jen 2026-11-13): per product, sum over its lots of
 *  qty_on_hand x (market - cost basis). Ignores fees/shipping — it is
 *  the at-market snapshot Jen asked for by each inventory title. */
export function profitAtMarket(lots: { qty_on_hand: number; cost_basis_unit: number }[], market: number): number {
  return round2(lots.reduce((a, l) => a + (Number(l.qty_on_hand) || 0) * (market - (Number(l.cost_basis_unit) || 0)), 0));
}

export interface MomSaleRow { lot_id: string | null; cost_basis_total: number }
export interface MomLotRow { id: string; owner_kind: string; qty_on_hand: number; cost_basis_unit: number }

/** The two halves of what Judah owes Mom (DECISIONS #68, Jen 2026-11-13):
 *  her money that has come due from sales vs. her money still sitting in
 *  unsold product. soldCost = cost basis of Mom lots already sold;
 *  inventoryCost = cost basis of Mom lots still on hand. */
export function momSplit(sales: MomSaleRow[], lots: MomLotRow[]): { soldCost: number; inventoryCost: number } {
  const kind = new Map(lots.map((l) => [l.id, l.owner_kind]));
  let sold = 0;
  for (const s of sales) if (s.lot_id && isMomKind(kind.get(s.lot_id) ?? "")) sold += Number(s.cost_basis_total) || 0;
  let inv = 0;
  for (const l of lots) if (isMomKind(l.owner_kind)) inv += (Number(l.qty_on_hand) || 0) * (Number(l.cost_basis_unit) || 0);
  return { soldCost: round2(sold), inventoryCost: round2(inv) };
}

/** Postage Mom fronted (DECISIONS #51, Jen's ruling): the Pirate Ship
 *  account draws on HER bank account, so every Mom-paid shipping charge
 *  is money out of her pocket and joins what Judah owes her. Only the
 *  first row of an order carries shipping_paid (same convention as
 *  frontedShipping), so summing rows never double-counts. */
export function momShippingOwed(sales: FrontedSale[]): number {
  let total = 0;
  for (const s of sales) {
    if (s.ship_paid_by === "mom") total += Number(s.shipping_paid) || 0;
  }
  return round2(total);
}
