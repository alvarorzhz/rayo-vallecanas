import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { byKickoff, todayMadrid, type MatchRow, type Rival } from "@/lib/matches";

type DB = Awaited<ReturnType<typeof createClient>>;

const SELECT = "*, rival:rivals!inner(*)";

/** Partidos de una temporada, por fecha. */
export async function fetchMatches(supabase: DB, season: string): Promise<MatchRow[]> {
  const { data } = await supabase.from("matches").select(SELECT).eq("season", season).returns<MatchRow[]>();
  return (data ?? []).sort(byKickoff);
}

export async function fetchMatch(supabase: DB, id: string): Promise<MatchRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("matches").select(SELECT).eq("id", id).maybeSingle<MatchRow>();
  return data;
}

/** Próximo partido pendiente o aplazado sin fecha nueva (desde hoy) y los últimos resultados. */
export async function fetchMatchday(supabase: DB, last = 5) {
  const today = todayMadrid();
  const [{ data: next }, { data: recent }] = await Promise.all([
    supabase.from("matches").select(SELECT).eq("status", "scheduled").gte("match_date", today)
      .order("match_date").order("kickoff", { nullsFirst: false }).limit(1).returns<MatchRow[]>(),
    supabase.from("matches").select(SELECT).eq("status", "played")
      .order("match_date", { ascending: false }).order("kickoff", { ascending: false, nullsFirst: false }).limit(last).returns<MatchRow[]>(),
  ]);
  return { next: next?.[0] ?? null, recent: recent ?? [] };
}

export async function fetchRivals(supabase: DB): Promise<Rival[]> {
  const { data } = await supabase.from("rivals").select("*").order("name").returns<Rival[]>();
  return data ?? [];
}

/** Temporadas con partidos, más la actual. */
export async function fetchMatchSeasons(supabase: DB): Promise<string[]> {
  const { data } = await supabase.from("matches").select("season").limit(2000);
  const set = new Set<string>((data ?? []).map((r) => r.season));
  set.add(seasonOf());
  return [...set].sort().reverse();
}
