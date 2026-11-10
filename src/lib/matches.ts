/** Fase 4 · Partidos: tipos, etiquetas y utilidades (sin dependencias del servidor). */

export type MatchStatus = "scheduled" | "played" | "postponed" | "cancelled";
export type Competition = "league" | "cup" | "friendly" | "tournament";
export type Outcome = "W" | "D" | "L";

export type Rival = {
  id: string;
  name: string;
  short_name: string | null;
  color: string | null;
  crest_url: string | null;
  home_venue: string | null;
  home_maps_url: string | null;
  notes: string | null;
  ext_id?: string | null; // «futormes:123» si viene de la web de la liga
};

export type Match = {
  id: string;
  match_date: string;
  kickoff: string | null; // "18:30:00"
  season: string;
  competition: Competition;
  round: string | null;
  rival_id: string;
  is_home: boolean;
  venue: string | null;
  maps_url: string | null;
  status: MatchStatus;
  goals_for: number | null;
  goals_against: number | null;
  notes: string | null;
  // Convocatoria (v3.1.0)
  meet_time: string | null;
  meet_place: string | null;
  callup_notes: string | null;
  formation: string | null;
  callup_published_at: string | null;
  callup_reminded_at: string | null;
  ext_id: string | null;
  // Acta (v3.2.0)
  mvp_player_id: string | null;
  report_saved_at: string | null;
  report_by: string | null;
  created_at: string;
  updated_at: string;
};
export type MatchRow = Match & { rival: Rival };

export const STATUS: { key: MatchStatus; label: string }[] = [
  { key: "scheduled", label: "Pendiente" },
  { key: "played", label: "Finalizado" },
  { key: "postponed", label: "Aplazado" },
  { key: "cancelled", label: "Suspendido" },
];
export const MATCH_STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.key, s.label])) as Record<MatchStatus, string>;
export const MATCH_STATUS_TONE: Record<MatchStatus, string> = {
  scheduled: "bg-sky-100 text-sky-800",
  played: "bg-black/10 text-negro/70",
  postponed: "bg-amber-100 text-amber-800",
  cancelled: "bg-rojo/10 text-rojo",
};

export const COMPETITIONS: { key: Competition; label: string; short: string }[] = [
  { key: "league", label: "Liga", short: "Liga" },
  { key: "cup", label: "Copa", short: "Copa" },
  { key: "friendly", label: "Amistoso", short: "Amistoso" },
  { key: "tournament", label: "Torneo", short: "Torneo" },
];
export const COMPETITION_LABEL = Object.fromEntries(COMPETITIONS.map((c) => [c.key, c.label])) as Record<Competition, string>;

export const OUTCOME_LABEL: Record<Outcome, { short: string; long: string }> = {
  W: { short: "V", long: "Victoria" },
  D: { short: "E", long: "Empate" },
  L: { short: "D", long: "Derrota" },
};
export const OUTCOME_TONE: Record<Outcome, string> = {
  W: "bg-green-600 text-white",
  D: "bg-neutral-400 text-negro",
  L: "bg-rojo text-white",
};

export function outcomeOf(m: Pick<Match, "status" | "goals_for" | "goals_against">): Outcome | null {
  if (m.status !== "played" || m.goals_for == null || m.goals_against == null) return null;
  return m.goals_for > m.goals_against ? "W" : m.goals_for < m.goals_against ? "L" : "D";
}

export const CLUB_NAME = "Rayo Vallecañas";
export const CLUB_SHORT = "RVA";

/** Siglas del rival para el marcador: las suyas o las tres primeras letras. */
export const rivalShort = (r: Pick<Rival, "name" | "short_name">) =>
  (r.short_name?.trim() ||
    r.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/^(C\.?\s?D\.?|C\.?\s?F\.?|U\.?\s?D\.?|A\.?\s?D\.?|Club|Atl[eé]tico|Real|Deportivo)\s+/i, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
  ).toUpperCase() || "RIV";

