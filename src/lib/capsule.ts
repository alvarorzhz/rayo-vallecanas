/**
 * La cápsula del tiempo de la temporada (4.26.0). Sin dependencias, para poder probarlo:
 * preguntas, fechas, la realidad de la temporada y los puntos de cada predicción.
 */

export type QuestionKey = "top_scorer" | "top_assists" | "top_mvp" | "top_apps" | "top_cards" | "position" | "goals_for" | "wins";
export type Question = {
  key: QuestionKey;
  /** Título corto (gala y listas). */
  label: string;
  /** Lo que se pregunta al escribir. */
  ask: string;
  emoji: string;
  kind: "player" | "number";
  min?: number;
  max?: number;
  /** Margen para el punto de «casi» (solo números). */
  close?: number;
  /** Unidad para enseñar el número («goles»…). */
  unit?: [string, string];
};

export const QUESTIONS: Question[] = [
  { key: "top_scorer", label: "Pichichi del Rayo", ask: "¿Quién será el máximo goleador?", emoji: "⚽", kind: "player", unit: ["gol", "goles"] },
  { key: "top_assists", label: "Rey de las asistencias", ask: "¿Quién dará más asistencias?", emoji: "🎯", kind: "player", unit: ["asistencia", "asistencias"] },
  { key: "top_mvp", label: "Más veces MVP", ask: "¿Quién será MVP más veces?", emoji: "⭐", kind: "player", unit: ["vez MVP", "veces MVP"] },
  { key: "top_apps", label: "El fijo", ask: "¿Quién jugará más partidos?", emoji: "🏃", kind: "player", unit: ["partido", "partidos"] },
  { key: "top_cards", label: "El más tarjetero", ask: "¿Quién verá más tarjetas?", emoji: "🟨", kind: "player", unit: ["tarjeta", "tarjetas"] },
  { key: "position", label: "Puesto final en el Apertura", ask: "¿En qué puesto acabaremos el Apertura?", emoji: "🏆", kind: "number", min: 1, max: 30, close: 1 },
  { key: "goals_for", label: "Goles del Rayo", ask: "¿Cuántos goles meteremos en toda la temporada?", emoji: "🥅", kind: "number", min: 0, max: 999, close: 5, unit: ["gol", "goles"] },
  { key: "wins", label: "Victorias", ask: "¿Cuántos partidos ganaremos?", emoji: "✅", kind: "number", min: 0, max: 99, close: 1, unit: ["victoria", "victorias"] },
];
export const QUESTION = Object.fromEntries(QUESTIONS.map((q) => [q.key, q])) as Record<QuestionKey, Question>;
export const isQuestion = (k: unknown): k is QuestionKey => typeof k === "string" && k in QUESTION;

export const POINTS_HIT = 3;
export const POINTS_CLOSE = 1;
export const MAX_MESSAGES = 12;
export const MAX_BODY = 800;

export type Capsule = { season: string; write_until: string; opens_on: string; final_position: number | null };
export type CapsulePrediction = { user_id: string; question: QuestionKey; player_id: string | null; number: number | null };
export type CapsuleMessage = { id: string; user_id: string; to_player_id: string | null; body: string; created_at: string };

export type Stage = "writing" | "sealed" | "open";
/** En qué momento está la cápsula: se escribe, ya cerrada y esperando la gala, o abierta. */
export function capsuleStage(c: Pick<Capsule, "write_until">, opensAt: string | Date | null, now = new Date()): Stage {
  if (opensAt && new Date(opensAt) <= now) return "open";
  return new Date(c.write_until) > now ? "writing" : "sealed";
}

/**
 * Fechas propuestas al crear la cápsula de una temporada:
 * - se escribe hasta el día del primer partido (o el 15 de octubre si aún no hay calendario);
 * - la gala, el día del último partido que haya, pero no antes del 31 de mayo: el calendario
 *   del Clausura suele entrar más tarde y la cápsula no debe abrirse a mitad de temporada.
 */
