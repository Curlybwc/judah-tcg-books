export type OwnerKind = "mine" | "giovanni" | "split";
export type PaidVia = "USAA" | "Cash" | "Other";

export interface Product {
  id: string;
  owner_id: string;
  name: string;
  barcode: string | null;
  product_type: "sealed" | "single";
  market_price: number | null;
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
  shipping_in: number;
  total_cost: number;
  cost_basis_unit: number;
  owner_kind: OwnerKind;
  judah_pct: number;
  paid_via: PaidVia;
  purchased_on: string;
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
  order_id: string | null;
  sold_on: string;
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