/** Color estable para el escudo genérico de un rival sin escudo. */
export function rivalColor(r: Pick<Rival, "name" | "color">) {
  if (r.color) return r.color;
  const palette = ["#1D4ED8", "#047857", "#7C3AED", "#B45309", "#0E7490", "#BE185D", "#4D7C0F", "#374151"];
  let h = 0;
  for (const c of r.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Local y visitante en el orden en que se escriben ("Rayo Vallecañas – Rival" si jugamos en casa). */
export function sides(m: Pick<Match, "is_home" | "goals_for" | "goals_against">, rival: Pick<Rival, "name">) {
  const us = { name: CLUB_NAME, goals: m.goals_for, us: true };
  const them = { name: rival.name, goals: m.goals_against, us: false };
  return m.is_home ? [us, them] : [them, us];
}

/** "18:30:00" -> "18:30" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

/** Fecha y hora del partido como instante (hora de Madrid). */
export function kickoffDate(m: Pick<Match, "match_date" | "kickoff">): Date {
  const time = m.kickoff ? m.kickoff.slice(0, 5) : "12:00";
  // Desfase de Madrid ese día (CET +1 / CEST +2)
  const guess = new Date(`${m.match_date}T${time}:00Z`);
  const madrid = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (madrid.getTime() - utc.getTime()));
}

/** Hoy en Madrid, "2026-11-06". */
export const todayMadrid = (at: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(at);

const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayLongFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const d = (s: string) => new Date(`${s}T12:00:00Z`);
/** "sáb, 14 nov" */
export const shortDay = (s: string) => dayFmt.format(d(s)).replace(/\./g, "");
/** "sábado, 14 de noviembre" */
export const longDay = (s: string) => dayLongFmt.format(d(s));
/** "noviembre de 2026" */
export const monthLabel = (s: string) => monthFmt.format(d(s));

/** "Hoy", "Mañana", "En 5 días"… */
export function relativeDay(date: string, today = todayMadrid()) {
  const days = Math.round((d(date).getTime() - d(today).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days > 1 && days < 7) return `En ${days} días`;
  if (days < -1 && days > -7) return `Hace ${-days} días`;
  return null;
}

/** Enlace de Google Maps: el que se haya pegado o una búsqueda con el nombre del campo. */
export const mapsLink = (m: Pick<Match, "maps_url" | "venue">) =>
  m.maps_url || (m.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.venue)}` : null);

/** Balance de una lista de partidos. */
export function record(rows: Pick<Match, "status" | "goals_for" | "goals_against">[]) {
  const r = { played: 0, W: 0, D: 0, L: 0, gf: 0, ga: 0, cleanSheets: 0, points: 0 };
  for (const m of rows) {
    const o = outcomeOf(m);
    if (!o) continue;
    r.played++;
    r[o]++;
    r.gf += m.goals_for!;
    r.ga += m.goals_against!;
    if (m.goals_against === 0) r.cleanSheets++;
  }
  r.points = r.W * 3 + r.D;
  return r;
}

/** Últimos resultados (el más reciente al final, como se leen las rachas). */
export function form(rows: MatchRow[], n = 5) {
  return rows
    .filter((m) => outcomeOf(m))
    .sort((a, b) => (a.match_date + (a.kickoff ?? "")).localeCompare(b.match_date + (b.kickoff ?? "")))
    .slice(-n);
}

/** Racha actual: "3 victorias seguidas", "2 partidos sin perder"… */
export function streak(rows: MatchRow[]): string | null {
  const played = form(rows, 99).reverse();
  if (played.length < 2) return null;
  const first = outcomeOf(played[0])!;
  let same = 0;
  for (const m of played) {
    if (outcomeOf(m) === first) same++;
    else break;
  }
  if (same >= 2) return first === "W" ? `${same} victorias seguidas` : first === "D" ? `${same} empates seguidos` : `${same} derrotas seguidas`;
  let unbeaten = 0;
  for (const m of played) {
    if (outcomeOf(m) !== "L") unbeaten++;
    else break;
  }
  if (unbeaten >= 3) return `${unbeaten} partidos sin perder`;
  return null;
}

/** Ordena por fecha y hora. */
export const byKickoff = (a: Match, b: Match) =>
  (a.match_date + (a.kickoff ?? "99")).localeCompare(b.match_date + (b.kickoff ?? "99"));

/** Texto para compartir por WhatsApp. */
export function matchShareText(m: MatchRow) {
  const [a, b] = sides(m, m.rival);
  const when = `${longDay(m.match_date)}${m.kickoff ? ` · ${hhmm(m.kickoff)}` : ""}`;
  const comp = [COMPETITION_LABEL[m.competition], m.round].filter(Boolean).join(" · ");
  if (m.status === "played") {
    const o = outcomeOf(m)!;
    const emoji = o === "W" ? "✅" : o === "D" ? "🤝" : "❌";
    return `⚽ *RESULTADO* ${emoji}\n\n${a.name} *${a.goals}*\n${b.name} *${b.goals}*\n\n🏆 ${comp}\n📅 ${when}\n\n¡Aúpa Rayo! ⚡`;
  }
  return `⚽ *PRÓXIMO PARTIDO*\n\n${a.name} vs ${b.name}\n🏆 ${comp}\n📅 ${when}${m.venue ? `\n📍 ${m.venue}` : ""}${mapsLink(m) ? `\n🗺️ ${mapsLink(m)}` : ""}${m.status !== "scheduled" ? `\n⚠️ ${MATCH_STATUS_LABEL[m.status]}` : ""}\n\n¡Aúpa Rayo! ⚡`;
}
