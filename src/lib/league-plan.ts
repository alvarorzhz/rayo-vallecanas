/**
 * Decisiones de la sincronización con la liga que no dependen de internet ni de la
 * base de datos: encontrar a nuestro equipo en otra competición, saber si la liga ha
 * terminado, sumar los totales de un jugador entre competiciones, frenar una lectura
 * sospechosa y reintentar cuando la web tarda. Sin dependencias, para poder probarlo.
 */
import type { LeagueRow } from "./league-parse.ts";

// ---------------------------------------------------------------- Nuestro equipo

/** «RAYO VALLECAÑAS» → «rayo vallecanas» (sin tildes, mayúsculas ni signos). */
export const teamKey = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Nuestro equipo en una competición. En cada competición la liga puede darle un número
 * distinto, así que se busca por este orden: el número que ya teníamos, el nombre con
 * el que estaba apuntado y, por último, cualquier «Rayo Vallecañas».
 */
export function findOurTeam(teams: { id: string; name: string }[], hint: { id?: string | null; name?: string | null } = {}): string | null {
  if (hint.id && teams.some((t) => t.id === hint.id)) return hint.id;
  const wanted = hint.name ? teamKey(hint.name) : "";
  if (wanted) {
    const same = teams.filter((t) => teamKey(t.name) === wanted);
    if (same.length === 1) return same[0].id;
  }
  const rayo = teams.filter((t) => /\brayo valleca/.test(teamKey(t.name)));
  return rayo.length === 1 ? rayo[0].id : null;
}

// ---------------------------------------------------------------- Vista previa

export type LeaguePreview = {
  competition: string;
  name: string | null;
  teams: number;
  team: string;
  teamName: string;
  matches: number;
  played: number;
  from: string | null;
  to: string | null;
  finished: boolean;
};

/** Lo que se va a traer de una competición, para enseñarlo antes de guardarla. */
export function previewOf(
  league: { competitionName: string | null; teams: { id: string; name: string }[]; rows: LeagueRow[] },
  competition: string, team: string, today: string,
): LeaguePreview {
  const ours = league.rows.filter((r) => r.homeId === team || r.awayId === team);
  const dates = ours.map((r) => r.date).sort();
  return {
    competition,
    name: league.competitionName,
    teams: league.teams.length,
    team,
    teamName: league.teams.find((t) => t.id === team)?.name ?? "",
    matches: ours.length,
    played: ours.filter((r) => r.status === "played").length,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    finished: leagueFinished(league.rows, team, today),
  };
}

// ---------------------------------------------------------------- Fin de la liga

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * La competición ha terminado para nosotros: no nos queda ningún partido por jugar
 * y han pasado unos días desde el último (por si la liga añade una jornada aplazada).
 */
export function leagueFinished(rows: LeagueRow[], team: string, today: string, graceDays = 5): boolean {
  const ours = rows.filter((r) => r.homeId === team || r.awayId === team);
  if (!ours.length) return false;
  if (ours.some((r) => r.status === "scheduled" || r.status === "postponed")) return false;
  const last = ours.map((r) => r.date).sort().at(-1)!;
  return addDays(last, graceDays) < today;
}

// ---------------------------------------------------------------- Totales por competición

export type LeagueStats = { apps: number; goals: number; conceded: number; yellows: number; reds: number };
const STAT_KEYS = ["apps", "goals", "conceded", "yellows", "reds"] as const;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/**
 * Apunta los totales de un jugador en una competición y devuelve los de la temporada
 * (la suma de todas). Así, al empezar otra liga, los del Apertura no se pierden.
 */
export function mergeLeagueStats(
  by: Record<string, Partial<LeagueStats>> | null | undefined, competition: string, stats: LeagueStats,
): { by: Record<string, LeagueStats>; total: LeagueStats } {
  const clean = (s: Partial<LeagueStats>) => Object.fromEntries(STAT_KEYS.map((k) => [k, num(s[k])])) as LeagueStats;
  const next: Record<string, LeagueStats> = {};
  for (const [k, v] of Object.entries(by ?? {})) if (/^\d{1,9}$/.test(k) && v && typeof v === "object") next[k] = clean(v);
  next[competition] = clean(stats);
  const total = clean({});
  for (const s of Object.values(next)) for (const k of STAT_KEYS) total[k] += s[k];
  return { by: next, total };
}

// ---------------------------------------------------------------- Freno de seguridad

/**
 * ¿Trae esta lectura bastantes menos partidos nuestros de los que ya teníamos de esa
 * competición? Entonces lo más probable es que la web de la liga esté a medias (o haya
 * cambiado) y es mejor no tocar nada. Devuelve el motivo, o null si todo cuadra.
 */
export function suspiciousRead(p: { stored: number; read: number }): string | null {
  if (p.stored < 4) return null;
  if (p.read >= Math.ceil(p.stored * 0.6)) return null;
  return `La web de la liga solo enseña ${p.read} ${p.read === 1 ? "partido nuestro" : "partidos nuestros"} y la app ya tenía ${p.stored} de esta competición. No se ha guardado nada por si la web está a medias.`;
}

// ---------------------------------------------------------------- Reintentos

/** Error que no merece reintento (la web ha contestado, pero con algo que no sirve). */
export class NoRetry extends Error {}

/**
 * Repite una petición que ha fallado por la red o por la web de la liga (se cae a ratos).
 * Espera un poco más cada vez. `sleep` se puede cambiar en las pruebas.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { tries = 3, wait = 700, sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)) }: { tries?: number; wait?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      if (e instanceof NoRetry || i === tries) break;
      await sleep(wait * i);
    }
  }
  throw last;
}

/** Reparte un trabajo en tandas para no pedir demasiadas páginas a la vez. */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

// ---------------------------------------------------------------- Qué datos se traen

/** Explicación de cada dato que se trae de la liga (se enseña en Partidos → Liga). */
export const LEAGUE_DATA: { what: string; fields: string; page: string; saved: string }[] = [
  { what: "Competición", fields: "Nombre de la liga y del grupo.", page: "Situación", saved: "Se guarda para titular la clasificación y el histórico." },
  { what: "Partidos del Rayo", fields: "Jornada, fecha, hora, campo, quién juega en casa, resultado y estado (pendiente, jugado, aplazado o suspendido).", page: "Calendario", saved: "Se crean los que faltan y se actualizan los que cambian. Los de otros equipos no se guardan." },
  { what: "Rivales", fields: "Nombre y escudo de todos los equipos del grupo.", page: "Calendario y escudos", saved: "Se crean los que faltan. El escudo se copia una vez; si lo cambiáis a mano, se respeta." },
  { what: "Clasificación", fields: "Posición, puntos, partidos, victorias, empates, derrotas y goles de cada equipo, con su racha.", page: "Clasificación", saved: "No se guarda: se lee en el momento y se recuerda media hora." },
  { what: "Plantilla", fields: "Nombre, dorsal, línea, pierna, altura y fecha de nacimiento.", page: "Equipo y ficha de cada jugador", saved: "Solo se rellena lo que esté vacío. Lo que editéis en la app manda. Las fotos no se traen (son diminutas)." },
  { what: "Totales de cada jugador", fields: "Partidos, goles, goles encajados (porteros), amarillas y rojas en la competición.", page: "Ficha de cada jugador", saved: "Se guardan por competición y se suman en la temporada, junto a lo que apuntéis en las actas." },
  { what: "Acta de un partido", fields: "Quién jugó, goles, encajados y tarjetas de cada uno.", page: "Ficha del partido", saved: "No se guarda sola: rellena el formulario del acta para que lo reviséis." },
];
