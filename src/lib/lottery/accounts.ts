/**
 * 4.20.0 · Cuentas de cada vendedor: lo que ha cobrado a sus compradores y lo que ya ha entregado al club.
 */
export type SellerAccountRow = { seller_id: string; full_name: string; shares: number; sold_cents: number; paid_cents: number; handed_cents: number };

export type SellerAccount = SellerAccountRow & {
  /** Cobrado y todavía en manos del vendedor (si ha entregado de más, 0). */
  owed: number;
  /** Ha entregado más de lo que consta cobrado (falta apuntar algún cobro). */
  over: number;
  /** Lo que sus compradores aún no han pagado. */
  unpaid: number;
  state: "debe" | "al-dia" | "sin-ventas" | "de-mas";
};

export function sellerAccount(r: SellerAccountRow): SellerAccount {
  const sold = Number(r.sold_cents), paid = Number(r.paid_cents), handed = Number(r.handed_cents);
  const diff = paid - handed;
  const state = sold === 0 && handed === 0 ? "sin-ventas" : diff > 0 ? "debe" : diff < 0 ? "de-mas" : "al-dia";
  return { ...r, shares: Number(r.shares), sold_cents: sold, paid_cents: paid, handed_cents: handed, owed: Math.max(0, diff), over: Math.max(0, -diff), unpaid: Math.max(0, sold - paid), state };
}

export function accountsTotals(rows: SellerAccount[]) {
  return rows.reduce((t, r) => ({ handed: t.handed + r.handed_cents, owed: t.owed + r.owed, unpaid: t.unpaid + r.unpaid }), { handed: 0, owed: 0, unpaid: 0 });
}

/** Partes de la barra (en %, sobre lo vendido): entregado al club y cobrado pero aún en manos del vendedor. */
export function accountBar(a: SellerAccount): { handed: number; owed: number } {
  const base = Math.max(a.sold_cents, a.handed_cents, 1);
  return { handed: Math.min(100, (a.handed_cents / base) * 100), owed: Math.min(100, (a.owed / base) * 100) };
}
