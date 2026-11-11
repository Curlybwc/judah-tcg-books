export type OwnerKind = "mine" | "giovanni" | "split" | "mom_payback" | "mom_split";
export type PaidVia = "USAA" | "Cash" | "Other";

export interface Product {
  id: string;
  owner_id: string;
  name: string;
  barcode: string | null;
  product_type: "sealed" | "single";
  market_price: number | null;
  market_price_at?: string | null; // when market_price was last checked (DECISIONS #35)
  image_url?: string | null; // his own photo (Supabase Storage) or the online product image
  created_at?: string;
}

export type ExpenseCategory = "postage" | "advertising" | "other";

export interface Expense {
  id: string;
  owner_id: string;
  amount: number;
  spent_on: string;
  category: ExpenseCategory;
  note: string;
  created_at?: string;
}

export interface Purchase {
  id: string;
  owner_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  tax: number;
  tax_rate?: number | null; // the % from the receipt that produced `tax`
  shipping_in: number;
  total_cost: number;
  cost_basis_unit: number;
  owner_kind: OwnerKind;
  judah_pct: number;
  paid_via: PaidVia;
  purchased_on: string;
  show_id?: string | null;
  created_at?: string;
}

export interface Lot {
  id: string;
  owner_id: string;
  product_id: string | null;
  purchase_id: string | null;
  qty_on_hand: number;
  cost_basis_unit: number;
  owner_kind: OwnerKind;
  judah_pct: number;
  created_at?: string;
}

export interface Sale {
  id: string;
  owner_id: string;
  product_id: string | null;
  lot_id: string | null;
  product_name: string;
  qty: number;
  item_price: number; // line total for the items (unit price x qty)
  shipping_charged: number;
  shipping_paid: number;
  commission: number;
  transaction_fee: number;
  fees: number;
  net_proceeds: number;
  cost_basis_total: number;
  profit: number;
  judah_share: number;
  mom_share?: number; // on mom_split sales: what this sale put into the owed-to-Mom ledger
  order_id: string | null;
  sold_on: string;
  show_id?: string | null;
  channel?: SaleChannel;
  created_at?: string;
}

export type SaleChannel = "tcgplayer" | "show_cash" | "show_venmo";

export interface Show {
  id: string;
  owner_id: string;
  name: string;
  show_date: string;
  table_fee: number;
  cash_float: number;
  cash_counted: number | null;
  status: "open" | "closed";
  created_at?: string;
}

export interface GiovanniPayment {
  id: string;
  owner_id: string;
  amount: number;
  paid_on: string;
  note: string | null;
  created_at?: string;
}

// A repayment from Judah to Mom (Jen) against the owed-to-Mom ledger.
export type MomPayment = GiovanniPayment;

// Shared sets of books (DECISIONS #32): data rows' owner_id names a set;
// people hold memberships. The demo books are the set whose id is the old
// sample-owner UUID, with no owner and no members.
export interface BookSet {
  id: string;
  name: string;
  owner_user_id: string | null;
  join_code: string;
  created_at?: string;
}

export interface BookMember {
  id: string;
  set_id: string;
  user_id: string;
  email: string | null;
  role: "owner" | "member";
  joined_at?: string;
}

// Loans — money Judah borrowed from a person and has to pay back
// (DECISIONS #34). Interest is simple on purpose: none, a flat dollar
// amount, or a percent of what he borrowed. No compounding.
export type InterestType = "none" | "flat" | "percent";

export interface Loan {
  id: string;
  owner_id: string;
  lender: string;
  principal: number;
  interest_type: InterestType;
  interest_value: number;
  borrowed_on: string;
  due_on: string | null;
  note: string;
  created_at?: string;
}

export interface LoanPayment {
  id: string;
  owner_id: string;
  loan_id: string;
  amount: number;
  paid_on: string;
  note: string;
  created_at?: string;
}

export interface LoanInput {
  lender: string;
  principal: number;
  interest_type: InterestType;
  interest_value: number;
  borrowed_on: string;
  due_on: string | null;
  note: string;
}
