/**
 * Dónde está cada equipo en la clasificación, para enseñarlo al lado de los partidos.
 * Funciones puras (sin internet ni base de datos) para poder probarlas.
 */
import type { LeagueRow, Outcome, StandingRow, TeamGame } from "./league-parse";

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

/** Racha (últimos 5) y últimos 3 partidos de cada equipo, sacados del calendario de la liga. */
export function teamGames(calendar: LeagueRow[]): { byTeam: Map<string, { form: Outcome[]; last: TeamGame[] }>; round: string | null } {
  const games = calendar.filter((r) => r.status === "played" && r.goalsHome != null && r.goalsAway != null)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const all = new Map<string, TeamGame[]>();
  const add = (team: string, g: TeamGame) => all.set(team, [...(all.get(team) ?? []), g]);
  const res = (f: number, a: number): Outcome => (f > a ? "W" : f < a ? "L" : "D");
  for (const g of games) {
    const h = g.goalsHome!, a = g.goalsAway!;
    add(g.homeId, { date: g.date, round: g.round, home: true, oppId: g.awayId, oppName: g.awayName, gf: h, ga: a, outcome: res(h, a) });
    add(g.awayId, { date: g.date, round: g.round, home: false, oppId: g.homeId, oppName: g.homeName, gf: a, ga: h, outcome: res(a, h) });
  }
  const byTeam = new Map<string, { form: Outcome[]; last: TeamGame[] }>();
  for (const [team, list] of all) byTeam.set(team, { form: list.slice(-5).map((x) => x.outcome), last: list.slice(-3).reverse() });
  return { byTeam, round: games.at(-1)?.round ?? null };
}

/** Goles por partido con una cifra decimal y coma: «2,1». */
export const perGame = (goals: number, played: number) => (played ? (goals / played).toFixed(1).replace(".", ",") : "0");

/**
 * «Qué nos jugamos»: una sola frase con lo que da una victoria. Habla en condicional
 * («podemos») porque los demás también juegan. null si no hay nada que destacar.
 */
export function stakes(rows: StandingRow[], us: string, rival: StandingRow | null, rivalName: string): string | null {
  const me = rows.find((r) => r.teamId === us);
  if (!me || !rows.length) return null;
  const win = me.points + 3;
  const best = 1 + rows.filter((r) => r.teamId !== us && r.points > win).length;
  const last = rows.at(-1)!.pos;
  const zoneOf = (pred: (from: number, to: number) => boolean) => {
    const seen = new Map<string, { label: string; from: number; to: number }>();
    for (const r of rows) {
      if (!r.zone) continue;
      const z = seen.get(r.zone.label);
      if (z) z.to = r.pos; else seen.set(r.zone.label, { label: r.zone.label, from: r.pos, to: r.pos });
    }
    return [...seen.values()].find((z) => pred(z.from, z.to)) ?? null;
  };
  const top = zoneOf((from) => from === 1);
  const bottom = zoneOf((from, to) => to === last && from !== 1);

  if (me.pos === 1) return best === 1 ? "Si ganamos, seguimos líderes" : null;
  if (bottom && me.pos >= bottom.from && best < bottom.from) return "Una victoria nos puede sacar del descenso";
  if (top && me.pos > top.to && best <= top.to) return `Una victoria nos puede meter en zona de ${top.label.toLowerCase().startsWith("ascenso") ? "ascenso" : top.label}`;
  if (best === 1) return "Si ganamos, podemos ser líderes";
  if (rival && rival.pos < me.pos) {
    const gap = rival.points - me.points;
    if (gap < 3) return `Si ganamos, adelantamos a ${rivalName}`;
    if (gap === 3) return `Si ganamos, igualamos a puntos a ${rivalName}`;
  }
  if (best < me.pos) return `Si ganamos, podemos subir al ${ordinal(best)}`;
  if (rival && rival.pos > me.pos && win - rival.points <= 6) return `Si ganamos, le sacamos ${win - rival.points} puntos a ${rivalName}`;
  return null;
}
