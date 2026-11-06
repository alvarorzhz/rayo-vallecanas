export type FinanceKind = "income" | "expense";

export type Category = { id: string; kind: FinanceKind; name: string; sort: number; active: boolean };

export type Movement = {
  id: string;
  kind: FinanceKind;
  op_date: string;
  season: string;
  concept: string;
  category_id: string;
  amount_cents: number;
  method: string;
  counterparty: string | null;
  notes: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  campaign_id: string | null;
  player_id?: string | null;
  fee_season?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
};

export type MovementRow = Movement & {
  category: { name: string } | null;
  author: { full_name: string } | null;
};

export type FinanceSummary = {
  opening_cents: number;
  opening_date: string;
  balance_cents: number;
  income_cents: number;
  expense_cents: number;
  count: number;
};

export const KIND_LABEL: Record<FinanceKind, string> = { income: "Ingreso", expense: "Gasto" };
export const KIND_SLUG: Record<FinanceKind, string> = { income: "ingreso", expense: "gasto" };
export const kindFromSlug = (s?: string | null): FinanceKind | null => (s === "ingreso" ? "income" : s === "gasto" ? "expense" : null);

/** Temporada deportiva (septiembre a agosto) de una fecha: "2026/27". Igual que finance_season() en la BD. */
export function seasonOf(d: string | Date = new Date()): string {
  const iso = typeof d === "string" ? d : new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
  const [y, m] = iso.split("-").map(Number);
  const start = m >= 9 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** "2026/27" -> { from: "2026-09-01", to: "2027-08-31" } */
export function seasonRange(season: string): { from: string; to: string } | null {
  const m = season.match(/^(\d{4})\/\d{2}$/);
  if (!m) return null;
  const y = Number(m[1]);
  return { from: `${y}-09-01`, to: `${y + 1}-08-31` };
}

/** Fecha de hoy en Madrid, en formato AAAA-MM-DD. */
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export const MOVEMENT_SELECT = "*, category:finance_categories(name), author:profiles!finance_movements_created_by_fkey(full_name)";
