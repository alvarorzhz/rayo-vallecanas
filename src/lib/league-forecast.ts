/**
 * 4.25.0 · «¿Subimos?» y «¿Ganamos?»: el resto de la liga se juega 10.000 veces en el ordenador.
 *
 * La fuerza de cada equipo sale de sus goles a favor y en contra (toda la temporada y, con algo
 * de peso, sus últimos 5 partidos). Cada partido que queda se juega sacando los goles de cada
 * equipo al azar (Poisson) según lo que suele marcar uno y encajar el otro. Al final se cuenta en
 * cuántas de las 10.000 ligas acabamos arriba, en medio o abajo.
 *
 * Funciones puras (sin internet ni base de datos) para poder probarlas. El azar lleva semilla
 * sacada de los datos: con la misma clasificación sale siempre lo mismo.
 */
import type { LeagueRow, StandingRow } from "./league-parse";
import { goalState, zones } from "./league-outlook.ts";

export const SIMS = 10_000;
/** Partidos «de mentira» con la media de la liga que se suman a cada equipo, para que 2 jornadas no manden demasiado. */
const PRIOR = 4;
/** Peso de los últimos 5 partidos frente a toda la temporada. */
const FORM_WEIGHT = 0.3;
const FORM_GAMES = 5;
/** Las diferencias entre equipos se suavizan un poco (en aficionados hay más sorpresas de las que dicen los goles). */
const DAMP = 0.8;
/** Duda sobre la fuerza de cada equipo: en cada liga simulada, cada equipo está un poco mejor o peor (±25 % aprox.). */
const NOISE = 0.25;

export type MatchOdds = { win: number; draw: number; loss: number };

export type Fixture = MatchOdds & { oppId: string; oppName: string; date: string; home: boolean; round: string };

export type Forecast = {
  sims: number;
  teams: number;
  /** Cuántos suben y cuántos bajan. */
  upN: number;
  downN: number;
  upLabel: string | null;
  downLabel: string | null;
  /** Probabilidades de 0 a 1. */
  pUp: number;
  pMid: number;
  pDown: number;
  pFirst: number;
  /** Ya seguro (pase lo que pase) o ya imposible, según las cuentas de «Lo que queda». */
  upSure: boolean;
  upGone: boolean;
  downSure: boolean;
  downGone: boolean;
  likelyPos: number;
  /** posDist[i] = probabilidad de acabar en el puesto i+1. */
  posDist: number[];
  /** Cambio de la probabilidad de subir (en puntos de %) desde antes de nuestra última jornada. */
  delta: number | null;
  lastGame: { oppName: string; gf: number; ga: number; round: string } | null;
  /** Próximo partido: cómo puede ir y cómo quedaría la probabilidad de subir según lo que pase. */
  next: (Fixture & { ifWin: number; ifDraw: number; ifLoss: number }) | null;
  /** Todos los partidos que nos quedan, con sus probabilidades. */
  fixtures: Fixture[];
};

/** Azar con semilla (mulberry32): mismo dato, mismo resultado. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Goles al azar con media `lambda` (Poisson, método de Knuth). */
export function poisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

function pmf(lambda: number, max: number): number[] {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) out.push((out[k - 1] * lambda) / k);
  return out;
}

/** Probabilidad exacta de ganar, empatar o perder con esas medias de goles. */
export function matchOdds(lambdaFor: number, lambdaAgainst: number): MatchOdds {
  const max = 40;
  const a = pmf(lambdaFor, max), b = pmf(lambdaAgainst, max);
  let win = 0, draw = 0, loss = 0;
  for (let i = 0; i <= max; i++) for (let j = 0; j <= max; j++) {
    const p = a[i] * b[j];
    if (i > j) win += p; else if (i === j) draw += p; else loss += p;
  }
  const t = win + draw + loss;
  return { win: win / t, draw: draw / t, loss: loss / t };
}

type Team = { id: string; points: number; gf: number; ga: number; played: number };
type Game = { home: string; away: string; gh: number; ga: number; date: string; round: string };

