/** Patrocinadores: tipos, etiquetas y cálculos (cobrado, pendiente, vencido). */

export type SponsorTier = "main" | "partner";
export type AgreementKind = "money" | "in_kind" | "mixed";
export type AgreementStatus = "negotiating" | "signed" | "cancelled";

export type Sponsor = {
  id: string;
  name: string;
  tier: SponsorTier;
  logo_url: string | null;
  website: string | null;
  instagram: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  active: boolean;
  sort: number;
};

type Payment = { installment_id: string; movement_id: string; op_date: string; amount_cents: number; method: string };
type Installment = { id: string; agreement_id: string; due_on: string; amount_cents: number; payment: Payment | null };

export type Agreement = {
  id: string;
  sponsor_id: string;
  season: string;
  kind: AgreementKind;
  amount_cents: number;
  in_kind: string | null;
  in_kind_value_cents: number | null;
  benefits: string | null;
  status: AgreementStatus;
  starts_on: string | null;
  ends_on: string | null;
  contract_path: string | null;
  contract_name: string | null;
  notes: string | null;
  installments: Installment[];
};

export type Showcase = { id: string; name: string; tier: SponsorTier; logo_url: string | null; website: string | null };

export const TIER_LABEL: Record<SponsorTier, string> = { main: "Principal", partner: "Colaborador" };
export const KIND_LABEL: Record<AgreementKind, string> = { money: "Dinero", in_kind: "En especie", mixed: "Dinero y especie" };
export const STATUS_LABEL: Record<AgreementStatus, string> = { negotiating: "Negociando", signed: "Firmado", cancelled: "Cancelado" };

/** Estado que se enseña: el guardado más lo que se deduce de los cobros y las fechas. */
export type ShownStatus = "negotiating" | "signed" | "paid" | "expired" | "cancelled";
export const SHOWN_LABEL: Record<ShownStatus, string> = {
  negotiating: "Negociando", signed: "Firmado", paid: "Cobrado", expired: "Vencido", cancelled: "Cancelado",
};
export const SHOWN_TONE: Record<ShownStatus, string> = {
  negotiating: "bg-amber-100 text-amber-800",
  signed: "bg-negro text-white",
  paid: "bg-green-100 text-green-800",
  expired: "bg-black/10 text-negro/70",
  cancelled: "bg-black/5 text-negro/60 line-through",
};

export const hasMoney = (a: Pick<Agreement, "kind">) => a.kind !== "in_kind";
export const hasInKind = (a: Pick<Agreement, "kind">) => a.kind !== "money";

export function money(a: Agreement, today: string) {
  const planned = a.installments.reduce((s, i) => s + i.amount_cents, 0);
  const paid = a.installments.reduce((s, i) => s + (i.payment?.amount_cents ?? 0), 0);
  const total = hasMoney(a) ? a.amount_cents : 0;
  const pending = Math.max(0, total - paid);
  const overdue = a.status === "signed" ? a.installments.filter((i) => !i.payment && i.due_on < today) : [];
  const next = a.installments.filter((i) => !i.payment).sort((x, y) => x.due_on.localeCompare(y.due_on))[0] ?? null;
  return { total, planned, paid, pending, overdue, next };
}

export function shownStatus(a: Agreement, today: string): ShownStatus {
  if (a.status !== "signed") return a.status;
  const m = money(a, today);
  if (a.ends_on && a.ends_on < today) return m.pending > 0 ? "signed" : "expired";
  if (m.total > 0 && m.pending === 0) return "paid";
  return "signed";
}

/** Días que faltan para una fecha (negativo si ya pasó). */
export const daysTo = (date: string, today: string) =>
  Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000);

/** Reparte un importe en n plazos mensuales iguales (los céntimos que sobran van en el primero). */
export function splitInstallments(totalCents: number, n: number, firstDue: string): { due_on: string; amount_cents: number }[] {
  const count = Math.max(1, Math.min(12, Math.floor(n)));
  const base = Math.floor(totalCents / count);
  const rest = totalCents - base * count;
  const [y, m, d] = firstDue.split("-").map(Number);
  return Array.from({ length: count }, (_, k) => {
    const month = m - 1 + k;
    const yy = y + Math.floor(month / 12);
    const mm = (month % 12) + 1;
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const due_on = `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
    return { due_on, amount_cents: base + (k === 0 ? rest : 0) };
  }).filter((x) => x.amount_cents > 0);
}

/** Temporadas para elegir: la anterior, la actual y la siguiente (más las que ya tengan acuerdos). */
export function seasonChoices(current: string, extra: string[] = []): string[] {
  const y = Number(current.slice(0, 4));
  const fmt = (a: number) => `${a}/${String((a + 1) % 100).padStart(2, "0")}`;
  return [...new Set([fmt(y + 1), fmt(y), fmt(y - 1), ...extra])].sort().reverse();
}

export const instagramUrl = (handle: string | null) => {
  if (!handle) return null;
  if (/^https?:\/\//.test(handle)) return handle;
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
};

type DB = { from: (t: string) => any; rpc: (f: string, a?: object) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Acuerdos (con sus plazos y cobros) de unos patrocinadores o de una temporada. */
export async function fetchAgreements(supabase: DB, f: { sponsorId?: string; season?: string }): Promise<Agreement[]> {
  let q = supabase.from("sponsor_agreements").select("*, installments:sponsor_installments(id, agreement_id, due_on, amount_cents)");
  if (f.sponsorId) q = q.eq("sponsor_id", f.sponsorId);
  if (f.season) q = q.eq("season", f.season);
  const { data } = await q.order("season", { ascending: false }).order("created_at", { ascending: false });
  const rows = (data ?? []) as (Omit<Agreement, "installments"> & { installments: Omit<Installment, "payment">[] })[];
  if (!rows.length) return [];
  const { data: pays } = await supabase.rpc("sponsor_payments", { p_agreement_ids: rows.map((r) => r.id) });
  const byInst = new Map(((pays ?? []) as Payment[]).map((p) => [p.installment_id, p]));
  return rows.map((r) => ({
    ...r,
    installments: [...r.installments]
      .sort((a, b) => a.due_on.localeCompare(b.due_on))
      .map((i) => ({ ...i, payment: byInst.get(i.id) ?? null })),
  }));
}

export type SponsorDisplay = { show_home: boolean; show_result: boolean };
export async function fetchDisplay(supabase: DB): Promise<SponsorDisplay> {
  const { data } = await supabase.from("sponsor_settings").select("show_home, show_result").maybeSingle();
  return { show_home: data?.show_home ?? true, show_result: data?.show_result ?? true };
}
