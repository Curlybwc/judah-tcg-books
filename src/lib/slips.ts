// Packing-slip parsing (DECISIONS #54). TCGplayer's orders CSV lists
// totals only — the PACKING SLIPS are the export that names what was in
// each order: order number, date, buyer, and every item with qty and
// price. Jen's words for the app: don't say "export the orders," say
// "export the packing slip." This module turns the slips PDF's text
// (extracted by unpdf in SellFlow) into orders; pure and testable.

export interface SlipItem { qty: number; name: string; unitPrice: number; lineTotal: number }
export interface SlipOrder { orderId: string; soldOn: string; buyerName: string; total: number; items: SlipItem[] }

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function toISO(s: string): string {
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const mo = MONTHS[m[1].slice(0, 3).toLowerCase()] ?? "01";
  return `${m[3]}-${mo}-${m[2].padStart(2, "0")}`;
}

/** "Pokemon - ME06: Delta Reign - Delta Reign Elite Trainer Box - Unopened"
 *  → "Delta Reign Elite Trainer Box". Strips the game prefix, the set
 *  segment, and the trailing condition, leaving the product's own name
 *  for matching against stock. */
export function cleanProductName(desc: string): string {
  let s = desc.replace(/\s+/g, " ").trim();
  s = s.replace(/^(Pokemon|One Piece Card Game)\s*-\s*/i, "");
  // set segment: "ME06: Delta Reign - ", "ME: 30th Celebration - ",
  // "Extra Booster: One Piece Heroines Edition Vol. 2 - "
  s = s.replace(/^[^—-]*?:\s*[^—-]*?\s*-\s*/, (m) => (m.includes(":") ? "" : m));
  if (/^Extra Booster:/i.test(desc.replace(/^(Pokemon|One Piece Card Game)\s*-\s*/i, ""))) {
    s = s.replace(/^Extra Booster:\s*[^—-]*?\s*-\s*/i, "");
  }
  s = s.replace(/\s*-\s*(Unopened|Near Mint.*|Lightly Played.*|Moderately Played.*|Heavily Played.*|Damaged.*)$/i, "");
  return s.trim();
}

export function parseSlipsText(raw: string): SlipOrder[] {
  const text = raw.replace(/\s+/g, " ");
  const segments = text.split(/(?=Order Number:)/).filter((x) => x.includes("Order Number:"));
  const orders: SlipOrder[] = [];
  for (const seg of segments) {
    const oid = seg.match(/Order Number:\s*(\S+)/)?.[1];
    if (!oid) continue;
    const dateM = seg.match(/ORDER DATE\s+([A-Za-z]+ \d{1,2}, \d{4})/);
    const buyer = seg.match(/BUYER\s+(.+?)\s+SELLER/)?.[1]?.trim() ?? "";
    const blockM = seg.split(/QTY DESCRIPTION PRICE TOTAL/)[1];
    if (!blockM) continue;
    const block = blockM.split(/For Any Questions/)[0];
    const totalM = block.match(/\d+\s+Total\s+\$(\d+\.\d{2})/);
    if (!totalM) continue;
    const items: SlipItem[] = [];
    const re = /(\d+)\s+(.+?)\s+\$(\d+\.\d{2})\s+\$(\d+\.\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) {
      const name = cleanProductName(m[2]);
      if (!name || /^total$/i.test(name)) continue;
      items.push({ qty: parseInt(m[1]), name, unitPrice: parseFloat(m[3]), lineTotal: parseFloat(m[4]) });
    }
    if (!items.length) continue;
    orders.push({ orderId: oid, soldOn: dateM ? toISO(dateM[1]) : new Date().toISOString().slice(0, 10), buyerName: buyer, total: parseFloat(totalM[1]), items });
  }
  return orders;
}
