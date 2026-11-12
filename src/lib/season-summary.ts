/**
 * Resumen de temporada (o de una competición, como el Apertura) de un jugador, a partir de las actas.
 * Puro, con pruebas: las consultas están en season-summary-queries.ts.
 */

export type SumMatch = {
  id: string; match_date: string; status: string; goals_for: number | null; goals_against: number | null;
  mvp_player_id: string | null; rival: string; is_home: boolean;
};
export type SumApp = { match_id: string; player_id: string; goalkeeper: boolean; conceded: number; yellows: number; red: boolean };
export type SumGoal = { match_id: string; scorer_id: string | null; assist_id: string | null };
export type SumCallup = { match_id: string; player_id: string; reply: string };

export type BestMatch = { match: SumMatch; goals: number; assists: number; mvp: boolean; score: number };

export type PlayerSummary = {
  apps: number; goals: number; assists: number; mvps: number; yellows: number; reds: number;
  /** Portero: partidos de portero, goles encajados y porterías a cero. */
  gkApps: number; conceded: number; cleanSheets: number;
  /** Convocatorias: veces convocado y veces que dijo «Voy». */
  called: number; said_yes: number;
  /** Partidos que ganó el equipo con él en el campo. */
  wins: number;
  best: BestMatch | null;
  /** Puesto en el equipo (1 = el que más), null si no tiene ninguno. */
  goalsRank: number | null; assistsRank: number | null; appsRank: number | null;
  /** Título del resumen («Pichichi», «El Muro»…). */
  badge: { title: string; line: string };
};

export type TeamSummary = { played: number; W: number; D: number; L: number; gf: number; ga: number };

const outcome = (m: SumMatch) => (m.goals_for! > m.goals_against! ? "W" : m.goals_for! < m.goals_against! ? "L" : "D");

export function teamSummary(matches: SumMatch[]): TeamSummary {
  const played = matches.filter((m) => m.status === "played" && m.goals_for != null && m.goals_against != null);
  const t = { played: played.length, W: 0, D: 0, L: 0, gf: 0, ga: 0 };
  for (const m of played) {
    t[outcome(m)]++;
    t.gf += m.goals_for!;
    t.ga += m.goals_against!;
  }
  return t;
}

/** Puesto (competición estándar: 1, 2, 2, 4) del jugador en una tabla de valores; null si tiene 0. */
function rankOf(values: Map<string, number>, id: string): number | null {
  const v = values.get(id) ?? 0;
  if (v <= 0) return null;
  return 1 + [...values.values()].filter((x) => x > v).length;
}

const count = <T,>(rows: T[], key: (r: T) => string | null) => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

export function playerSummary(playerId: string, data: { matches: SumMatch[]; apps: SumApp[]; goals: SumGoal[]; callups: SumCallup[] }): PlayerSummary {
  const played = data.matches.filter((m) => m.status === "played" && m.goals_for != null && m.goals_against != null);
  const ids = new Set(played.map((m) => m.id));
  const byId = new Map(played.map((m) => [m.id, m]));
  const apps = data.apps.filter((a) => ids.has(a.match_id));
  const goals = data.goals.filter((g) => ids.has(g.match_id));
  const mine = apps.filter((a) => a.player_id === playerId);
  const myGoals = goals.filter((g) => g.scorer_id === playerId);
  const myAssists = goals.filter((g) => g.assist_id === playerId);
  const gk = mine.filter((a) => a.goalkeeper);
  const callups = data.callups.filter((c) => c.player_id === playerId && byId.has(c.match_id));

  let best: BestMatch | null = null;
  for (const a of mine) {
    const m = byId.get(a.match_id)!;
    const g = myGoals.filter((x) => x.match_id === m.id).length;
    const as = myAssists.filter((x) => x.match_id === m.id).length;
    const mvp = m.mvp_player_id === playerId;
    // Goles, asistencias y MVP; a igualdad, el partido ganado de más diferencia
    const score = g * 3 + as * 2 + (mvp ? 4 : 0) + (outcome(m) === "W" ? 1 : 0) + (m.goals_for! - m.goals_against!) * 0.01;
    if (!best || score > best.score) best = { match: m, goals: g, assists: as, mvp, score };
  }

  const s = {
    apps: mine.length,
    goals: myGoals.length,
    assists: myAssists.length,
    mvps: played.filter((m) => m.mvp_player_id === playerId).length,
    yellows: mine.reduce((n, a) => n + a.yellows, 0),
    reds: mine.filter((a) => a.red).length,
    gkApps: gk.length,
    conceded: gk.reduce((n, a) => n + a.conceded, 0),
    cleanSheets: gk.filter((a) => a.conceded === 0).length,
    called: callups.length,
    said_yes: callups.filter((c) => c.reply === "yes").length,
    wins: mine.filter((a) => outcome(byId.get(a.match_id)!) === "W").length,
    best,
    goalsRank: rankOf(count(goals, (g) => g.scorer_id), playerId),
    assistsRank: rankOf(count(goals, (g) => g.assist_id), playerId),
    appsRank: rankOf(count(apps, (a) => a.player_id), playerId),
  };
  return { ...s, badge: badgeOf(s, played.length) };
}

/** El título del resumen: lo más destacado del jugador, con aire futbolero. */
export function badgeOf(s: Omit<PlayerSummary, "badge">, played: number): { title: string; line: string } {
  const g = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (s.goalsRank === 1 && s.goals >= 2) return { title: "Pichichi", line: `Máximo goleador del equipo con ${g(s.goals, "gol", "goles")}` };
  if (s.mvps >= 2) return { title: "Estrella", line: `${s.mvps} veces MVP elegido por el equipo` };
  if (s.assistsRank === 1 && s.assists >= 2) return { title: "El Asistente", line: `Nadie dio más pases de gol: ${s.assists}` };
  if (s.gkApps >= 2 && s.cleanSheets >= 1) return { title: "El Muro", line: `${g(s.cleanSheets, "portería a cero", "porterías a cero")} bajo palos` };
  if (s.gkApps >= 2) return { title: "Bajo palos", line: `${g(s.gkApps, "partido", "partidos")} defendiendo la portería` };
  if (played > 0 && s.apps === played) return { title: "Fijo", line: `Jugó los ${played} partidos` };
  if (s.goals + s.assists >= 3) return { title: "Dinamita", line: `${s.goals} goles y ${s.assists} asistencias` };
  if (s.called >= 3 && s.said_yes === s.called) return { title: "Siempre está", line: `Dijo «Voy» a las ${s.called} convocatorias` };
  if (s.wins >= 3) return { title: "Talismán", line: `${s.wins} victorias con él en el campo` };
  if (s.apps > 0) return { title: "Del Rayo", line: `${g(s.apps, "partido", "partidos")} defendiendo la camiseta` };
  return { title: "Del Rayo", line: "Esta vez le tocó animar desde la banda" };
}