const played = (calendar: LeagueRow[]): Game[] =>
  calendar.filter((r) => r.status === "played" && r.goalsHome != null && r.goalsAway != null)
    .map((r) => ({ home: r.homeId, away: r.awayId, gh: r.goalsHome!, ga: r.goalsAway!, date: r.date + (r.time ?? ""), round: r.round }))
    .sort((x, y) => x.date.localeCompare(y.date));

/** Lo que marca y encaja cada equipo por partido, mezclando temporada y racha, con la media de la liga como colchón. */
export function strengths(teams: Team[], games: Game[]): { mu: number; att: Map<string, number>; def: Map<string, number> } {
  const totalGames = teams.reduce((s, t) => s + t.played, 0);
  const totalGoals = teams.reduce((s, t) => s + t.gf, 0);
  const mu = totalGames > 0 && totalGoals > 0 ? totalGoals / totalGames : 3;
  const shrink = (goals: number, n: number) => (goals + PRIOR * mu) / (n + PRIOR);
  const att = new Map<string, number>(), def = new Map<string, number>();
  for (const t of teams) {
    const recent = games.filter((g) => g.home === t.id || g.away === t.id).slice(-FORM_GAMES);
    const rf = recent.reduce((s, g) => s + (g.home === t.id ? g.gh : g.ga), 0);
    const ra = recent.reduce((s, g) => s + (g.home === t.id ? g.ga : g.gh), 0);
    att.set(t.id, (1 - FORM_WEIGHT) * shrink(t.gf, t.played) + FORM_WEIGHT * shrink(rf, recent.length));
    def.set(t.id, (1 - FORM_WEIGHT) * shrink(t.ga, t.played) + FORM_WEIGHT * shrink(ra, recent.length));
  }
  return { mu, att, def };
}

/** Goles esperados de `a` contra `b`: lo que suele marcar a por lo que suele encajar b, sobre la media. Mínimo 0,15. */
const goals = (mu: number, att: number, def: number) => Math.max(0.15, mu * Math.pow(att / mu, DAMP) * Math.pow(def / mu, DAMP));
const expected = (s: ReturnType<typeof strengths>, a: string, b: string) => goals(s.mu, s.att.get(a) ?? s.mu, s.def.get(b) ?? s.mu);

type Remaining = { home: string; away: string; homeName: string; awayName: string; date: string; round: string };

type SimResult = { pos: number[]; byNext: { W: number[]; D: number[]; L: number[] } | null; first: number };

/** Juega lo que queda `sims` veces y cuenta en qué puesto acabamos (y, si hay próximo partido, según cómo acabe). */
function simulate(teams: Team[], games: Game[], left: Remaining[], us: string, nextIdx: number, sims: number, seed: number): SimResult {
  const s = strengths(teams, games);
  const n = teams.length;
  const idx = new Map(teams.map((t, i) => [t.id, i]));
  const fx = left.map((f) => [idx.get(f.home) ?? -1, idx.get(f.away) ?? -1] as const);
  // Fuerzas ya suavizadas: goles = media · A(atacante) · D(defensor); el azar de cada liga multiplica A y D
  const A = teams.map((t) => Math.pow((s.att.get(t.id) ?? s.mu) / s.mu, DAMP)), D = teams.map((t) => Math.pow((s.def.get(t.id) ?? s.mu) / s.mu, DAMP));
  const sd = NOISE * DAMP;
  const rand = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const fa = new Float64Array(n), fd = new Float64Array(n);
  const pos = new Array(n).fill(0);
  const byNext = nextIdx >= 0 ? { W: new Array(n).fill(0), D: new Array(n).fill(0), L: new Array(n).fill(0) } : null;
  const pts = new Float64Array(n), gd = new Float64Array(n), gf = new Float64Array(n), tie = new Float64Array(n);
  const order = teams.map((_, i) => i);
  const me = idx.get(us)!;
  let first = 0;
  for (let k = 0; k < sims; k++) {
    for (let i = 0; i < n; i++) {
      pts[i] = teams[i].points; gd[i] = teams[i].gf - teams[i].ga; gf[i] = teams[i].gf; tie[i] = rand();
      fa[i] = A[i] * Math.exp(sd * gauss()); fd[i] = D[i] * Math.exp(sd * gauss());
    }
    let nextOutcome: "W" | "D" | "L" = "D";
    for (let j = 0; j < left.length; j++) {
      const [h, a] = fx[j];
      if (h < 0 || a < 0) continue;
      const x = poisson(Math.max(0.15, s.mu * fa[h] * fd[a]), rand), y = poisson(Math.max(0.15, s.mu * fa[a] * fd[h]), rand);
      gd[h] += x - y; gd[a] += y - x; gf[h] += x; gf[a] += y;
      if (x > y) pts[h] += 3; else if (x < y) pts[a] += 3; else { pts[h] += 1; pts[a] += 1; }
      if (j === nextIdx) {
        const mine = left[j].home === us ? x - y : y - x;
        nextOutcome = mine > 0 ? "W" : mine < 0 ? "L" : "D";
      }
    }
    order.sort((i, j) => pts[j] - pts[i] || gd[j] - gd[i] || gf[j] - gf[i] || tie[j] - tie[i]);
    let p = 0;
    while (order[p] !== me) p++;
    pos[p]++;
    if (p === 0) first++;
    if (byNext) byNext[nextOutcome][p]++;
  }
  return { pos, byNext, first };
}

