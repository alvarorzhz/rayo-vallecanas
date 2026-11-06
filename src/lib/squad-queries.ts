import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { sortRoster, type Membership, type Player, type RosterEntry } from "@/lib/squad";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Plantilla de una temporada, ordenada por línea y dorsal. */
export async function fetchRoster(supabase: DB, season: string): Promise<RosterEntry[]> {
  const { data } = await supabase
    .from("squad_members")
    .select("*, player:players!inner(*)")
    .eq("season", season)
    .returns<(Membership & { player: Player })[]>();
  return sortRoster(data ?? []);
}

/** Temporadas con plantilla, más la actual. */
export async function fetchSeasons(supabase: DB): Promise<string[]> {
  const { data } = await supabase.from("squad_members").select("season").limit(1000);
  const set = new Set<string>((data ?? []).map((r) => r.season));
  set.add(seasonOf());
  return [...set].sort().reverse();
}

