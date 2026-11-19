import "server-only";
import { unstable_cache } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import { openSession } from "@/lib/league-sync";
import { parseCalendar, parseCompetitionName, parseTable } from "@/lib/league-parse";
import { teamGames } from "@/lib/standings";
import { remainingByTeam } from "@/lib/league-outlook";
import type { LeagueRow, StandingRow } from "@/lib/league-parse";
import { leagueForecast, type Forecast } from "@/lib/league-forecast";

export type { StandingRow } from "@/lib/league-parse";

/**
 * Clasificación de la liga (futormes · table.aspx). Solo se lee: no se guarda en
 * la base de datos. Se guarda en caché media hora y se refresca al sincronizar.
 */

export type LeagueTable = { competition: string | null; rows: StandingRow[]; round: string | null; fetchedAt: string; /** 4.20.0 · si se pudo leer el calendario (para «Lo que queda») */ withCalendar?: boolean; /** 4.25.0 · partidos de la liga (jugados y por jugar), para la previsión */ games?: LeagueRow[] };

const TABLE_TAG = "league-table";

async function load(competition: string): Promise<LeagueTable> {
  const sess = await openSession(competition);
  const [table, calendar] = await Promise.all([sess.get("table.aspx"), sess.get("calendar.aspx").catch(() => "")]);
  const base = parseTable(table);
  if (!base.length) throw new Error("No se ha encontrado la clasificación en la web de la liga.");

  // Racha y últimos partidos de cada equipo, y última jornada jugada, desde el calendario
  const games = parseCalendar(calendar);
  const { byTeam, round } = teamGames(games);
  const left = remainingByTeam(games);
  const comp = parseCompetitionName(sess.situation);
  return {
    competition: comp,
    round,
    rows: base.map((r) => ({ ...r, form: byTeam.get(r.teamId)?.form ?? [], last: byTeam.get(r.teamId)?.last ?? [], left: left.get(r.teamId) ?? 0 })),
    fetchedAt: new Date().toISOString(),
    withCalendar: games.length > 0,
    games,
  };
}

const cached = unstable_cache(load, ["league-table-v4"], { revalidate: 1800, tags: [TABLE_TAG] });

/**
 * 4.25.0 · «¿Subimos?»: el resto de la liga simulado 10.000 veces. Se calcula en el servidor una
 * vez por clasificación (misma caché que la tabla, así que se rehace tras cada resultado).
 */
const forecastCached = unstable_cache(
  async (competition: string, team: string) => {
    const t = await cached(competition);
    return t.games?.length ? leagueForecast(t.rows, t.games, team) : null;
  },
  ["league-forecast-v1"],
  { revalidate: 1800, tags: [TABLE_TAG] },
);

/** Previsión de la liga para nuestro equipo, o null si no hay datos o la web de la liga no responde. */
export async function getForecast(competition: string, team: string): Promise<Forecast | null> {
  if (!/^\d{1,9}$/.test(competition) || !/^\d{1,12}$/.test(team)) return null;
  try {
    return await forecastCached(competition, team);
  } catch (e) {
    console.error("No se ha podido calcular la previsión de la liga:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Como getForecast, pero si tarda más de `ms` devuelve null. */
export function getForecastQuick(competition: string, team: string, ms = 2500): Promise<Forecast | null> {
  return within(getForecast(competition, team), ms);
}

/** Clasificación de la competición, o null si la web de la liga no responde. */
export async function getLeagueTable(competition: string): Promise<LeagueTable | null> {
  if (!/^\d{1,9}$/.test(competition)) return null;
  try {
    return await cached(competition);
  } catch (e) {
    console.error("No se ha podido leer la clasificación:", e instanceof Error ? e.message : e);
    return null;
  }
}

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);

/**
 * Clasificación para enseñar junto a los partidos (posición y puntos del rival).
 * Si la web de la liga tarda más de `ms`, se sigue sin ella para no frenar la página.
 */
export async function getStandings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ms = 2500,
): Promise<{ table: LeagueTable; us: string; competition: string } | null> {
  const { data: l } = await supabase.from("league_sync").select("competition, team").eq("id", 1)
    .maybeSingle<{ competition: string | null; team: string | null }>();
  if (!l?.competition || !l.team) return null;
  const table = await getLeagueTableQuick(l.competition, ms);
  return table ? { table, us: l.team, competition: l.competition } : null;
}

/** Como getLeagueTable, pero si la web de la liga tarda más de `ms` devuelve null. */
export function getLeagueTableQuick(competition: string, ms = 2500): Promise<LeagueTable | null> {
  return within(getLeagueTable(competition), ms);
}