const share = (list: number[], from: number, to: number) => {
  const tot = list.reduce((a, b) => a + b, 0);
  return tot ? list.slice(from, to).reduce((a, b) => a + b, 0) / tot : 0;
};

function remaining(calendar: LeagueRow[]): Remaining[] {
  return calendar.filter((r) => r.status === "scheduled" || r.status === "postponed")
    .map((r) => ({ home: r.homeId, away: r.awayId, homeName: r.homeName, awayName: r.awayName, date: r.date + (r.time ?? ""), round: r.round }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Previsión de la liga para nosotros. null si no hay datos suficientes (no estamos en la tabla,
 * no se pudo leer el calendario o ya no nos queda ningún partido).
 */
export function leagueForecast(rows: StandingRow[], calendar: LeagueRow[], us: string, sims = SIMS): Forecast | null {
  if (rows.length < 3 || !calendar.length || !rows.some((r) => r.teamId === us)) return null;
  const teams: Team[] = rows.map((r) => ({ id: r.teamId, points: r.points, gf: r.gf, ga: r.ga, played: r.played }));
  const games = played(calendar);
  const left = remaining(calendar).filter((f) => teams.some((t) => t.id === f.home) && teams.some((t) => t.id === f.away));
  const nextIdx = left.findIndex((f) => f.home === us || f.away === us);
  if (nextIdx < 0) return null;

  const n = teams.length;
  const z = zones(rows);
  const upN = z.up, downN = z.down;
  const seed = hash(`${us}|${rows.map((r) => `${r.teamId}:${r.points}:${r.gf}:${r.ga}`).join(",")}|${left.length}`);
  const sim = simulate(teams, games, left, us, nextIdx, sims, seed);
  const pUp = share(sim.pos, 0, upN);
  const pDown = downN ? share(sim.pos, n - downN, n) : 0;

  // Seguro o imposible de verdad (mismas cuentas que «Lo que queda»)
  const leftBy = new Map<string, number>();
  for (const f of left) for (const t of [f.home, f.away]) leftBy.set(t, (leftBy.get(t) ?? 0) + 1);
  const me = teams.find((t) => t.id === us)!;
  const mine = { points: me.points, left: leftBy.get(us) ?? 0 };
  const others = teams.filter((t) => t.id !== us).map((t) => ({ points: t.points, left: leftBy.get(t.id) ?? 0 }));
  const up = goalState(mine, others, upN);
  const safe = downN ? goalState(mine, others, n - downN) : { state: "hecho" as const };

  // Cómo estábamos antes de nuestra última jornada (se deshacen los partidos de esa jornada)
  let delta: number | null = null;
  let lastGame: Forecast["lastGame"] = null;
  const ours = games.filter((g) => g.home === us || g.away === us);
  const lg = ours.at(-1);
  if (lg) {
    const homeUs = lg.home === us;
    const oppId = homeUs ? lg.away : lg.home;
    const opp = calendar.find((r) => r.homeId === oppId)?.homeName ?? calendar.find((r) => r.awayId === oppId)?.awayName ?? "";
    lastGame = { oppName: rows.find((r) => r.teamId === oppId)?.name ?? opp, gf: homeUs ? lg.gh : lg.ga, ga: homeUs ? lg.ga : lg.gh, round: lg.round };
    const undo = games.filter((g) => g.round === lg.round);
    const back = teams.map((t) => ({ ...t }));
    const byId = new Map(back.map((t) => [t.id, t]));
    for (const g of undo) {
      const h = byId.get(g.home), a = byId.get(g.away);
      if (!h || !a) continue;
      h.played--; a.played--; h.gf -= g.gh; h.ga -= g.ga; a.gf -= g.ga; a.ga -= g.gh;
      if (g.gh > g.ga) h.points -= 3; else if (g.gh < g.ga) a.points -= 3; else { h.points -= 1; a.points -= 1; }
    }
    if (back.every((t) => t.played >= 0)) {
      const leftBefore = [...undo.map((g) => ({ home: g.home, away: g.away, homeName: "", awayName: "", date: g.date, round: g.round })), ...left];
      const before = simulate(back, games.filter((g) => g.round !== lg.round), leftBefore, us, -1, sims, seed ^ 0x9e3779b9);
      delta = Math.round((pUp - share(before.pos, 0, upN)) * 100);
    }
  }

  // Próximo partido y el resto de los nuestros
  const s = strengths(teams, games);
  const fixtures: Fixture[] = left.filter((f) => f.home === us || f.away === us).map((f) => {
    const home = f.home === us;
    const oppId = home ? f.away : f.home;
    return {
      oppId, oppName: rows.find((r) => r.teamId === oppId)?.name ?? (home ? f.awayName : f.homeName),
      date: f.date.slice(0, 10), round: f.round, home,
      ...matchOdds(expected(s, us, oppId), expected(s, oppId, us)),
    };
  });
  const nb = sim.byNext!;
  const tot = (l: number[]) => l.reduce((a, b) => a + b, 0) / sims;
  // Victoria/empate/derrota del próximo, de las mismas ligas simuladas (así cuadra con «si ganamos…»)
  const next = { ...fixtures[0], win: tot(nb.W), draw: tot(nb.D), loss: tot(nb.L), ifWin: share(nb.W, 0, upN), ifDraw: share(nb.D, 0, upN), ifLoss: share(nb.L, 0, upN) };

  const posDist = sim.pos.map((c) => c / sims);
  const likelyPos = posDist.indexOf(Math.max(...posDist)) + 1;
  return {
    sims, teams: n, upN, downN, upLabel: z.upLabel, downLabel: z.downLabel,
    pUp, pDown, pMid: Math.max(0, 1 - pUp - pDown), pFirst: sim.first / sims,
    upSure: up.state === "hecho", upGone: up.state === "imposible",
    downSure: safe.state === "imposible", downGone: safe.state === "hecho",
    likelyPos, posDist, delta, lastGame, next, fixtures,
  };
}

/** «63 %», sin decir nunca 0 o 100 si aún no es seguro: «<1 %» y «>99 %». */
export function pct(p: number, sure = false, gone = false): string {
  if (sure) return "100 %";
  if (gone) return "0 %";
  const v = Math.round(p * 100);
  if (v >= 100) return ">99 %";
  if (v <= 0) return "<1 %";
  return `${v} %`;
}

/** Probabilidades de un partido nuestro contra `oppId` (el próximo, con las cifras de la simulación). */
export function oddsFor(f: Forecast | null, oppId: string | null | undefined, date?: string): Fixture | null {
  if (!f || !oppId) return null;
  if (f.next && f.next.oppId === oppId && (!date || f.next.date === date)) return f.next;
  const list = f.fixtures.filter((x) => x.oppId === oppId);
  return (date ? list.find((x) => x.date === date) : null) ?? list[0] ?? null;
}

/** «▲12», «▼5» o null si no ha cambiado (o no hay con qué comparar). */
export function deltaLabel(d: number | null): { text: string; up: boolean } | null {
  if (d == null || d === 0) return null;
  return { text: `${d > 0 ? "▲" : "▼"}${Math.abs(d)}`, up: d > 0 };
}
