/**
 * Ciclo de amarillas (v4.12.0): cuántas amarillas lleva cada jugador en la liga actual
 * y si está a una de la sanción o le toca cumplirla. Cálculo puro, para poder probarlo.
 *
 * Reglas (las de la federación en fútbol 7 amateur):
 * - Cada 5 amarillas en la liga, un partido de sanción.
 * - Las dos amarillas de un mismo partido son una expulsión: no cuentan para el ciclo.
 * - Una roja (directa o por doble amarilla) se cumple el partido siguiente.
 * La web de la liga ya no publica el ciclo, así que se cuenta con las actas. Si la liga
 * tiene apuntadas más amarillas que las actas (partidos sin acta), la diferencia se suma
 * al principio, como si fueran las más antiguas.
 */

export const CYCLE = 5;

/** Lo que hizo el jugador en un partido de liga, según el acta. */
export type CardRow = { match_id: string; yellows: number; red: boolean };

export type DisciplineStatus = "ok" | "warn" | "banned";

export type Discipline = {
  /** Amarillas que cuentan para el ciclo en toda la liga. */
  count: number;
  /** Las que lleva del ciclo actual (0 a 4). */
  inCycle: number;
  status: DisciplineStatus;
  /** Por qué está sancionado o avisado, en una frase. */
  reason: string | null;
};

/**
 * @param rows sus partidos de liga con acta, del más antiguo al más reciente.
 * @param leagueYellows amarillas que dice la web de la liga en esta competición (o null).
 * @param lastMatchId el último partido de liga jugado por el equipo (para saber si la sanción está pendiente).
 */
export function discipline(rows: CardRow[], leagueYellows: number | null, lastMatchId: string | null): Discipline {
  const actaYellows = rows.reduce((n, r) => n + r.yellows, 0);
  const counts = (r: CardRow) => (r.yellows === 1 ? 1 : 0);
  const extra = Math.max(0, (leagueYellows ?? 0) - actaYellows);
  const count = extra + rows.reduce((n, r) => n + counts(r), 0);
  const inCycle = count % CYCLE;
  const last = lastMatchId ? rows.find((r) => r.match_id === lastMatchId) ?? null : null;

  if (last?.red) {
    return { count, inCycle, status: "banned", reason: last.yellows >= 2 ? "Expulsado por doble amarilla en el último partido" : "Roja directa en el último partido" };
  }
  // ¿Cerró el ciclo justo en el último partido?
  if (last && counts(last) && count > 0 && inCycle === 0) {
    return { count, inCycle, status: "banned", reason: `Llegó a ${count} amarillas en el último partido: ciclo cumplido` };
  }
  if (inCycle === CYCLE - 1) return { count, inCycle, status: "warn", reason: "A una amarilla de la sanción" };
  return { count, inCycle, status: "ok", reason: null };
}

export const DISCIPLINE_TONE: Record<DisciplineStatus, string> = {
  ok: "bg-gris text-negro",
  warn: "bg-amber-100 text-amber-900",
  banned: "bg-rojo text-white",
};
