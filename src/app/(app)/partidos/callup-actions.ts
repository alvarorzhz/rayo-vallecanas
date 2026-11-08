"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { replyButtons, usersOfPlayers } from "@/lib/callup-push";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { CLUB_NAME, hhmm, longDay, type MatchRow } from "@/lib/matches";
import { isFormation, slotsOf, type Reply } from "@/lib/callups";

export type CallupState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/row-level security|42501/.test(m) && !/convocad|cerrada|ficha/i.test(m)) return "No tienes permiso para hacer esto";
  return m;
};

function refresh(id: string) {
  revalidatePath(`/partidos/${id}`);
  revalidatePath(`/partidos/${id}/convocatoria`);
  revalidatePath("/");
}

const vs = (m: Pick<MatchRow, "is_home"> & { rival: { name: string } }) => (m.is_home ? `${CLUB_NAME} vs ${m.rival.name}` : `${m.rival.name} vs ${CLUB_NAME}`);
const meet = (m: Pick<MatchRow, "meet_time" | "meet_place">) =>
  m.meet_time || m.meet_place ? `Quedamos${m.meet_time ? ` a las ${hhmm(m.meet_time)}` : ""}${m.meet_place ? ` en ${m.meet_place}` : ""}.` : "";

/** Guarda la convocatoria (borrador o publicada) con la quedada y la alineación. */
export async function saveCallup(matchId: string, _: CallupState, f: FormData): Promise<CallupState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  if (!UUID.test(matchId)) return { error: "Partido no encontrado" };
  const supabase = await createClient();
  let publishedNow = false;
  let added: string[] = [];
  let m: MatchRow | null = null;
  try {
    const { data: match } = await supabase.from("matches").select("*, rival:rivals!inner(*)").eq("id", matchId).maybeSingle<MatchRow>();
    if (!match) throw new Error("Partido no encontrado");
    if (match.status === "played" || match.status === "cancelled") throw new Error("Este partido ya no admite convocatoria");
    m = match;

    const chosen = [...new Set(f.getAll("player").map(String).filter((x) => UUID.test(x)))];
    if (chosen.length > 25) throw new Error("Como mucho 25 convocados");
    const publish = str(f, "intent") === "publish" || !!match.callup_published_at;
    if (publish && chosen.length === 0) throw new Error("Elige al menos a un convocado");

    const mt = str(f, "meet_time");
    if (mt && !/^\d{2}:\d{2}$/.test(mt)) throw new Error("Hora de quedada no válida");
    const formation = isFormation(str(f, "formation")) ? str(f, "formation") : null;

    // Alineación: cada hueco con un convocado distinto
    const slots = slotsOf(formation);
    const lineup = new Map<string, number>();
    for (const sp of slots) {
      const pid = str(f, `slot_${sp.slot}`);
      if (!pid) continue;
      if (!chosen.includes(pid)) continue;
      if (lineup.has(pid)) throw new Error("Hay un jugador repetido en la alineación");
      lineup.set(pid, sp.slot);
    }

    const { data: before } = await supabase.from("match_callups").select("player_id").eq("match_id", matchId);
    const had = new Set((before ?? []).map((r) => r.player_id as string));
    const gone = [...had].filter((x) => !chosen.includes(x));
    added = chosen.filter((x) => !had.has(x));

    if (gone.length) {
      const { error } = await supabase.from("match_callups").delete().eq("match_id", matchId).in("player_id", gone);
      if (error) throw error;
    }
    // Se vacían los huecos antes de recolocar (cada hueco es único por partido)
    if (had.size) {
      const { error } = await supabase.from("match_callups").update({ slot: null }).eq("match_id", matchId).not("slot", "is", null);
      if (error) throw error;
    }
    if (added.length) {
      const { error } = await supabase.from("match_callups").insert(added.map((player_id) => ({ match_id: matchId, player_id })));
      if (error) throw error;
    }
    for (const [player_id, slot] of lineup) {
      const { error } = await supabase.from("match_callups").update({ slot }).eq("match_id", matchId).eq("player_id", player_id);
      if (error) throw error;
    }

    publishedNow = publish && !match.callup_published_at;
    const patch = {
      meet_time: mt || null,
      meet_place: str(f, "meet_place").slice(0, 120) || null,
      callup_notes: str(f, "callup_notes").slice(0, 1000) || null,
      formation,
      ...(publishedNow ? { callup_published_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase.from("matches").update(patch).eq("id", matchId);
    if (error) throw error;
    m = { ...match, ...patch };
  } catch (e) {
    return { error: errMsg(e) };
  }

  // Aviso a los convocados: a todos al publicar, a los nuevos si ya estaba publicada
  if (m && (m.callup_published_at || publishedNow) && f.get("notify") === "on") {
    const targets = publishedNow ? f.getAll("player").map(String) : added;
    const users = (await usersOfPlayers(targets)).filter((u) => u !== s.user.id);
    await sendPush(users, {
      title: "⚽ ¡Estás convocado!",
      body: `${vs(m)} · ${longDay(m.match_date)}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}. ${meet(m)} ¿Vas?`.replace(/\s+/g, " ").trim(),
      url: `/partidos/${matchId}`,
      tag: `convocatoria-${matchId}`,
    }, await replyButtons(matchId, m.match_date));
  }
  refresh(matchId);
  redirect(`/partidos/${matchId}?convocatoria=${publishedNow ? "publicada" : "guardada"}#convocatoria`);
}

/** Borra la convocatoria entera (vuelve a no tener). */
export async function deleteCallup(matchId: string): Promise<CallupState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { error } = await supabase.from("match_callups").delete().eq("match_id", matchId);
  if (error) return { error: errMsg(error) };
  const { error: e2 } = await supabase.from("matches")
    .update({ callup_published_at: null, callup_reminded_at: null, meet_time: null, meet_place: null, callup_notes: null, formation: null }).eq("id", matchId);
  if (e2) return { error: errMsg(e2) };
  refresh(matchId);
  redirect(`/partidos/${matchId}`);
}

/** El propio jugador contesta. */
export async function replyCallup(matchId: string, _: CallupState, f: FormData): Promise<CallupState> {
  const reply = str(f, "reply") as Reply;
  if (!["yes", "no", "maybe"].includes(reply)) return { error: "Elige una respuesta" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("callup_reply", { p_match: matchId, p_reply: reply, p_note: str(f, "note").slice(0, 140) || null });
  if (error) return { error: errMsg(error) };
  refresh(matchId);
  return { ok: reply === "yes" ? "¡Apuntado! Nos vemos en el campo." : reply === "no" ? "Anotado. ¡Otra vez será!" : "Anotado. Confírmalo cuando lo sepas." };
}

/** Un gestor apunta la respuesta de un jugador (el que no usa la app o avisó por WhatsApp). */
export async function setReplyFor(matchId: string, playerId: string, reply: Reply): Promise<CallupState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  if (!["pending", "yes", "no", "maybe"].includes(reply)) return { error: "Respuesta no válida" };
  const supabase = await createClient();
  const { error } = await supabase.from("match_callups")
    .update({ reply, replied_at: reply === "pending" ? null : new Date().toISOString(), replied_by: reply === "pending" ? null : s.user.id, ...(reply === "pending" ? { reply_note: null } : {}) })
    .eq("match_id", matchId).eq("player_id", playerId);
  if (error) return { error: errMsg(error) };
  refresh(matchId);
  return { ok: "Guardado" };
}

/** Recordatorio manual a los que no han contestado. */
export async function remindPending(matchId: string): Promise<CallupState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select("*, rival:rivals!inner(*)").eq("id", matchId).maybeSingle<MatchRow>();
  if (!m?.callup_published_at) return { error: "Publica antes la convocatoria" };
  const { data: rows } = await supabase.from("match_callups").select("player_id").eq("match_id", matchId).eq("reply", "pending");
  const users = (await usersOfPlayers((rows ?? []).map((r) => r.player_id as string))).filter((u) => u !== s.user.id);
  if (!users.length) return { ok: "No hay nadie con la app pendiente de contestar." };
  const sent = await sendPush(users, {
    title: "⏰ ¿Vas al partido?",
    body: `${vs(m)} · ${longDay(m.match_date)}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}. Contesta a la convocatoria.`,
    url: `/partidos/${matchId}`,
    tag: `convocatoria-${matchId}`,
  }, await replyButtons(matchId, m.match_date));
  return { ok: sent ? `Recordatorio enviado a ${users.length} ${users.length === 1 ? "jugador" : "jugadores"}.` : "Ninguno de ellos tiene los avisos activados en el móvil." };
}
