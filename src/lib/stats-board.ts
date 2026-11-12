/**
 * Cuadro de honor de la página de Estadísticas: rankings con empates y frases
 * que explican cada cifra. Funciones puras para poder probarlas.
 */

export type Ranked<T> = { row: T; value: number; pos: number };

/**
 * Ordena y numera como en una clasificación: los empatados comparten puesto
 * (1, 2, 2, 4…). Sin `asc` gana el valor más alto y se quitan los ceros.
 * `tie` desempata el orden (no el puesto), por ejemplo por dorsal.
 */
export function rankBy<T>(rows: T[], value: (r: T) => number, opts: { asc?: boolean; keepZero?: boolean; tie?: (a: T, b: T) => number; limit?: number } = {}): Ranked<T>[] {
  const { asc = false, keepZero = false, tie, limit = 5 } = opts;
  const list = rows
    .map((row) => ({ row, value: value(row) }))
    .filter((x) => Number.isFinite(x.value) && (keepZero || asc || x.value > 0))
    .sort((a, b) => (asc ? a.value - b.value : b.value - a.value) || (tie ? tie(a.row, b.row) : 0));
  const out: Ranked<T>[] = [];
  list.forEach((x, i) => {
    const pos = i > 0 && x.value === list[i - 1].value ? out[i - 1].pos : i + 1;
    out.push({ ...x, pos });
  });
  return out.slice(0, limit);
}

/** Porcentaje redondeado (0 si no hay total). Nunca pasa de 100. */
export const pct = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

/** "Eisiel", "Eisiel y Samu", "Eisiel, Samu y Iván". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Frase bajo la cifra del pichichi: qué parte de los goles del equipo son suyos. */
export function goalsLine(goals: number, teamGoals: number): string | null {
  if (!teamGoals || goals > teamGoals) return null;
  if (goals === teamGoals) return "Ha marcado todos los goles del Rayo esta temporada";
  return `El ${pct(goals, teamGoals)} % de los goles del Rayo esta temporada`;
}

/** Frase bajo la cifra del máximo asistente. */
export function assistsLine(assists: number, teamGoals: number): string | null {
  if (!teamGoals || assists > teamGoals) return null;
  return `Ha dado el pase en ${assists} de los ${teamGoals} goles del equipo`;
}

/** Frase para el que más partidos ha jugado. */
export function appsLine(apps: number, played: number): string {
  if (played > 0 && apps === played) return played === 1 ? "ha jugado el único partido" : `de ${played} · no ha faltado a ninguno`;
  if (played > 0 && apps < played) return `de ${played} partidos`;
  return apps === 1 ? "partido" : "partidos";
}

/** Plural sencillo: (1, "gol", "goles"). */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
