const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export const euros = (cents: number | null | undefined) => eur.format((cents ?? 0) / 100);

/** "12,50" | "12.5" | "12" -> 1250 */
export function parseEuros(value: FormDataEntryValue | null): number {
  const s = String(value ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error("Importe no válido");
  return Math.round(n * 100);
}

/** "lunes, 22 de diciembre de 2026" (para fechas sin hora, como la del sorteo). */
export const fechaLarga = (d: string | null | undefined) =>
  d
    ? new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(
        new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d),
      )
    : "";

export const fecha = (d: string | Date | null | undefined, withTime = false) =>
  d
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" } : {}),
        timeZone: "Europe/Madrid",
      }).format(new Date(d))
    : "—";

/** Última conexión: «Ahora mismo» (menos de 5 min), «Hace 25 min» (menos de una hora) o la fecha con hora. */
export function ultimaConexion(d: string | null | undefined, now: number = Date.now()): string {
  if (!d) return "—";
  const min = Math.floor((now - new Date(d).getTime()) / 60_000);
  if (min < 5) return "Ahora mismo";
  if (min < 60) return `Hace ${min} min`;
  return fecha(d, true);
}

/** Convierte una lista de números en rangos legibles: [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
export function ranges(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    out.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return out.join(", ");
}

/** "1-3, 7" -> [1,2,3,7] */
export function parseRanges(input: string): number[] {
  const set = new Set<number>();
  for (const part of input.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Formato no válido: "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b < a || b - a > 10000) throw new Error(`Rango no válido: "${part}"`);
    for (let n = a; n <= b; n++) set.add(n);
  }
  return [...set].sort((x, y) => x - y);
}

/** Normaliza un teléfono español a formato internacional sin "+" (para WhatsApp). */
export function phoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (/^[6789]\d{8}$/.test(p)) p = "34" + p;
  return p.length >= 10 ? p : null;
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  cancelled: "Anulada",
};
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  bizum: "Bizum",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  drawn: "Sorteada",
};
export const NUMBERING_MODE_LABEL: Record<string, string> = {
  auto: "Automática",
  booklet: "Talonarios",
  manual: "Elección manual",
};
export const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadministrador",
  admin: "Gestor",
  player: "Jugador",
};
export const MODULE_LABEL: Record<string, string> = {
  lottery_admin: "Sorteos · gestión",
  lottery_sell: "Sorteos · vender",
  users: "Usuarios y permisos",
  audit: "Auditoría",
  finances: "Finanzas",
  squad: "Plantilla",
  squad_private: "Plantilla · datos personales",
  matches: "Partidos",
  sponsors: "Patrocinadores",
};
