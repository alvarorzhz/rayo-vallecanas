/** Notas de los jugadores en cada partido (v4.13.0): tipos y cálculos sin dependencias de servidor. */

export type RatingBoard = {
  match_id: string;
  /** Aún se puede puntuar (va con la votación del MVP). */
  open: boolean;
  /** Cuántas personas han puesto alguna nota. */
  raters: number;
  /** Mis notas: jugador → nota. */
  mine: Record<string, number>;
  /**
   * Solo al cerrar: jugador → cuántos le puntuaron, su puesto (si tiene media) y su media,
   * que desde la 4.28.1 solo llega para los 3 mejores (null para el resto y para los que
   * no llegan a 2 notas). `pos` falta en las respuestas de antes de la 4.28.1.
   */
  averages: Record<string, { avg: number | null; n: number; pos?: number | null }> | null;
};

/** Al cerrar solo se enseña la media de los 3 mejores (empates en el 3º, todos). */
export const TOP_VISIBLE = 3;

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

/**
 * `avg` solo viene en los que se enseñan (los 3 mejores); `rank` es su puesto (empatados,
 * el mismo). `hidden`: tiene media pero no está entre los mejores, así que va en su sitio
 * sin nota.
 */
export type RatedRow = { id: string; avg: number | null; n: number; mine: number | null; rank: number | null; hidden: boolean };

/**
 * Notas del partido cerrado, de la mejor media a la peor. Solo se ve la media de los
 * {@link TOP_VISIBLE} mejores; el resto conserva su sitio sin nota. Los que no llegan al
 * mínimo de puntuaciones van al final («sin nota»). Empate: más puntuaciones primero.
 * Sirve tanto con la respuesta nueva (con `pos`) como con la antigua (todas las medias).
 */
export function ratingRanking(b: Pick<RatingBoard, "averages" | "mine">, candidates: string[]): RatedRow[] {
  const base = candidates.map((id, i) => {
    const a = b.averages?.[id];
    const avg = a?.avg ?? null;
    const pos = a?.pos ?? null;
    return { id, i, avg, pos, n: a?.n ?? 0, mine: b.mine[id] ?? null, ranked: pos !== null || avg !== null };
  });
  const byPos = base.some((x) => x.pos !== null);
  base.sort((x, y) => {
    if (x.ranked !== y.ranked) return x.ranked ? -1 : 1;
    if (!x.ranked) return y.n - x.n || x.i - y.i;
    if (byPos) return (x.pos ?? 999) - (y.pos ?? 999);
    return y.avg! - x.avg! || y.n - x.n || x.i - y.i;
  });
  // Puesto de cada media (a un decimal, como se enseña): los empatados comparten puesto.
  const r1 = (v: number) => Math.round(v * 10);
  const shown = base.filter((x) => x.avg !== null).map((x) => r1(x.avg!));
  return base.map((x) => {
    const rank = x.avg !== null ? 1 + shown.filter((v) => v > r1(x.avg!)).length : null;
    const visible = rank !== null && rank <= TOP_VISIBLE;
    return { id: x.id, avg: visible ? x.avg : null, n: x.n, mine: x.mine, rank: visible ? rank : null, hidden: x.ranked && !visible };
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
