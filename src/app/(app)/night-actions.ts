"use server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { madridDay } from "@/lib/dates";
import { addDays } from "@/lib/matchday";
import type { NightCtx } from "@/lib/madrugada";
import type { Reply } from "@/lib/callups";

type Row = {
  id: string; match_date: string; kickoff: string | null; meet_time: string | null; status: string;
  goals_for: number | null; goals_against: number | null; mvp_player_id: string | null; callup_published_at: string | null;
  rival: { name: string; short_name: string | null };
};

/**
 * Lo que la sorpresa de madrugada necesita saber de ti: si hay partido hoy o mañana (y qué contestaste)
 * o si ayer se jugó (resultado, tus goles, si fuiste MVP). Solo se pide de madrugada y una vez por noche.
 */
export async function nightContext(): Promise<NightCtx | null> {
  const s = await getSession();
  const supabase = await createClient();
  const { data: me } = await supabase.from("players").select("id, first_name, nickname").eq("user_id", s.user.id).maybeSingle<{ id: string; first_name: string; nickname: string | null }>();
  const name = me?.nickname?.trim() || me?.first_name || s.profile.full_name.split(" ")[0] || null;
  const ctx: NightCtx = { name, player: !!me, next: null, last: null };
  if (!s.can("matches")) return ctx;

  const today = madridDay();
  const { data } = await supabase.from("matches")
    .select("id, match_date, kickoff, meet_time, status, goals_for, goals_against, mvp_player_id, callup_published_at, rival:rivals!inner(name, short_name)")
    .in("status", ["scheduled", "played"]).gte("match_date", addDays(today, -1)).lte("match_date", addDays(today, 1))
    .order("match_date").order("kickoff", { nullsFirst: false }).returns<Row[]>();
  const rows = data ?? [];

  // Ayer (o esta misma madrugada) ya jugado: la noche de después
  const played = rows.filter((m) => m.status === "played" && m.match_date <= today && m.goals_for != null && m.goals_against != null).pop();
  // Lo próximo: hoy más tarde o mañana
  const next = rows.find((m) => m.status === "scheduled" && m.match_date >= today);

  if (next) {
    let reply: Reply | null = null;
    if (me && next.callup_published_at) {
      const { data: c } = await supabase.from("match_callups").select("reply").eq("match_id", next.id).eq("player_id", me.id).maybeSingle<{ reply: Reply }>();
      reply = c?.reply ?? null;
    }
    ctx.next = { date: next.match_date, kickoff: next.kickoff, meet: next.meet_time, rival: next.rival.name, reply };
  } else if (played) {
    let goals = 0;
    if (me) {
      const { count } = await supabase.from("match_goals").select("id", { count: "exact", head: true }).eq("match_id", played.id).eq("scorer_id", me.id);
      goals = count ?? 0;
    }
    ctx.last = {
      date: played.match_date, gf: played.goals_for!, ga: played.goals_against!, rival: played.rival.name,
      goals, mvp: !!me && played.mvp_player_id === me.id, played: true,
    };
  }
  return ctx;
}