export function defaultDates(season: string, firstMatch: string | null, lastMatch: string | null, today: string): { writeUntil: string; opensOn: string } {
  const y = Number(season.slice(0, 4));
  let writeUntil = firstMatch && firstMatch > today ? firstMatch : `${y}-10-15`;
  if (writeUntil <= today) writeUntil = addDays(today, 14);
  const floor = `${y + 1}-05-31`;
  let opensOn = lastMatch && lastMatch > floor ? lastMatch : floor;
  if (opensOn < writeUntil) opensOn = writeUntil;
  return { writeUntil, opensOn };
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** «faltan 3 días», «faltan 5 horas», «falta 1 minuto». */
export function untilLabel(to: string | Date, now = new Date()): string {
  const ms = new Date(to).getTime() - now.getTime();
  if (ms <= 0) return "ya";
  const min = Math.ceil(ms / 60_000);
  const [n, one, many] = min >= 2 * 24 * 60 ? [Math.floor(min / 1440), "día", "días"] : min >= 120 ? [Math.floor(min / 60), "hora", "horas"] : [min, "minuto", "minutos"];
  return `${n === 1 ? "falta" : "faltan"} ${n} ${n === 1 ? one : many}`;
}

// ── La realidad de la temporada ─────────────────────────────────────────────

export type RealMatch = { id: string; goals_for: number | null; goals_against: number | null; mvp_player_id: string | null };
export type RealApp = { match_id: string; player_id: string; yellows: number; red: boolean };
export type RealGoal = { match_id: string; scorer_id: string | null; assist_id: string | null };

/** Lo que pasó de verdad: los líderes (empatados, todos) o el número. */
export type Truth = { players: string[]; value: number } | { number: number } | null;
export type Reality = Record<QuestionKey, Truth>;

function leaders(counts: Map<string, number>): Truth {
  let best = 0;
  for (const v of counts.values()) best = Math.max(best, v);
  if (best <= 0) return null;
  return { players: [...counts].filter(([, v]) => v === best).map(([id]) => id).sort(), value: best };
}
const bump = (m: Map<string, number>, id: string | null | undefined, n = 1) => { if (id) m.set(id, (m.get(id) ?? 0) + n); };

/** Calcula la realidad con los partidos jugados de la temporada y el puesto final (si se sabe). */
export function computeReality(data: { matches: RealMatch[]; apps: RealApp[]; goals: RealGoal[] }, position: number | null): Reality {
  const played = data.matches.filter((m) => m.goals_for != null && m.goals_against != null);
  const ids = new Set(played.map((m) => m.id));
  const goals = new Map<string, number>(), assists = new Map<string, number>(), mvps = new Map<string, number>(), apps = new Map<string, number>(), cards = new Map<string, number>();
  for (const g of data.goals) if (ids.has(g.match_id)) { bump(goals, g.scorer_id); bump(assists, g.assist_id); }
  for (const m of played) bump(mvps, m.mvp_player_id);
  for (const a of data.apps) if (ids.has(a.match_id)) { bump(apps, a.player_id); bump(cards, a.player_id, a.yellows + (a.red ? 1 : 0)); }
  return {
    top_scorer: leaders(goals),
    top_assists: leaders(assists),
    top_mvp: leaders(mvps),
    top_apps: leaders(apps),
    top_cards: leaders(cards),
    position: position ? { number: position } : null,
    goals_for: played.length ? { number: played.reduce((s, m) => s + (m.goals_for ?? 0), 0) } : null,
    wins: played.length ? { number: played.filter((m) => (m.goals_for ?? 0) > (m.goals_against ?? 0)).length } : null,
  };
}

export type Verdict = { points: number; hit: "exact" | "close" | "miss" } | null;

/** Puntos de una predicción: 3 por acertarla (el jugador, o el número exacto) y 1 por quedarse cerca. null si no se sabe la realidad. */
export function judge(p: Pick<CapsulePrediction, "question" | "player_id" | "number">, truth: Truth): Verdict {
  if (!truth) return null;
  const q = QUESTION[p.question];
  if (!q) return null;
  if ("players" in truth) {
    if (!p.player_id) return null;
    return truth.players.includes(p.player_id) ? { points: POINTS_HIT, hit: "exact" } : { points: 0, hit: "miss" };
  }
  if (p.number == null) return null;
  const diff = Math.abs(p.number - truth.number);
  if (diff === 0) return { points: POINTS_HIT, hit: "exact" };
  if (diff <= (q.close ?? 0)) return { points: POINTS_CLOSE, hit: "close" };
  return { points: 0, hit: "miss" };
}

export type SeerRow = { user_id: string; points: number; hits: number; closes: number; answered: number; pos: number };

/** El pitoniso de la temporada: quién ha acertado más. A igualdad de puntos, más aciertos exactos. */
export function seerTable(preds: CapsulePrediction[], reality: Reality): SeerRow[] {
  const by = new Map<string, SeerRow>();
  for (const p of preds) {
    const r = by.get(p.user_id) ?? { user_id: p.user_id, points: 0, hits: 0, closes: 0, answered: 0, pos: 0 };
    r.answered++;
    const v = judge(p, reality[p.question]);
    if (v) { r.points += v.points; if (v.hit === "exact") r.hits++; if (v.hit === "close") r.closes++; }
    by.set(p.user_id, r);
  }
  const rows = [...by.values()].sort((a, b) => b.points - a.points || b.hits - a.hits || a.user_id.localeCompare(b.user_id));
  rows.forEach((r, i) => { r.pos = i > 0 && rows[i - 1].points === r.points && rows[i - 1].hits === r.hits ? rows[i - 1].pos : i + 1; });
  return rows;
}

/** Quién se quedó más cerca en una pregunta de número (todos los empatados). */
export function closest(preds: CapsulePrediction[], question: QuestionKey, truth: Truth): string[] {
  if (!truth || !("number" in truth)) return [];
  const rows = preds.filter((p) => p.question === question && p.number != null);
  if (!rows.length) return [];
  const best = Math.min(...rows.map((p) => Math.abs((p.number as number) - truth.number)));
  return rows.filter((p) => Math.abs((p.number as number) - truth.number) === best).map((p) => p.user_id);
}

/** «12 goles», «1 victoria», «3º». */
export function numberText(q: Question, n: number): string {
  if (q.key === "position") return `${n}º`;
  return q.unit ? `${n} ${n === 1 ? q.unit[0] : q.unit[1]}` : String(n);
}

/** Valor de un número del formulario, o null si no vale para esa pregunta. */
export function parseAnswer(q: Question, raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= (q.min ?? 0) && n <= (q.max ?? 999) ? n : null;
}

/** Último minuto de ese día en Madrid, como fecha ISO con su desfase («2026-10-15T23:59:00+02:00»). */
export function madridEndOfDay(day: string): string {
  const noon = new Date(`${day}T12:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(noon));
  const off = h - 12;
  return `${day}T23:59:00${off >= 0 ? "+" : "-"}${String(Math.abs(off)).padStart(2, "0")}:00`;
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
