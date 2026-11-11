// Pirate Ship shipment-history import (DECISIONS #33).
//
// Pirate Ship (Ship page → blank search → Shipments grid → Columns →
// Export) downloads a spreadsheet with one row per label bought: the
// TCGplayer order number (when orders went in by spreadsheet, which
// carries an Order ID column), the recipient's name, the tracking number
// and the exact postage cost. That file is the bridge into the Sell
// screen's "Shipping you paid" step: match by order number, fall back to
// buyer name, and the label cost fills itself in — no typing or guessing.

export interface PsRow {
  orderId: string;
  cost: number;
  name: string;
  tracking: string;
}

const stripKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function pickField(headers: string[], wants: string[]): string | null {
  const norm = headers.map((h) => stripKey(h));
  for (const w of wants) {
    const i = norm.findIndex((h) => h.includes(w));
    if (i >= 0) return headers[i];
  }
  return null;
}

/** Turn parsed CSV records (any header spelling) into label rows. */
export function extractPsRows(records: Record<string, string>[]): { rows: PsRow[]; error: string | null } {
  if (!records.length) return { rows: [], error: "That file is empty." };
  const headers = Object.keys(records[0]);
  const fOrder = pickField(headers, ["orderid", "ordernumber", "order"]);
  const fCost = pickField(headers, ["totalcost", "labelcost", "postagecost", "postage", "cost", "price", "amount", "total"]);
  const fName = pickField(headers, ["recipient", "shipto", "toname", "buyer", "name"]);
  const fTrack = pickField(headers, ["tracking"]);
  if (!fCost) return { rows: [], error: "I couldn't find a cost column in that file. In Pirate Ship, add the cost column before you export (Shipments grid → Columns)." };
  if (!fOrder && !fName) return { rows: [], error: "I couldn't find an Order ID or a name column in that file — there's nothing to match orders with." };
  const rows: PsRow[] = [];
  for (const r of records) {
    const cost = parseFloat(String(r[fCost] ?? "").replace(/[^0-9.]/g, ""));
    const orderId = fOrder ? String(r[fOrder] ?? "").trim() : "";
    const name = fName ? String(r[fName] ?? "").trim() : "";
    if (isNaN(cost) || (!orderId && !name)) continue;
    rows.push({ orderId, cost: Math.round(cost * 100) / 100, name, tracking: fTrack ? String(r[fTrack] ?? "").trim() : "" });
  }
  if (!rows.length) return { rows: [], error: "No label rows with a cost found in that file." };
  return { rows, error: null };
}

export const orderKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const nameKey = (s: string): string => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Total postage per TCGplayer order number — split shipments add up. */
export function psTotalsByOrder(rows: PsRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.orderId) continue;
    const k = orderKey(r.orderId);
    m.set(k, Math.round(((m.get(k) ?? 0) + r.cost) * 100) / 100);
  }
  return m;
}

/** Total postage per buyer name — the fallback when a label has no order number. */
export function psTotalsByName(rows: PsRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.name) continue;
    const k = nameKey(r.name);
    m.set(k, Math.round(((m.get(k) ?? 0) + r.cost) * 100) / 100);
  }
  return m;
}
