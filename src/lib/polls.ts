/** Votaciones sí/no: tipos y cálculos (sin dependencias de servidor, para poder probarlos). */

export type PollAudience = "all" | "player" | "admin";

export type Poll = {
  id: string;
  question: string;
  details: string | null;
  audience: PollAudience;
  anonymous: boolean;
  closes_at: string;
  created_at: string;
  reminded_at: string | null;
  open: boolean;
  created_by_name: string | null;
  yes: number;
  no: number;
  /** Personas a las que va dirigida (activas). */
  eligible: number;
  my_vote: boolean | null;
  can_vote: boolean;
  /** Quién ha votado qué (null si es secreta). */
  voters: { name: string; vote: boolean; avatar_url: string | null }[] | null;
  /** Quién falta por votar: solo para gestores y si no es secreta. */
  missing: string[] | null;
};

export const AUDIENCE_LABEL: Record<PollAudience, string> = {
  all: "Todo el equipo",
  player: "Jugadores",
  admin: "Gestores",
};

/** Duraciones que se ofrecen al lanzarla (en horas). */
export const DURATIONS: { hours: number; label: string }[] = [
  { hours: 1, label: "1 hora" },
  { hours: 3, label: "3 horas" },
  { hours: 12, label: "12 horas" },
  { hours: 24, label: "1 día" },
  { hours: 48, label: "2 días" },
  { hours: 72, label: "3 días" },
  { hours: 168, label: "1 semana" },
];

/** Hora de cierre: o bien «ahora + duración», o bien una fecha y hora concretas (hora de Madrid). */
export function closesAt(input: { hours?: number | null; until?: string | null }, now = new Date()): Date | null {
  if (input.until) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input.until);
    if (!m) return null;
    const [, y, mo, d, h, mi] = m.map(Number);
    return madridToUtc(y, mo, d, h, mi);
  }
  const h = Number(input.hours);
  if (!Number.isFinite(h) || h <= 0) return null;
  return new Date(now.getTime() + h * 3600_000);
}

/** Fecha y hora de Madrid → instante UTC (tiene en cuenta el horario de verano). */
export function madridToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = (t: number) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(t)).reduce<Record<string, number>>((a, x) => (x.type === "literal" ? a : { ...a, [x.type]: Number(x.value) }), {});
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
  };
  return new Date(guess - offset(guess - offset(guess)));
}

/** Límites al lanzarla: al menos 15 minutos y como mucho 30 días. */
export function checkClose(at: Date | null, now = new Date()): string | null {
  if (!at || Number.isNaN(at.getTime())) return "Elige cuándo se cierra";
  if (at.getTime() - now.getTime() < 15 * 60_000) return "La votación tiene que durar al menos 15 minutos";
  if (at.getTime() - now.getTime() > 30 * 24 * 3600_000) return "Como mucho puede durar 30 días";
  return null;
}

/** «Quedan 2 h 10 min», «Quedan 3 días», «Cerrada». */
export function timeLeft(closes: string | Date, now = new Date()): string {
  const ms = new Date(closes).getTime() - now.getTime();
  if (ms <= 0) return "Cerrada";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `Quedan ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) {
    const rest = min % 60;
    return rest ? `Quedan ${h} h ${rest} min` : `Quedan ${h} h`;
  }
  const d = Math.round(h / 24);
  return `Quedan ${d} ${d === 1 ? "día" : "días"}`;
}

export type Outcome = "yes" | "no" | "tie" | "none";

/** Resultado: porcentajes (sobre los votos), participación y quién gana. */
export function results(p: Pick<Poll, "yes" | "no" | "eligible">) {
  const votes = p.yes + p.no;
  const yesPct = votes ? Math.round((p.yes / votes) * 100) : 0;
  const outcome: Outcome = !votes ? "none" : p.yes > p.no ? "yes" : p.no > p.yes ? "no" : "tie";
  return {
    votes,
    yesPct,
    noPct: votes ? 100 - yesPct : 0,
    turnout: p.eligible ? Math.min(100, Math.round((votes / p.eligible) * 100)) : 0,
    outcome,
  };
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  yes: "Gana el SÍ",
  no: "Gana el NO",
  tie: "Empate",
  none: "Nadie votó",
};

/** Texto para compartir el resultado por WhatsApp. */
export function shareText(p: Poll): string {
  const r = results(p);
  const head = p.open ? "🗳️ Votación abierta" : `🗳️ Resultado: ${OUTCOME_LABEL[r.outcome]}`;
  return [
    `${head} · Rayo Vallecañas ⚡`,
    `«${p.question}»`,
    `✅ Sí: ${p.yes} (${r.yesPct} %) · ❌ No: ${p.no} (${r.noPct} %)`,
    `Han votado ${r.votes} de ${p.eligible}.`,
  ].join("\n");
}
