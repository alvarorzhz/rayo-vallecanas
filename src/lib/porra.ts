/** La porra del partido: puntos y clasificación. Puro, con pruebas. */

export type Prediction = { match_id: string; user_id: string; goals_for: number; goals_against: number };
export type ScoredMatch = { id: string; status: string; goals_for: number | null; goals_against: number | null };

export const POINTS_EXACT = 3;
export const POINTS_SIGN = 1;

const sign = (a: number, b: number) => Math.sign(a - b);

/** Puntos de un pronóstico: 3 si clava el resultado, 1 si acierta quién gana o el empate. null si el partido no se ha jugado. */
export function porraPoints(p: Pick<Prediction, "goals_for" | "goals_against">, m: Omit<ScoredMatch, "id">): number | null {
  if (m.status !== "played" || m.goals_for == null || m.goals_against == null) return null;
  if (p.goals_for === m.goals_for && p.goals_against === m.goals_against) return POINTS_EXACT;
  return sign(p.goals_for, p.goals_against) === sign(m.goals_for, m.goals_against) ? POINTS_SIGN : 0;
}

export type PorraRow = { user_id: string; points: number; exact: number; sign: number; played: number; pos: number };

/**
 * Clasificación de la temporada: más puntos; a igualdad, más resultados clavados y luego menos partidos jugados
 * (más acierto). Los empatados en todo comparten puesto.
 */
export function porraTable(preds: Prediction[], matches: ScoredMatch[]): PorraRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const acc = new Map<string, Omit<PorraRow, "pos">>();
  for (const p of preds) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    const pts = porraPoints(p, m);
    if (pts == null) continue;
    const r = acc.get(p.user_id) ?? { user_id: p.user_id, points: 0, exact: 0, sign: 0, played: 0 };
    r.points += pts;
    r.played += 1;
    if (pts === POINTS_EXACT) r.exact += 1;
    else if (pts === POINTS_SIGN) r.sign += 1;
    acc.set(p.user_id, r);
  }
  const rows = [...acc.values()].sort((a, b) => b.points - a.points || b.exact - a.exact || a.played - b.played);
  let pos = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.exact !== r.exact || prev.played !== r.played) pos = i + 1;
    return { ...r, pos };
  });
}

/** Cuándo se cierra la porra: el pitido inicial (hora de Madrid) o, sin hora, al empezar el día del partido. */
export function porraClosesAt(m: { match_date: string; kickoff: string | null }): Date {
  const [y, mo, d] = m.match_date.split("-").map(Number);
  const [h, mi] = (m.kickoff ?? "00:00").split(":").map(Number);
  // Hora de Madrid → UTC: se prueba con +1 y +2 y se queda la que, vista en Madrid, da la hora buscada
  for (const off of [1, 2]) {
    const t = new Date(Date.UTC(y, mo - 1, d, h - off, mi));
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
    if (local === `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`) return t;
  }
  return new Date(Date.UTC(y, mo - 1, d, h - 1, mi));
}

export const porraOpen = (m: { status: string; match_date: string; kickoff: string | null }, now = new Date()) =>
  m.status === "scheduled" && porraClosesAt(m) > now;
