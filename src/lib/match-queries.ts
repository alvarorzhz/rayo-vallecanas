import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { byKickoff, todayMadrid, type Match, type MatchRow, type Rival } from "@/lib/matches";
import { sortCallups, type Callup, type CallupRow } from "@/lib/callups";
import type { Player, SquadStatus } from "@/lib/squad";

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

/** Convocados de un partido con su dorsal y posición de esa temporada (RLS: el borrador solo lo ven los gestores). */
export async function fetchCallups(supabase: DB, m: Pick<Match, "id" | "season">): Promise<CallupRow[]> {
  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase.from("match_callups").select("*, player:players!inner(*)").eq("match_id", m.id).returns<(Callup & { player: Player })[]>(),
    supabase.from("squad_members").select("player_id, number, position, status").eq("season", m.season)
      .returns<{ player_id: string; number: number | null; position: string; status: SquadStatus }[]>(),
  ]);
  const by = new Map((members ?? []).map((x) => [x.player_id, x]));
  return sortCallups((rows ?? []).map((r) => {
    const sm = by.get(r.player_id);
    return { ...r, number: sm?.number ?? null, position: sm?.position ?? "MCD", status: sm?.status ?? null };
  }));
}

/** Ficha de jugador vinculada al usuario (si la tiene). */
export async function fetchMyPlayerId(supabase: DB, userId: string): Promise<string | null> {
  const { data } = await supabase.from("players").select("id").eq("user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
