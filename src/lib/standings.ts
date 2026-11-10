/**
 * Dónde está cada equipo en la clasificación, para enseñarlo al lado de los partidos.
 * Funciones puras (sin internet ni base de datos) para poder probarlas.
 */
import type { StandingRow } from "./league-parse";

export type Rank = StandingRow & { total: number };
export type MatchRanks = { us: Rank | null; rival: Rank | null };

type RivalLike = { name: string; ext_id?: string | null };
type MatchLike = { id: string; competition: string; status: string; season: string; rival: RivalLike };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Fila de la clasificación de un rival: por su id de la web de la liga y, si no lo tiene, por el nombre. */
export function rivalRow(rows: StandingRow[], rival: RivalLike): StandingRow | null {
  const ext = rival.ext_id?.startsWith("futormes:") ? rival.ext_id.slice(9) : null;
  if (ext) {
    const r = rows.find((x) => x.teamId === ext);
    if (r) return r;
  }
  const n = norm(rival.name);
  return n ? rows.find((x) => norm(x.name) === n) ?? null : null;
}

const withTotal = (r: StandingRow | null | undefined, total: number): Rank | null => (r ? { ...r, total } : null);

/**
 * Posición y puntos de los dos equipos para los partidos de liga de la temporada
 * actual que aún no se han jugado (la tabla de hoy no dice nada de partidos ya jugados).
 */
export function matchRanks(rows: StandingRow[], us: string, matches: MatchLike[], season: string): Map<string, MatchRanks> {
  const out = new Map<string, MatchRanks>();
  if (!rows.length) return out;
  const me = withTotal(rows.find((r) => r.teamId === us), rows.length);
  for (const m of matches) {
    if (m.competition !== "league" || m.season !== season || m.status === "played" || m.status === "cancelled") continue;
    const rival = withTotal(rivalRow(rows, m.rival), rows.length);
    if (rival || me) out.set(m.id, { us: me, rival });
  }
  return out;
}

export const ordinal = (n: number) => `${n}º`;
export const pts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

/** «Les sacamos 3 puntos», «Nos sacan 1 punto», «Empatados a puntos». */
export function gapLabel(us: Rank | null, rival: Rank | null): string | null {
  if (!us || !rival) return null;
  const d = us.points - rival.points;
  const p = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;
  if (d === 0) return "Empatados a puntos";
  return d > 0 ? `Les sacamos ${p(d)}` : `Nos sacan ${p(-d)}`;
}
