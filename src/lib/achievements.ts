/**
 * Logros del jugador: insignias por hitos en el club (todas las temporadas).
 * Cálculo puro, sin dependencias de servidor, para poder probarlo.
 */
import type { Line, Membership } from "./squad.ts";

/** Nivel de la insignia: 1 bronce · 2 plata · 3 oro · 4 o más, leyenda. */
export type Badge = {
  key: string;
  icon: string;
  title: string;
  /** Qué ha hecho («25 partidos»). */
  detail: string;
  level: number;
};

/** El siguiente escalón de una familia, con lo que le falta. */
export type NextBadge = { key: string; icon: string; title: string; detail: string; value: number; goal: number };

type Family = { key: string; icon: string; steps: number[]; titles: string[]; unit: [string, string] };

const FAMILIES: Record<string, Family> = {
  apps: { key: "apps", icon: "🏟️", steps: [1, 10, 25, 50, 100], titles: ["Debutante", "Habitual", "Fijo", "Veterano", "Centenario"], unit: ["partido", "partidos"] },
  goals: { key: "goals", icon: "⚽", steps: [1, 5, 10, 25, 50], titles: ["Primer gol", "Goleador", "Killer", "Pichichi", "Leyenda del gol"], unit: ["gol", "goles"] },
  assists: { key: "assists", icon: "🎯", steps: [1, 5, 10, 25], titles: ["Primera asistencia", "Asistente", "Visión de juego", "El Mago"], unit: ["asistencia", "asistencias"] },
  mvps: { key: "mvps", icon: "⭐", steps: [1, 3, 5, 10], titles: ["MVP", "Estrella", "Crack", "Balón de Oro"], unit: ["MVP", "MVP"] },
  clean: { key: "clean", icon: "🧤", steps: [1, 3, 5, 10], titles: ["Portería a cero", "Candado", "El Muro", "Imbatible"], unit: ["portería a cero", "porterías a cero"] },
  seasons: { key: "seasons", icon: "🛡️", steps: [2, 3, 5], titles: ["Repite", "De la casa", "Bandera"], unit: ["temporada", "temporadas"] },
  hat: { key: "hat", icon: "🔥", steps: [2, 3, 4], titles: ["Doblete", "Hat-trick", "Póker"], unit: ["gol en un partido", "goles en un partido"] },
};

const count = (n: number, [one, many]: [string, string]) => `${n} ${n === 1 ? one : many}`;

export type AchievementInput = {
  seasons: Pick<Membership, "season" | "apps" | "goals" | "assists" | "mvps" | "clean_sheets" | "yellows" | "reds" | "armband">[];
  /** Goles marcados en cada partido (solo los partidos con algún gol suyo). */
  goalsPerMatch: number[];
  line: Line | null;
};

/** Insignias conseguidas y los siguientes escalones (los más cercanos primero). */
export function achievements({ seasons, goalsPerMatch, line }: AchievementInput): { badges: Badge[]; next: NextBadge[] } {
  const sum = (k: "apps" | "goals" | "assists" | "mvps" | "clean_sheets") => seasons.reduce((n, s) => n + (s[k] ?? 0), 0);
  const playedSeasons = seasons.filter((s) => s.apps > 0).length;
  const values: Record<string, number> = {
    apps: sum("apps"),
    goals: sum("goals"),
    assists: sum("assists"),
    mvps: sum("mvps"),
    clean: sum("clean_sheets"),
    seasons: playedSeasons,
    hat: Math.max(0, ...goalsPerMatch),
  };
  const gk = line === "GK";
  // Qué familias se enseñan aunque no tenga nada: al portero no se le pide gol, al de campo no se le piden porterías
  const wanted = new Set(["apps", "mvps", "seasons", ...(gk ? ["clean"] : ["goals", "assists", "hat"])]);

  const badges: Badge[] = [];
  const next: NextBadge[] = [];
  for (const f of Object.values(FAMILIES)) {
    const v = values[f.key];
    const reached = f.steps.filter((s) => v >= s).length;
    if (reached > 0) {
      const at = f.steps[reached - 1];
      badges.push({ key: f.key, icon: f.icon, title: f.titles[reached - 1], detail: f.key === "hat" ? count(at, f.unit) : count(v, f.unit), level: reached });
    }
    if (reached < f.steps.length && (reached > 0 || wanted.has(f.key))) {
      const goal = f.steps[reached];
      next.push({ key: f.key, icon: f.icon, title: f.titles[reached], detail: count(goal, f.unit), value: Math.min(v, goal), goal });
    }
  }

  // Sueltas: solo se enseñan cuando se consiguen
  if (seasons.some((s) => s.armband === "captain")) badges.push({ key: "captain", icon: "🎖️", title: "Capitán", detail: "Llevó el brazalete", level: 3 });
  const clean = seasons.find((s) => s.apps >= 10 && !s.yellows && !s.reds);
  if (clean) badges.push({ key: "fair", icon: "🤝", title: "Señorío", detail: `${clean.season} sin tarjetas`, level: 2 });

  badges.sort((a, b) => b.level - a.level);
  // Lo más cercano primero (por lo que falta en proporción)
  next.sort((a, b) => b.value / b.goal - a.value / a.goal || a.goal - a.value - (b.goal - b.value));
  return { badges, next };
}

export const LEVEL_NAME = ["", "Bronce", "Plata", "Oro", "Leyenda", "Leyenda"];
