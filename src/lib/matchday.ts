/** Especial Matchday (v3.5.0, ampliado en v3.6.0): la portada de Inicio según el momento del partido. Sin dependencias del servidor. */
import { kickoffDate, todayMadrid, type MatchRow } from "./matches.ts";

/**
 * - eve: la víspera («Mañana jugamos»).
 * - day: el día del partido, antes del pitido inicial.
 * - live: ya ha empezado y aún no hay resultado.
 * - final: el partido de hoy ya tiene resultado.
 * - post: post partido, el resultado se queda en portada hasta 24 horas después de acabar el partido.
 * - week: semana normal, falta más de un día para el próximo partido (no la devuelve matchdayPhase).
 */
export type MatchdayPhase = "eve" | "day" | "live" | "final" | "post" | "week";

/** Días hacia atrás en los que puede caer un post partido (para la consulta). */
export const POST_DAYS = 1;
/** Horas que el resultado se queda en portada después de acabar el partido (v3.24.0). */
const POST_HOURS = 24;
/** Lo que damos por duración del partido, desde el pitido inicial, para saber cuándo acabó. */
const MATCH_MS = 2 * 3600_000;

/** Hasta cuándo se queda el resultado en portada: 24 horas después de acabar (sin hora, se cuenta desde las 14:00). */
function postUntil(m: Pick<MatchRow, "match_date" | "kickoff">): Date {
  return new Date(kickoffDate(m).getTime() + MATCH_MS + POST_HOURS * 3600_000);
}

/** "2026-11-08" + n días */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function matchdayPhase(m: Pick<MatchRow, "match_date" | "kickoff" | "status">, now: Date = new Date()): MatchdayPhase | null {
  const today = todayMadrid(now);
  if (m.status === "played") {
    if (m.match_date === today) return "final";
    return m.match_date < today && now.getTime() < postUntil(m).getTime() ? "post" : null;
  }
  if (m.status !== "scheduled") return null;
  if (m.match_date === addDays(today, 1)) return "eve";
  if (m.match_date !== today) return null;
  return m.kickoff && kickoffDate(m).getTime() <= now.getTime() ? "live" : "day";
}

export const PHASE_TITLE: Record<MatchdayPhase, string> = {
  eve: "Mañana jugamos",
  day: "Matchday",
  live: "En juego",
  final: "Final",
  post: "Post partido",
  week: "Próximo partido",
};
