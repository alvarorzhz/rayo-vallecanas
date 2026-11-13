"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { resultNotice } from "@/lib/result-watch";
import { CLUB_NAME, type MatchRow } from "@/lib/matches";
import { liveClock, liveScore, type LiveKind } from "@/lib/live";
import { fetchLiveEvents } from "@/lib/live-queries";

export type LiveState = { error?: string; ok?: string } | undefined;

const UUID = /^[0-9a-f-]{36}$/i;
const KINDS: LiveKind[] = ["goal", "goal_against", "yellow", "red"];
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  return m;
};

async function ready(matchId: string) {
  const s = await getSession();
  if (!s.can("matches", "update")) throw new Error("No tienes permiso para hacer esto");
  if (!UUID.test(matchId)) throw new Error("Partido no encontrado");
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("*, rival:rivals!inner(*)").eq("id", matchId).maybeSingle<MatchRow>();
  if (!m) throw new Error("Partido no encontrado");
  return { s, supabase, m };
}

function refresh(id: string) {
  revalidatePath("/");
  revalidatePath(`/partidos/${id}`);
  revalidatePath(`/partidos/${id}/directo`);
}

/** Pitido inicial (o empieza la segunda parte). */
export async function startHalf(matchId: string, half: 1 | 2): Promise<LiveState> {
  try {
    const { supabase, m } = await ready(matchId);
    if (m.status !== "scheduled") throw new Error("El partido ya no está pendiente");
    const patch = half === 1 ? { live_started_at: new Date().toISOString() } : { live_second_at: new Date().toISOString() };
    if (half === 2 && !m.live_started_at) Object.assign(patch, { live_started_at: new Date().toISOString() });
    const { error } = await supabase.from("matches").update(patch).eq("id", matchId);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(matchId);
  return { ok: half === 1 ? "¡Arranca el partido!" : "Segunda parte" };
}

/** Apunta un gol, un gol del rival o una tarjeta, con el minuto de ese momento. */
export async function addLiveEvent(matchId: string, input: { kind: LiveKind; player_id?: string | null; assist_id?: string | null; own_goal?: boolean }): Promise<LiveState> {
  try {
    const { supabase, m } = await ready(matchId);
    if (m.status !== "scheduled") throw new Error("El partido ya está finalizado: los cambios, en el acta");
    if (!KINDS.includes(input.kind)) throw new Error("No válido");
    const player = input.kind === "goal_against" || input.own_goal ? null : input.player_id && UUID.test(input.player_id) ? input.player_id : null;
    const assist = input.kind === "goal" && !input.own_goal && input.assist_id && UUID.test(input.assist_id) && input.assist_id !== player ? input.assist_id : null;
    if ((input.kind === "yellow" || input.kind === "red") && !player) throw new Error("Elige a quién le han sacado la tarjeta");
    const clock = liveClock(m);
    const { error } = await supabase.from("match_live_events").insert({
      match_id: matchId, kind: input.kind, player_id: player, assist_id: assist, own_goal: input.kind === "goal" && !!input.own_goal,
      half: clock?.half ?? null, minute: clock?.minute ?? null,
    });
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(matchId);
  return { ok: "Apuntado" };
}

/** Borra algo apuntado por error. */
export async function deleteLiveEvent(matchId: string, eventId: string): Promise<LiveState> {
  try {
    const { supabase, m } = await ready(matchId);
    if (m.status !== "scheduled") throw new Error("El partido ya está finalizado: los cambios, en el acta");
    if (!UUID.test(eventId)) throw new Error("No encontrado");
    const { error } = await supabase.from("match_live_events").delete().eq("id", eventId).eq("match_id", matchId);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(matchId);
  return { ok: "Borrado" };
}

/** Empezar de cero: quita el pitido inicial y todo lo apuntado (por si se empezó sin querer). */
export async function resetLive(matchId: string): Promise<LiveState> {
  try {
    const { supabase, m } = await ready(matchId);
    if (m.status !== "scheduled") throw new Error("El partido ya está finalizado");
    const { error: e1 } = await supabase.from("match_live_events").delete().eq("match_id", matchId);
    if (e1) throw e1;
    const { error } = await supabase.from("matches").update({ live_started_at: null, live_second_at: null }).eq("id", matchId);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(matchId);
  return { ok: "Directo reiniciado" };
}

/** Pitido final: guarda el marcador, avisa al equipo (si se quiere) y lleva al acta, ya rellena con lo apuntado. */
export async function finishLive(matchId: string, notify: boolean): Promise<LiveState> {
  try {
    const { s, supabase, m } = await ready(matchId);
    if (m.status !== "scheduled") throw new Error("El partido ya está finalizado");
    const { gf, ga } = liveScore(await fetchLiveEvents(supabase, matchId));
    const { error } = await supabase.from("matches").update({ goals_for: gf, goals_against: ga, status: "played" }).eq("id", matchId);
    if (error) throw error;
    if (notify) {
      const n = resultNotice({ gf, ga, home: m.is_home, club: CLUB_NAME, rival: m.rival.name });
      const { data } = await createAdminClient().from("profiles").select("id").eq("active", true).neq("id", s.user.id);
      await sendPush((data ?? []).map((p) => p.id), { title: n.title, body: n.body, url: `/partidos/${matchId}`, tag: `partido-${matchId}` });
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/partidos", "layout");
  refresh(matchId);
  redirect(`/partidos/${matchId}/acta?directo=1`);
}
