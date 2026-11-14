/**
 * Acta en vivo (v4.12.0): lo que apunta desde la banda quien lleva el directo.
 * Cálculo puro (marcador, minuto y el acta que sale al final), para poder probarlo.
 */
import type { DraftApp, ReportDraft } from "./reports.ts";

export type LiveKind = "goal" | "goal_against" | "yellow" | "red";

export type LiveEvent = {
  id: string;
  match_id: string;
  kind: LiveKind;
  player_id: string | null;
  assist_id: string | null;
  own_goal: boolean;
  half: 1 | 2 | null;
  minute: number | null;
  created_at: string;
};

export type LiveClock = { half: 1 | 2; minute: number };

/** Marcador según lo apuntado: nuestros goles y los del rival. */
export function liveScore(events: Pick<LiveEvent, "kind">[]) {
  return {
    gf: events.filter((e) => e.kind === "goal").length,
    ga: events.filter((e) => e.kind === "goal_against").length,
  };
}

/** Parte y minuto de juego (desde el pitido de cada parte), o null si aún no ha empezado. */
export function liveClock(m: { live_started_at?: string | null; live_second_at?: string | null }, now: Date = new Date()): LiveClock | null {
  const from = m.live_second_at ?? m.live_started_at;
  if (!from) return null;
  const minute = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 60_000)) + 1;
  return { half: m.live_second_at ? 2 : 1, minute: Math.min(minute, 150) };
}

export const clockLabel = (c: Pick<LiveEvent, "half" | "minute">) =>
  c.minute == null ? "" : `${c.minute}'${c.half === 2 ? " 2ª" : ""}`;

/** Del más antiguo al más reciente. */
export const byTime = (a: Pick<LiveEvent, "created_at">, b: Pick<LiveEvent, "created_at">) => a.created_at.localeCompare(b.created_at);

const emptyApp = (): DraftApp => ({ started: false, goalkeeper: false, conceded: 0, yellows: 0, red: false });

/**
 * El acta que sale al pitido final: los que iban en la convocatoria (y los que salen en el directo),
 * sus tarjetas y nuestros goles en orden con su asistencia.
 * @param base lo que ya se sabía por la convocatoria (quién va, titulares, portero).
 * @param pool los jugadores que pueden salir en el acta.
 */
export function draftFromLive(events: LiveEvent[], base: Record<string, DraftApp>, pool: Set<string>, goalsAgainst: number): ReportDraft {
  const list = [...events].sort(byTime);
  const apps: Record<string, DraftApp> = {};
  for (const [id, a] of Object.entries(base)) if (pool.has(id)) apps[id] = { ...a };
  const touch = (id: string | null) => {
    if (id && pool.has(id) && !apps[id]) apps[id] = emptyApp();
  };
  for (const e of list) {
    touch(e.player_id);
    touch(e.assist_id);
    if (!e.player_id || !apps[e.player_id]) continue;
    const a = apps[e.player_id];
    if (e.kind === "yellow") {
      a.yellows = Math.min(2, a.yellows + 1);
      if (a.yellows === 2) a.red = true; // doble amarilla
    }
    if (e.kind === "red") a.red = true;
  }
  // Lo encajado va al portero (si solo hay uno)
  const gks = Object.values(apps).filter((a) => a.goalkeeper);
  if (gks.length === 1) gks[0].conceded = goalsAgainst;
  const goals = list.filter((e) => e.kind === "goal").map((e) => ({
    scorer: e.own_goal ? "own" : e.player_id && apps[e.player_id] ? e.player_id : "",
    assist: e.assist_id && apps[e.assist_id] && e.assist_id !== e.player_id ? e.assist_id : "",
  }));
  return { apps, goals };
}

/** Texto de cada momento del directo, para la lista y para Inicio. */
export function eventText(e: Pick<LiveEvent, "kind" | "own_goal">, name: (id: string | null) => string | null, ev: Pick<LiveEvent, "player_id" | "assist_id">) {
  const who = name(ev.player_id);
  if (e.kind === "goal") {
    if (e.own_goal) return "Gol en propia puerta del rival";
    const as = name(ev.assist_id);
    return `${who ?? "Gol del Rayo"}${as ? ` (asist. ${as})` : ""}`;
  }
  if (e.kind === "goal_against") return "Gol del rival";
  return who ?? "";
}

export const KIND_ICON: Record<LiveKind, string> = { goal: "⚽", goal_against: "🥅", yellow: "🟨", red: "🟥" };
