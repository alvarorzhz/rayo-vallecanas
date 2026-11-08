/** Especial Matchday (v3.5.0, ampliado en v3.6.0): la portada de Inicio según el momento del partido. Sin dependencias del servidor. */
import { kickoffDate, todayMadrid, type MatchRow } from "@/lib/matches";

/**
 * - eve: la víspera («Mañana jugamos»).
 * - day: el día del partido, antes del pitido inicial.
 * - live: ya ha empezado y aún no hay resultado.
 * - final: el partido de hoy ya tiene resultado.
 * - post: post partido, el resultado se queda en portada los dos días siguientes.
 * - week: semana normal, falta más de un día para el próximo partido (no la devuelve matchdayPhase).
 */
export type MatchdayPhase = "eve" | "day" | "live" | "final" | "post" | "week";

/** Días que el resultado se queda en portada después del partido. */
export const POST_DAYS = 2;

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
    return m.match_date < today && m.match_date >= addDays(today, -POST_DAYS) ? "post" : null;
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
