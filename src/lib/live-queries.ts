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
  events: { id: string; kind: LiveKind; half: 1 | 2 | null; minute: number | null; text: string; who?: LiveScorer | null }[];
  /** 4.20.0 · Nombre corto del rival (para «Gol de …» y el marcador de la pantalla ¡GOOOL!). */
  rival?: string;
};

/** 4.20.0 · Quién marca (para la pantalla ¡GOOOL!): nombre de camiseta, dorsal, foto y quién la dio. */
export type LiveScorer = { name: string; number: number | null; photo: string | null; assist: string | null; goalsToday: number };

export async function fetchLiveEvents(supabase: DB, matchId: string): Promise<LiveEvent[]> {
  const { data } = await supabase.from("match_live_events").select("*").eq("match_id", matchId).returns<LiveEvent[]>();
  return (data ?? []).sort(byTime);
}

export async function fetchLiveView(
  supabase: DB,
  m: Pick<Match, "id" | "status" | "goals_for" | "goals_against" | "live_started_at" | "live_second_at"> & { season?: string; rival?: { name: string; short_name?: string | null } },
): Promise<LiveView> {
  const events = await fetchLiveEvents(supabase, m.id);
  const ids = [...new Set(events.flatMap((e) => [e.player_id, e.assist_id]).filter((x): x is string => !!x))];
  const [{ data: ps }, { data: nums }] = ids.length
    ? await Promise.all([
        supabase.from("players").select("id, first_name, last_name, nickname, photo_url").in("id", ids)
          .returns<Pick<Player, "id" | "first_name" | "last_name" | "nickname" | "photo_url">[]>(),
        m.season
          ? supabase.from("squad_members").select("player_id, number").eq("season", m.season).in("player_id", ids).returns<{ player_id: string; number: number | null }[]>()
          : Promise.resolve({ data: [] as { player_id: string; number: number | null }[] }),
      ])
    : [{ data: [] }, { data: [] }];
  const names = new Map((ps ?? []).map((p) => [p.id, shirtName(p)]));
  const photos = new Map((ps ?? []).map((p) => [p.id, p.photo_url ?? null]));
  const numbers = new Map((nums ?? []).map((n) => [n.player_id, n.number]));
  const tally = new Map<string, number>();
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
    events: events.map((e) => {
      // Goles de cada jugador hasta esta jugada (para «su 2º gol hoy»)
      const scorer = e.kind === "goal" && !e.own_goal && e.player_id ? e.player_id : null;
      if (scorer) tally.set(scorer, (tally.get(scorer) ?? 0) + 1);
      const who: LiveScorer | null = scorer
        ? { name: name(scorer) ?? "?", number: numbers.get(scorer) ?? null, photo: photos.get(scorer) ?? null, assist: name(e.assist_id), goalsToday: tally.get(scorer)! }
        : null;
      return { id: e.id, kind: e.kind, half: e.half, minute: e.minute, text: eventText(e, name, e), who };
    }),
    rival: m.rival?.name,
  };
}
