import "server-only";
import { unstable_cache } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import { openSession } from "@/lib/league-sync";
import { parseCalendar, parseCompetitionName, parseTable, type Outcome, type StandingRow } from "@/lib/league-parse";

export type { Outcome, StandingRow } from "@/lib/league-parse";
export { parseTable } from "@/lib/league-parse";

/**
 * Clasificación de la liga (futormes · table.aspx). Solo se lee: no se guarda en
 * la base de datos. Se guarda en caché media hora y se refresca al sincronizar.
 */

export type LeagueTable = { competition: string | null; rows: StandingRow[]; round: string | null; fetchedAt: string };

export const TABLE_TAG = "league-table";

async function load(competition: string): Promise<LeagueTable> {
  const sess = await openSession(competition);
  const [table, calendar] = await Promise.all([sess.get("table.aspx"), sess.get("calendar.aspx").catch(() => "")]);
  const base = parseTable(table);
  if (!base.length) throw new Error("No se ha encontrado la clasificación en la web de la liga.");

  // Racha de cada equipo y última jornada jugada, desde el calendario
  const games = parseCalendar(calendar).filter((r) => r.status === "played" && r.goalsHome != null && r.goalsAway != null)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const form = new Map<string, Outcome[]>();
  const push = (team: string, o: Outcome) => form.set(team, [...(form.get(team) ?? []), o].slice(-5));
  for (const g of games) {
    const h = g.goalsHome!, a = g.goalsAway!;
    push(g.homeId, h > a ? "W" : h < a ? "L" : "D");
    push(g.awayId, a > h ? "W" : a < h ? "L" : "D");
  }
  const comp = parseCompetitionName(sess.situation);
  return {
    competition: comp,
    round: games.at(-1)?.round ?? null,
    rows: base.map((r) => ({ ...r, form: form.get(r.teamId) ?? [] })),
    fetchedAt: new Date().toISOString(),
  };
}

const cached = unstable_cache(load, ["league-table-v1"], { revalidate: 1800, tags: [TABLE_TAG] });

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
