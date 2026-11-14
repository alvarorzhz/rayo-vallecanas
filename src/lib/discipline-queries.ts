import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { byKickoff, type Match } from "@/lib/matches";
import { discipline, type CardRow, type Discipline } from "@/lib/discipline";

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Ciclo de amarillas de la liga actual (la configurada en Partidos → Liga) para esos jugadores
 * (o para todos los de la liga si no se pasan). Sin liga configurada, devuelve null.
 */
export async function fetchDiscipline(supabase: DB, playerIds?: string[]): Promise<{ competition: string; byPlayer: Map<string, Discipline> } | null> {
  const { data: cfg } = await supabase.from("league_sync").select("competition").eq("id", 1).maybeSingle();
  const competition = cfg?.competition as string | undefined;
  if (!competition) return null;
  const { data: matches } = await supabase.from("matches").select("*")
    .eq("league_competition", competition).eq("status", "played").returns<Match[]>();
  const played = (matches ?? []).sort(byKickoff);
  const order = new Map(played.map((m, i) => [m.id, i]));
  const lastMatchId = played.at(-1)?.id ?? null;
  const seasons = [...new Set(played.map((m) => m.season))];

  let appsQ = supabase.from("match_appearances").select("match_id, player_id, yellows, red").in("match_id", played.map((m) => m.id));
  if (playerIds) appsQ = appsQ.in("player_id", playerIds);
  let membersQ = supabase.from("squad_members").select("player_id, league_stats_by").in("season", seasons.length ? seasons : ["-"]);
  if (playerIds) membersQ = membersQ.in("player_id", playerIds);
  const [{ data: apps }, { data: members }] = await Promise.all([
    played.length ? appsQ : Promise.resolve({ data: [] as (CardRow & { player_id: string })[] }),
    membersQ,
  ]);

  const rows = new Map<string, CardRow[]>();
  for (const a of (apps ?? []) as (CardRow & { player_id: string })[]) {
    const list = rows.get(a.player_id) ?? [];
    list.push({ match_id: a.match_id, yellows: a.yellows, red: a.red });
    rows.set(a.player_id, list);
  }
  const league = new Map<string, number>();
  for (const m of members ?? []) {
    const by = m.league_stats_by as Record<string, { yellows?: number }> | null;
    const y = by?.[competition]?.yellows;
    if (typeof y === "number") league.set(m.player_id as string, Math.max(league.get(m.player_id as string) ?? 0, y));
  }

  const byPlayer = new Map<string, Discipline>();
  for (const id of new Set([...rows.keys(), ...league.keys(), ...(playerIds ?? [])])) {
    const list = (rows.get(id) ?? []).sort((a, b) => (order.get(a.match_id) ?? 0) - (order.get(b.match_id) ?? 0));
    byPlayer.set(id, discipline(list, league.get(id) ?? null, lastMatchId));
  }
  return { competition, byPlayer };
}
