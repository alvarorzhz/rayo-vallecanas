"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { fecha } from "@/lib/format";
import { isDay, madridEndOfDay, parseAnswer, MAX_BODY, QUESTIONS } from "@/lib/capsule";
import { seasonSlug } from "@/lib/squad";

export type CapsuleFormState = { ok?: string; error?: string } | undefined;

const SEASON = /^\d{4}\/\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** El error de la base de datos, en palabras de la app. */
function friendly(msg: string): string {
  if (/permiso|42501|row-level/i.test(msg)) return "No tienes permiso para hacer esto";
  return msg;
}

const back = (season: string) => `/partidos/capsula?temporada=${seasonSlug(season)}`;

/** Crear (o cambiar las fechas de) la cápsula de una temporada. Solo quien puede preparar la temporada. */
export async function saveCapsule(_: CapsuleFormState, fd: FormData): Promise<CapsuleFormState> {
  const s = await getSession();
  if (!s.can("squad", "create")) return { error: "No tienes permiso para hacer esto" };
  const season = String(fd.get("season") ?? "");
  const writeUntil = String(fd.get("write_until") ?? "");
  const opensOn = String(fd.get("opens_on") ?? "");
  const isNew = fd.get("new") === "1";
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  if (!isDay(writeUntil) || !isDay(opensOn)) return { error: "Pon las dos fechas" };
  if (opensOn < writeUntil) return { error: "La gala tiene que ser después de que se cierre la cápsula" };
  const until = madridEndOfDay(writeUntil);
  if (isNew && new Date(until) <= new Date()) return { error: "El día para escribir ya ha pasado: elige uno más adelante" };
  const supabase = await createClient();
  const row: Record<string, unknown> = { season, write_until: until, opens_on: opensOn };
  const pos = String(fd.get("final_position") ?? "").trim();
  if (!isNew && pos) {
    if (!/^\d{1,2}$/.test(pos) || Number(pos) < 1) return { error: "Puesto no válido" };
    row.final_position = Number(pos);
  }
  const { error } = isNew
    ? await supabase.from("time_capsules").insert(row)
    : await supabase.from("time_capsules").update(row).eq("season", season);
  if (error) return { error: /duplicate|23505/.test(error.message) ? "Ya hay una cápsula para esa temporada" : friendly(error.message) };

  if (isNew && fd.get("notify") === "on") {
    after(async () => {
      const { data: people } = await createAdminClient().from("profiles").select("id").eq("active", true).neq("id", s.user.id);
      await sendPush((people ?? []).map((p) => p.id as string), {
        title: `🔒 Cápsula del tiempo ${season}`,
        body: `Deja tus predicciones y un mensaje para el final de la temporada. Nadie lo leerá hasta entonces. Tienes hasta el ${fecha(until)}.`,
        url: back(season), tag: `capsula-${season}`,
      });
    });
  }
  revalidatePath("/partidos/capsula");
  revalidatePath("/");
  if (isNew) redirect(`${back(season)}&creada=1`);
  return { ok: "Cambios guardados" };
}

/** Borrar una cápsula vacía (la base de datos no deja si ya hay algo escrito). */
export async function deleteCapsule(season: string): Promise<CapsuleFormState> {
  const s = await getSession();
  if (!s.can("squad", "create") || !SEASON.test(season)) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const { error } = await supabase.from("time_capsules").delete().eq("season", season);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/partidos/capsula");
  redirect("/partidos/capsula");
}

/** Guardar mis predicciones (las que deje vacías se borran). */
export async function savePredictions(_: CapsuleFormState, fd: FormData): Promise<CapsuleFormState> {
  const season = String(fd.get("season") ?? "");
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const supabase = await createClient();
  let saved = 0;
  for (const q of QUESTIONS) {
    const raw = String(fd.get(q.key) ?? "").trim();
    let player: string | null = null;
    let number: number | null = null;
    if (raw) {
      if (q.kind === "player") {
        if (!UUID.test(raw)) return { error: `Elige un jugador en «${q.label}»` };
        player = raw;
      } else {
        number = parseAnswer(q, raw);
        if (number === null) return { error: `«${q.label}»: pon un número entre ${q.min} y ${q.max}` };
      }
    }
    const { error } = await supabase.rpc("capsule_predict", { p_season: season, p_question: q.key, p_player: player, p_number: number });
    if (error) return { error: friendly(error.message) };
    if (raw) saved++;
  }
  revalidatePath("/partidos/capsula");
  revalidatePath("/");
  return { ok: saved ? `🔒 ${saved} ${saved === 1 ? "predicción guardada" : "predicciones guardadas"} bajo llave` : "Predicciones borradas" };
}

/** Escribir un mensaje nuevo o cambiar uno mío. */
export async function saveMessage(_: CapsuleFormState, fd: FormData): Promise<CapsuleFormState> {
  const season = String(fd.get("season") ?? "");
  const id = String(fd.get("id") ?? "") || null;
  const to = String(fd.get("to") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  if (id && !UUID.test(id)) return { error: "Mensaje no válido" };
  if (to && to !== "team" && !UUID.test(to)) return { error: "Elige para quién es" };
  if (!body) return { error: "Escribe el mensaje" };
  if (body.length > MAX_BODY) return { error: `Como mucho ${MAX_BODY} letras` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("capsule_message_save", { p_season: season, p_id: id, p_to: to && to !== "team" ? to : null, p_body: body });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/partidos/capsula");
  revalidatePath("/");
  return { ok: id ? "Mensaje cambiado" : "🔒 Mensaje guardado en la cápsula" };
}

export async function deleteMessage(id: string): Promise<CapsuleFormState> {
  if (!UUID.test(id)) return { error: "Mensaje no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("capsule_message_delete", { p_id: id });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/partidos/capsula");
  return { ok: "Mensaje borrado" };
}
