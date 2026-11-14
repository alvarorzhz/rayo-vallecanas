import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { shirtName, type Player } from "@/lib/squad";
import type { Match } from "@/lib/matches";
import { byTime, eventText, liveScore, type LiveEvent, type LiveKind } from "@/lib/live";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Lo que ve Inicio (y quien lleva el directo) del partido en juego. */
export type LiveView = {
  started: string | null;
  second: string | null;
  played: boolean;
  gf: number;
  ga: number;
  events: { id: string; kind: LiveKind; half: 1 | 2 | null; minute: number | null; text: string }[];
};

export async function fetchLiveEvents(supabase: DB, matchId: string): Promise<LiveEvent[]> {
  const { data } = await supabase.from("match_live_events").select("*").eq("match_id", matchId).returns<LiveEvent[]>();
  return (data ?? []).sort(byTime);
}

export async function fetchLiveView(supabase: DB, m: Pick<Match, "id" | "status" | "goals_for" | "goals_against" | "live_started_at" | "live_second_at">): Promise<LiveView> {
  const events = await fetchLiveEvents(supabase, m.id);
  const ids = [...new Set(events.flatMap((e) => [e.player_id, e.assist_id]).filter((x): x is string => !!x))];
  const { data: ps } = ids.length
    ? await supabase.from("players").select("id, first_name, last_name, nickname").in("id", ids).returns<Pick<Player, "id" | "first_name" | "last_name" | "nickname">[]>()
    : { data: [] };
  const names = new Map((ps ?? []).map((p) => [p.id, shirtName(p)]));
  const name = (id: string | null) => (id ? names.get(id) ?? null : null);
  const score = liveScore(events);
  const played = m.status === "played";
  return {
    started: m.live_started_at ?? null,
    second: m.live_second_at ?? null,
    played,
    // Ya finalizado, manda el marcador guardado
    gf: played ? m.goals_for ?? score.gf : score.gf,
    ga: played ? m.goals_against ?? score.ga : score.ga,
    events: events.map((e) => ({ id: e.id, kind: e.kind, half: e.half, minute: e.minute, text: eventText(e, name, e) })),
  };
}
