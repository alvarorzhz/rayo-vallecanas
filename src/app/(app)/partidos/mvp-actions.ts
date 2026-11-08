"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch } from "@/lib/match-queries";
import { announceMvpOpen } from "@/lib/mvp-server";
import { mvpClosesAt, untilLabel } from "@/lib/mvp";

export type MvpState = { error?: string; ok?: string } | undefined;

const UUID = /^[0-9a-f-]{36}$/i;

function refresh(matchId: string) {
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/");
}

/** Vota (o cambia el voto). */
export async function voteMvp(matchId: string, playerId: string): Promise<MvpState> {
  await getSession();
  if (!UUID.test(matchId) || !UUID.test(playerId)) return { error: "Voto no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mvp_vote", { p_match: matchId, p_candidate: playerId });
  if (error) return { error: error.message };
  refresh(matchId);
  return { ok: "¡Voto guardado!" };
}

/** Empate (o nadie votó): un gestor elige al MVP. */
export async function pickMvp(matchId: string, playerId: string): Promise<MvpState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  if (!UUID.test(matchId) || !UUID.test(playerId)) return { error: "Jugador no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mvp_pick", { p_match: matchId, p_player: playerId });
  if (error) return { error: error.message };
  refresh(matchId);
  revalidatePath("/plantilla", "layout");
  return { ok: "MVP elegido" };
}

/** Abre la votación a mano: con los que jugaron según el acta o, si no hay acta, con los que dijeron «Voy». */
export async function openMvp(matchId: string): Promise<MvpState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const m = await fetchMatch(supabase, matchId);
  if (!m || m.status !== "played") return { error: "Primero pon el resultado del partido" };
  const { data: apps } = await supabase.from("match_appearances").select("player_id").eq("match_id", matchId);
  let ids = (apps ?? []).map((a) => a.player_id as string);
  if (!ids.length) {
    const { data: going } = await supabase.from("match_callups").select("player_id").eq("match_id", matchId).eq("reply", "yes");
    ids = (going ?? []).map((c) => c.player_id as string);
  }
  if (!ids.length) return { error: "No hay a quién votar: rellena el acta o la convocatoria" };
  const closes = mvpClosesAt();
  const { data: opened, error } = await supabase.rpc("mvp_open", { p_match: matchId, p_candidates: ids, p_closes: closes.toISOString() });
  if (error) return { error: error.message };
  if (opened) await announceMvpOpen(m, untilLabel(closes), { except: s.user.id });
  refresh(matchId);
  return { ok: "¡Votación abierta! Ya le ha llegado el aviso al equipo." };
}
