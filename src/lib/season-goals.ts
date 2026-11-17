/**
 * 4.20.0 · Objetivos de temporada: qué se puede elegir y cómo va cada uno.
 * Cálculo puro (sin base de datos) para poder probarlo.
 */
import { runOf } from "./streaks.ts";

export type GoalKind = "position" | "goals_for" | "wins" | "win_streak" | "unbeaten_streak" | "clean_sheets" | "all_play";
export type SeasonGoal = { id: string; season: string; kind: GoalKind; target: number; sort: number; achieved_at: string | null };

export const GOAL_KINDS: { kind: GoalKind; label: string; ask: string; needsTarget: boolean; default: number }[] = [
  { kind: "position", label: "Acabar entre los primeros de la liga", ask: "¿Entre los cuántos primeros?", needsTarget: true, default: 3 },
  { kind: "goals_for", label: "Goles a favor", ask: "¿Cuántos goles?", needsTarget: true, default: 30 },
  { kind: "wins", label: "Victorias", ask: "¿Cuántas victorias?", needsTarget: true, default: 8 },
  { kind: "win_streak", label: "Victorias seguidas", ask: "¿Cuántas seguidas?", needsTarget: true, default: 5 },
  { kind: "unbeaten_streak", label: "Partidos seguidos sin perder", ask: "¿Cuántos seguidos?", needsTarget: true, default: 6 },
  { kind: "clean_sheets", label: "Porterías a cero", ask: "¿Cuántas?", needsTarget: true, default: 4 },
  { kind: "all_play", label: "Que juegue toda la plantilla", ask: "", needsTarget: false, default: 1 },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Título del objetivo: «30 goles a favor», «Acabar entre los 3 primeros»… */
export function goalTitle(kind: GoalKind, target: number): string {
  switch (kind) {
    case "position": return target === 1 ? "Ser campeones de liga" : `Acabar entre los ${target} primeros`;
    case "goals_for": return `${plural(target, "gol", "goles")} a favor`;
    case "wins": return plural(target, "victoria", "victorias");
    case "win_streak": return `${target} victorias seguidas`;
    case "unbeaten_streak": return `${target} partidos seguidos sin perder`;
    case "clean_sheets": return plural(target, "portería a cero", "porterías a cero");
    case "all_play": return "Que juegue toda la plantilla";
  }
}

export type GoalFacts = {
  /** Partidos jugados de la temporada, del más antiguo al más reciente. */
  matches: { gf: number | null; ga: number | null }[];
  /** Jugadores de la plantilla (sin los que se han ido) y cuántos han jugado algún partido. */
  squad: number;
  squadPlayed: number;
  /** Puesto en la liga y, para cada «entre los N primeros», si ya está asegurado. */
  league: { pos: number; total: number; secured: (top: number) => boolean; finished: boolean } | null;
};

export type GoalProgress = { value: number; target: number; pct: number; done: boolean; now: string; hint: string | null };

export function goalProgress(kind: GoalKind, target: number, f: GoalFacts): GoalProgress {
  const ms = f.matches.filter((m) => m.gf != null && m.ga != null) as { gf: number; ga: number }[];
  const bar = (value: number, goal: number) => Math.max(0, Math.min(100, goal ? (value / goal) * 100 : 0));
  const count = (value: number, unit: [string, string]) => {
    const done = value >= target;
    const left = target - value;
    return { value, target, pct: bar(value, target), done, now: `${value} / ${target}`, hint: done ? null : `${left === 1 ? "Falta" : "Faltan"} ${plural(left, unit[0], unit[1])}` };
  };
  switch (kind) {
    case "goals_for": return count(ms.reduce((n, m) => n + m.gf, 0), ["gol", "goles"]);
    case "wins": return count(ms.filter((m) => m.gf > m.ga).length, ["victoria", "victorias"]);
    case "clean_sheets": return count(ms.filter((m) => m.ga === 0).length, ["portería a cero", "porterías a cero"]);
    case "win_streak":
    case "unbeaten_streak": {
      // Del más reciente al más antiguo, para saber la racha en marcha
      const hits = [...ms].reverse().map((m) => (kind === "win_streak" ? m.gf > m.ga : m.gf >= m.ga));
      const { current, best } = runOf(hits);
      const done = best >= target;
      return { value: best, target, pct: bar(Math.max(current, done ? target : 0), target), done, now: done ? `Mejor racha: ${best}` : `En marcha: ${current}`, hint: done ? null : `Su mejor racha: ${best}` };
    }
    case "all_play": {
      const done = f.squad > 0 && f.squadPlayed >= f.squad;
      return { value: f.squadPlayed, target: f.squad, pct: bar(f.squadPlayed, f.squad), done, now: `${f.squadPlayed} / ${f.squad}`, hint: done ? null : `${f.squad - f.squadPlayed === 1 ? "Falta" : "Faltan"} ${plural(f.squad - f.squadPlayed, "jugador", "jugadores")} por debutar` };
    }
    case "position": {
      if (!f.league) return { value: 0, target, pct: 0, done: false, now: "Sin clasificación", hint: null };
      const { pos } = f.league;
      const done = f.league.secured(target);
      const inside = pos <= target;
      return {
        value: pos, target, done,
        pct: done ? 100 : inside ? 80 : Math.max(8, (target / pos) * 70),
        now: `${pos}º ahora`,
        hint: done ? null : f.league.finished ? (inside ? null : "La liga ya ha terminado") : inside ? "Va por buen camino" : `Hay que subir ${plural(pos - target, "puesto", "puestos")}`,
      };
    }
  }
}
