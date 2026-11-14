/** Notas de los jugadores en cada partido (v4.13.0): tipos y cálculos sin dependencias de servidor. */

export type RatingBoard = {
  match_id: string;
  /** Aún se puede puntuar (va con la votación del MVP). */
  open: boolean;
  /** Cuántas personas han puesto alguna nota. */
  raters: number;
  /** Mis notas: jugador → nota. */
  mine: Record<string, number>;
  /** Solo al cerrar: jugador → media (null si le puntuaron menos de 2) y cuántos le puntuaron. */
  averages: Record<string, { avg: number | null; n: number }> | null;
};

/** Mínimo de personas que tienen que puntuar a alguien para que tenga media. */
export const MIN_RATERS = 2;

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

/** ¿Es una nota válida? Del 1 al 10, de medio en medio punto. */
export function validScore(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= MIN_SCORE && n <= MAX_SCORE && Number.isInteger(n * 2);
}

/** Sube o baja medio punto sin salirse del 1–10. */
export function nudge(score: number, delta: 0.5 | -0.5): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, score + delta));
}

/** «7», «6,5» y, para medias, con un decimal: «7,3». */
export function fmtScore(n: number, decimals: 0 | 1 = 0): string {
  const v = decimals ? (Math.round(n * 10) / 10).toFixed(1) : Number.isInteger(n) ? String(n) : n.toFixed(1);
  return v.replace(".", ",");
}

/** Color de la nota, como en los periódicos: suspenso, aprobado, notable, sobresaliente. */
export function scoreTone(n: number): "low" | "mid" | "good" | "top" {
  if (n < 5) return "low";
  if (n < 7) return "mid";
  if (n < 8.5) return "good";
  return "top";
}

export const scoreWord = (n: number) => ({ low: "Flojo", mid: "Cumple", good: "Notable", top: "Crack" })[scoreTone(n)];

export type RatedRow = { id: string; avg: number | null; n: number; mine: number | null };

/**
 * Notas del partido cerrado, de la mejor media a la peor. Los que no llegan al mínimo
 * de puntuaciones van al final («sin nota»). Empate: más puntuaciones primero.
 */
export function ratingRanking(b: Pick<RatingBoard, "averages" | "mine">, candidates: string[]): RatedRow[] {
  return candidates
    .map((id) => {
      const a = b.averages?.[id];
      return { id, avg: a?.avg ?? null, n: a?.n ?? 0, mine: b.mine[id] ?? null };
    })
    .sort((x, y) => {
      if (x.avg === null || y.avg === null) return x.avg === null ? (y.avg === null ? y.n - x.n : 1) : -1;
      return y.avg - x.avg || y.n - x.n;
    });
}

/** Cuántos jugadores me quedan por puntuar (sin contarme a mí). */
export function leftToRate(mine: Record<string, number>, candidates: string[], me: string | null): number {
  return candidates.filter((id) => id !== me && mine[id] === undefined).length;
}

/** «1 nota» / «3 notas». */
export const ratingsLabel = (n: number) => `${n} ${n === 1 ? "nota" : "notas"}`;

export type SeasonRating = { player_id: string; avg_score: number; matches: number; best: number };

/**
 * Quién entra en la tarjeta «Nota media» de la temporada: los que tienen nota en al menos
 * la mitad de partidos que el que más (y siempre en uno como mínimo), para que un
 * partido suelto no gane a toda una temporada.
 */
export function seasonRatingPool(rows: SeasonRating[]): Map<string, SeasonRating> {
  const most = Math.max(0, ...rows.map((r) => r.matches));
  const min = Math.max(1, Math.floor(most / 2));
  return new Map(rows.filter((r) => r.matches >= min).map((r) => [r.player_id, { ...r, avg_score: Number(r.avg_score), best: Number(r.best) }]));
}
