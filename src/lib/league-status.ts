/**
 * Estado de la sincronización con la liga: textos de los avisos y lo que se enseña
 * en pantalla. Sin dependencias, para poder probarlo.
 */

export type LeagueStatus = "ok" | "partial" | "failed";
export type LeagueAlertSource = "sync" | "health";

/** Firma de un problema: igual si las incidencias son las mismas (sin contar los números, que cambian solos). */
export const problemSignature = (status: LeagueStatus, issues: string[]) =>
  `${status}|${[...new Set(issues.map((i) => i.replace(/\d+/g, "#")))].sort().join("|")}`;

/** Título y texto del aviso al móvil. */
export function alertText(status: Exclude<LeagueStatus, "ok">, issues: string[], source: LeagueAlertSource) {
  const title =
    status === "failed"
      ? source === "health" ? "❌ La web de la liga no se puede leer" : "❌ Ha fallado la sincronización con la liga"
      : source === "health" ? "⚠️ La web de la liga ha cambiado" : "⚠️ Sincronización con la liga incompleta";
  const more = issues.length > 1 ? ` (y ${issues.length - 1} ${issues.length === 2 ? "aviso" : "avisos"} más)` : "";
  const first = (issues[0] ?? "Sin detalles").replace(/\.$/, "");
  return { title, body: `${first.length > 140 ? `${first.slice(0, 139)}…` : first}${more}. Mira Partidos → Liga.` };
}

type Health = { status: LeagueStatus; issues: string[]; at: string; finished?: boolean };
/** Competición siguiente que la app ha encontrado sola al terminar la actual. */
export type NextLeague = { competition: string; name: string; matches: number; at: string };
export type StoredSummary = {
  status?: LeagueStatus; issues?: string[]; at?: string; failedAt?: string; health?: Health;
  matchesNew?: number; matchesUpdated?: number; rivalsNew?: number; results?: number;
  matches?: number; played?: number; players?: number; playersNew?: number;
  finished?: boolean; next?: NextLeague;
} | null;

/** ¿Ha terminado la competición? Manda lo más reciente entre la sincronización y la revisión semanal. */
export function leagueOver(s: StoredSummary): boolean {
  if (!s) return false;
  const seen = [{ at: s.at ?? "", finished: s.finished }, { at: s.health?.at ?? "", finished: s.health?.finished }]
    .filter((e) => e.at && e.finished != null).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return !!seen?.finished;
}

/** Aviso al móvil cuando la app encuentra la liga siguiente. */
export const nextLeagueText = (name: string) => ({
  title: "🏆 Hay liga nueva en futormes",
  body: `El Rayo aparece en «${name.length > 90 ? `${name.slice(0, 89)}…` : name}». Entra en Partidos → Liga para cambiarla.`,
});

/** Resumen en una frase de lo que cambió en la última sincronización. */
export function changesText(s: NonNullable<StoredSummary>): string {
  const n = (v: number | undefined, one: string, many: string) => (v ? `${v} ${v === 1 ? one : many}` : "");
  const bits = [
    n(s.matchesNew, "partido nuevo", "partidos nuevos"), n(s.matchesUpdated, "partido actualizado", "partidos actualizados"),
    n(s.results, "resultado", "resultados"), n(s.rivalsNew, "rival nuevo", "rivales nuevos"), n(s.playersNew, "jugador nuevo", "jugadores nuevos"),
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : "sin cambios";
}

export type LeagueProblem = { status: Exclude<LeagueStatus, "ok">; issues: string[]; at: string; source: LeagueAlertSource };

/**
 * El problema que hay que enseñar, o null si todo va bien. Manda lo más reciente:
 * una sincronización buena después de la revisión semanal la tapa, y al revés.
 */
export function currentProblem(s: StoredSummary): LeagueProblem | null {
  if (!s) return null;
  const events: { status: LeagueStatus; issues: string[]; at: string; source: LeagueAlertSource }[] = [];
  if (s.status) events.push({ status: s.status, issues: s.issues ?? [], at: s.failedAt ?? s.at ?? "", source: "sync" });
  if (s.health) events.push({ status: s.health.status, issues: s.health.issues ?? [], at: s.health.at, source: "health" });
  const last = events.sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return last && last.status !== "ok" ? { ...last, status: last.status as LeagueProblem["status"] } : null;
}
