"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { pollAudienceUsers, pollButtons } from "@/lib/poll-push";
import { checkClose, closesAt, timeLeft, type PollAudience } from "@/lib/polls";

export type PollState = { error?: string; ok?: string } | undefined;

const canManage = (s: Awaited<ReturnType<typeof getSession>>) => s.can("users", "update") || s.can("lottery_admin", "update");

function refresh() {
  revalidatePath("/votaciones", "layout");
  revalidatePath("/admin/avisos");
  revalidatePath("/");
}

/** Lanza una votación y avisa a sus destinatarios. */
export async function createPoll(_: PollState, f: FormData): Promise<PollState> {
  const s = await getSession();
  if (!canManage(s)) return { error: "No tienes permiso para lanzar votaciones" };
  const question = String(f.get("question") ?? "").trim().slice(0, 140);
  const details = String(f.get("details") ?? "").trim().slice(0, 500) || null;
  const audience = String(f.get("audience") ?? "all") as PollAudience;
  if (!["all", "player", "admin"].includes(audience)) return { error: "Elige a quién va dirigida" };
  if (question.length < 3) return { error: "Escribe la pregunta" };
  const custom = f.get("duration") === "custom";
  const at = closesAt(custom ? { until: String(f.get("until") ?? "") } : { hours: Number(f.get("duration")) });
  const bad = checkClose(at);
  if (bad) return { error: bad };

  const supabase = await createClient();
  const { data: poll, error } = await supabase.from("polls")
    .insert({ question, details, audience, anonymous: f.get("anonymous") === "on", closes_at: at!.toISOString(), created_by: s.user.id })
    .select("id, closes_at").single();
  if (error || !poll) return { error: "No se pudo crear la votación" };

  if (f.get("notify") === "on") {
    const users = (await pollAudienceUsers(audience)).filter((u) => u !== s.user.id);
    await sendPush(users, {
      title: "🗳️ Nueva votación",
      body: `${question} · ${timeLeft(poll.closes_at).replace("Quedan", "Tienes")} para votar.`,
      url: `/votaciones#${poll.id}`,
      tag: `votacion-${poll.id}`,
    }, await pollButtons(poll.id, poll.closes_at));
  }
  refresh();
  redirect(`/votaciones?nueva=1#${poll.id}`);
}

/** Vota (o cambia el voto). */
export async function votePoll(pollId: string, vote: boolean): Promise<PollState> {
  await getSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("poll_vote", { p_poll: pollId, p_vote: vote });
  if (error) return { error: error.message };
  refresh();
  return { ok: vote ? "Has votado SÍ" : "Has votado NO" };
}

/** Recuerda la votación a quien todavía no ha votado. */
export async function remindPoll(pollId: string): Promise<PollState> {
  const s = await getSession();
  if (!canManage(s)) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { data: p } = await supabase.from("polls").select("id, question, audience, closes_at").eq("id", pollId).maybeSingle();
  if (!p) return { error: "Esta votación ya no existe" };
  if (new Date(p.closes_at) <= new Date()) return { error: "La votación ya está cerrada" };
  // Quién ha votado: con la clave de servicio (cada uno solo ve su voto). No se enseña a nadie.
  const { data: votes } = await createAdminClient().from("poll_votes").select("user_id").eq("poll_id", pollId);
  const voted = new Set((votes ?? []).map((v) => v.user_id as string));
  const users = (await pollAudienceUsers(p.audience as PollAudience)).filter((u) => !voted.has(u) && u !== s.user.id);
  if (!users.length) return { ok: "Ya ha votado todo el mundo." };
  const sent = await sendPush(users, {
    title: "⏰ Falta tu voto",
    body: `${p.question} · ${timeLeft(p.closes_at)}.`,
    url: `/votaciones#${p.id}`,
    tag: `votacion-${p.id}`,
  }, await pollButtons(p.id, p.closes_at));
  await supabase.from("polls").update({ reminded_at: new Date().toISOString() }).eq("id", pollId);
  refresh();
  return sent
    ? { ok: `Recordatorio enviado a ${users.length} ${users.length === 1 ? "persona" : "personas"} (${sent} ${sent === 1 ? "dispositivo" : "dispositivos"}).` }
    : { error: "Los que faltan no tienen los avisos activados." };
}

/** Cierra la votación ya, antes de su hora. */
export async function closePoll(pollId: string): Promise<PollState> {
  const s = await getSession();
  if (!canManage(s)) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { error } = await supabase.from("polls").update({ closes_at: new Date().toISOString() }).eq("id", pollId).gt("closes_at", new Date().toISOString());
  if (error) return { error: "No se pudo cerrar" };
  refresh();
  return { ok: "Votación cerrada" };
}

/** Borra la votación y sus votos. */
export async function deletePoll(pollId: string): Promise<PollState> {
  const s = await getSession();
  if (!canManage(s)) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) return { error: "No se pudo borrar" };
  refresh();
  return { ok: "Votación borrada" };
}
