/**
 * 4.20.0 · Rachas del jugador en la temporada (para su ficha, debajo de Logros).
 * Cálculo puro a partir de sus partidos y convocatorias, del más reciente al más antiguo.
 */

/** Racha en marcha (desde el último partido hacia atrás) y la mejor de la lista. */
export function runOf(hits: boolean[]): { current: number; best: number } {
  let current = 0;
  while (current < hits.length && hits[current]) current++;
  let best = 0, run = 0;
  for (const h of hits) {
    run = h ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best };
}

export type StreakGame = {
  goals: number;
  yellows: number;
  red: boolean;
  goalkeeper: boolean;
  conceded: number;
  /** Goles del equipo y del rival en ese partido. */
  gf: number | null;
  ga: number | null;
};

export type Streak = { key: string; label: string; current: number; best: number; live: boolean };

/** Solo cuentan las rachas de 3 o más. Primero las que están en marcha y, dentro, las más largas. */
export const MIN_STREAK = 3;

export function streaks(games: StreakGame[], replies: ("yes" | "no" | "maybe" | "pending" | string)[], gk: boolean): Streak[] {
  const withScore = games.filter((g) => g.gf != null && g.ga != null);
  const defs: [string, string, boolean[]][] = [
    ["goals", "Partidos seguidos marcando", games.map((g) => g.goals > 0)],
    ["wins", "Victorias seguidas con él en el campo", withScore.map((g) => g.gf! > g.ga!)],
    ["unbeaten", "Partidos sin perder con él en el campo", withScore.map((g) => g.gf! >= g.ga!)],
    ["clean", "Porterías a cero seguidas", games.filter((g) => g.goalkeeper).map((g) => g.conceded === 0)],
    ["voy", "Convocatorias seguidas diciendo «Voy»", replies.map((r) => r === "yes")],
    ["cards", "Partidos seguidos sin tarjetas", games.map((g) => g.yellows === 0 && !g.red)],
  ];
  const out: Streak[] = [];
  for (const [key, label, hits] of defs) {
    if (key === "goals" && gk) continue;
    if (key === "clean" && !gk) continue;
    const { current, best } = runOf(hits);
    if (best < MIN_STREAK) continue;
    // «Sin perder» no se enseña si dice lo mismo que «victorias seguidas»
    if (key === "unbeaten" && out.some((s) => s.key === "wins" && s.current === current && s.best === best)) continue;
    out.push({ key, label, current, best, live: current >= MIN_STREAK });
  }
  return out.sort((a, b) => Number(b.live) - Number(a.live) || (b.live ? b.current - a.current : b.best - a.best));
}
