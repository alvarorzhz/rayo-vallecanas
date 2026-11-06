"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tempPassword } from "@/lib/password";
import { DOC_KINDS, DOC_MAX_BYTES, DOC_MIME, POSITIONS, STAT_KEYS, STAT_LABEL, seasonSlug } from "@/lib/squad";
import type { AvatarState } from "@/app/(app)/perfil/actions";

export type ActionState = { error?: string; ok?: string; password?: string; name?: string; phone?: string | null; email?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => str(f, k) || null;
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/squad_members_number_uniq/.test(m)) return "Ese dorsal ya lo tiene otro jugador esta temporada";
  if (/squad_members_armband_uniq/.test(m)) return "Ya hay otro jugador con ese brazalete esta temporada";
  if (/players_user_id_key/.test(m)) return "Ese usuario ya está vinculado a otra ficha";
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  if (/finance_movements_player_id_fkey/.test(m)) return "Tiene cuotas cobradas en Finanzas: márcalo como baja definitiva en vez de eliminarlo";
  return m;
};

function refresh(id?: string) {
  revalidatePath("/plantilla", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/plantilla/${id}`);
}

const date = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Fecha no válida");
  return v || null;
};

function playerFromForm(f: FormData) {
  const first_name = str(f, "first_name");
  if (!first_name) throw new Error("Indica el nombre");
  const height = str(f, "height_cm");
  const height_cm = height ? Number(height) : null;
  if (height_cm != null && (!Number.isInteger(height_cm) || height_cm < 120 || height_cm > 230)) throw new Error("Altura no válida (en cm)");
  const foot = ["right", "left", "both"].includes(str(f, "foot")) ? str(f, "foot") : null;
  return {
    first_name: first_name.slice(0, 60),
    last_name: str(f, "last_name").slice(0, 80),
    nickname: opt(f, "nickname")?.slice(0, 24) ?? null,
    foot,
    height_cm,
    joined_club_on: date(f, "joined_club_on"),
  };
}

/** Datos personales del formulario (solo si el formulario los trae: sin permiso no se muestran ni se tocan). */
function privateFromForm(f: FormData) {
  if (!f.has("phone")) return null;
  return {
    birth_date: date(f, "birth_date"),
    phone: opt(f, "phone"),
    email: opt(f, "email")?.toLowerCase() ?? null,
    emergency_name: opt(f, "emergency_name"),
    emergency_phone: opt(f, "emergency_phone"),
    sport_notes: opt(f, "sport_notes"),
    internal_notes: opt(f, "internal_notes"),
  };
}

function memberFromForm(f: FormData, prevStatus?: string) {
  const season = str(f, "season");
  if (!/^\d{4}\/\d{2}$/.test(season)) throw new Error("Temporada no válida");
  const position = str(f, "position");
  if (!POSITIONS.some((p) => p.code === position)) throw new Error("Elige la posición");
  const num = str(f, "number");
  const number = num ? Number(num) : null;
  if (number != null && (!Number.isInteger(number) || number < 1 || number > 99)) throw new Error("El dorsal tiene que ser del 1 al 99");
  const status = ["active", "injured", "away", "left"].includes(str(f, "status")) ? str(f, "status") : "active";
  const armband = ["captain", "vice"].includes(str(f, "armband")) ? str(f, "armband") : null;
  const today = new Date().toISOString().slice(0, 10);
  const stats: Record<string, number> = {};
  for (const k of STAT_KEYS) {
    if (!f.has(k)) continue;
    const n = Number(str(f, k) || 0);
    if (!Number.isInteger(n) || n < 0 || n > 999) throw new Error(`${STAT_LABEL[k].long}: número no válido`);
    stats[k] = n;
  }
  if (stats.starts != null && stats.apps != null && stats.starts > stats.apps) throw new Error("No puede tener más partidos de titular que jugados");
  return {
    ...stats,
    season,
    number,
    position,
    status,
    armband: status === "left" ? null : armband,
    ...(status === "left" && prevStatus !== "left" ? { left_on: today } : {}),
    ...(status !== "left" && prevStatus === "left" ? { left_on: null } : {}),
  };
}

export async function createPlayer(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  const supabase = await createClient();
  try {
    const member = memberFromForm(f);
    const { data, error } = await supabase.from("players").insert(playerFromForm(f)).select("id").single();
    if (error) throw error;
    id = data.id;
    const priv = privateFromForm(f);
    const steps = await Promise.all([
      priv ? supabase.from("player_private").update(priv).eq("player_id", id) : Promise.resolve({ error: null }),
      supabase.from("squad_members").insert({ ...member, player_id: id, joined_on: new Date().toISOString().slice(0, 10) }),
    ]);
    const failed = steps.find((r) => r.error)?.error;
    if (failed) {
      // Sin dorsal válido no se queda una ficha a medias
      await supabase.from("players").delete().eq("id", id);
      throw failed;
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  redirect(f.get("again") === "1" ? `/plantilla/nuevo?temporada=${seasonSlug(str(f, "season"))}&ok=1` : `/plantilla/${id}?temporada=${seasonSlug(str(f, "season"))}&ok=1`);
}

export async function updatePlayer(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  try {
    const season = str(f, "season");
    const { data: prev } = await supabase.from("squad_members").select("id, status").eq("player_id", id).eq("season", season).maybeSingle();
    const member = memberFromForm(f, prev?.status);
    const { error } = await supabase.from("players").update(playerFromForm(f)).eq("id", id);
    if (error) throw error;
    const priv = privateFromForm(f);
    if (priv) {
      const { error: e2 } = await supabase.from("player_private").update(priv).eq("player_id", id);
      if (e2) throw e2;
    }
    const { error: e3 } = prev
      ? await supabase.from("squad_members").update(member).eq("id", prev.id)
      : await supabase.from("squad_members").insert({ ...member, player_id: id, joined_on: new Date().toISOString().slice(0, 10) });
    if (e3) throw e3;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(id);
  redirect(`/plantilla/${id}?temporada=${seasonSlug(str(f, "season"))}&ok=2`);
}

export async function deletePlayer(id: string) {
  const supabase = await createClient();
  const { data: p } = await supabase.from("players").select("photo_url").eq("id", id).single();
  const { data: gone, error } = await supabase.from("players").delete().eq("id", id).select("id");
  if (error || !gone?.length) throw new Error(error ? errMsg(error) : "No tienes permiso para eliminar fichas");
  if (p?.photo_url) await removePhotos(supabase, id);
  refresh();
  redirect("/plantilla?ok=eliminado");
}

// ------------------------------------------------------------------ Foto

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadPlayerPhoto(id: string, _: AvatarState, form: FormData): Promise<AvatarState> {
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto" };
  const ext = TYPES[file.type];
  if (!ext) return { error: "La foto debe ser JPG, PNG o WEBP" };
  if (file.size > 1024 * 1024) return { error: "La foto es demasiado grande (máximo 1 MB)" };
  const supabase = await createClient();
  const path = `${id}/foto-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("player-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: "No se pudo subir la foto: " + errMsg(error) };
  const url = supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await supabase.from("players").update({ photo_url: url }).eq("id", id);
  if (e2) return { error: "No se pudo guardar la foto: " + errMsg(e2) };
  await removePhotos(supabase, id, path);
  refresh(id);
  return { ok: "¡Foto actualizada!" };
}

export async function removePlayerPhoto(id: string): Promise<AvatarState> {
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ photo_url: null }).eq("id", id);
  if (error) return { error: errMsg(error) };
  await removePhotos(supabase, id);
  refresh(id);
  return { ok: "Foto quitada" };
}

async function removePhotos(supabase: Awaited<ReturnType<typeof createClient>>, id: string, keep?: string) {
  const { data } = await supabase.storage.from("player-photos").list(id);
  const old = (data ?? []).map((f) => `${id}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from("player-photos").remove(old);
}

// ------------------------------------------------------------------ Usuario de la app

export async function linkUser(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const uid = str(f, "user_id");
  if (!uid) return { error: "Elige un usuario" };
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ user_id: uid }).eq("id", id);
  if (error) return { error: errMsg(error) };
  refresh(id);
  return { ok: "Ficha vinculada con su usuario" };
}

export async function unlinkUser(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ user_id: null }).eq("id", id);
  if (error) throw new Error(errMsg(error));
  refresh(id);
}

/** Crea el usuario de la app con contraseña provisional y lo vincula con la ficha. */
export async function createAccess(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const [{ data: canUsers }, { data: canSquad }] = await Promise.all([
    supabase.rpc("has_perm", { p_module: "users", p_action: "create" }),
    supabase.rpc("has_perm", { p_module: "squad", p_action: "update" }),
  ]);
  if (!canUsers || !canSquad) return { error: "No tienes permiso para dar de alta usuarios" };
  const email = str(f, "email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Indica un email válido: será su usuario para entrar" };

  const [{ data: p }, { data: priv }] = await Promise.all([
    supabase.from("players").select("first_name, last_name, user_id").eq("id", id).single(),
    supabase.from("player_private").select("phone").eq("player_id", id).single(),
  ]);
  if (!p) return { error: "Ficha no encontrada" };
  if (p.user_id) return { error: "Esta ficha ya tiene usuario" };
  const full_name = `${p.first_name} ${p.last_name}`.trim();
  const phone = priv?.phone ?? null;

  const password = tempPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "Ya existe un usuario con ese email: vincúlalo con la opción de arriba" : error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);
  const { error: e2 } = await supabase.from("players").update({ user_id: data.user.id }).eq("id", id);
  if (e2) return { error: `Usuario creado, pero no se pudo vincular: ${errMsg(e2)}` };
  await supabase.from("player_private").update({ email }).eq("player_id", id).is("email", null);
  // Sin revalidar: si la ficha se recargase ahora, se perdería la contraseña que hay que enseñar.
  // El botón «Cerrar» del resultado recarga la página.
  return { ok: `Acceso creado para ${full_name}`, password, name: full_name, phone, email };
}

// ------------------------------------------------------------------ El propio jugador

export async function updateMyContact(_: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  let birth: string | null;
  try {
    birth = date(f, "birth_date");
  } catch (e) {
    return { error: errMsg(e) };
  }
  const { error } = await supabase.rpc("squad_update_my_contact", {
    p_phone: str(f, "phone"),
    p_email: str(f, "email"),
    p_emergency_name: str(f, "emergency_name"),
    p_emergency_phone: str(f, "emergency_phone"),
    p_birth_date: birth,
  });
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: "¡Datos guardados!" };
}

// ------------------------------------------------------------------ Temporadas

/**
 * Prepara una temporada copiando a los jugadores elegidos de otra: misma posición y,
 * si se pide, mismo dorsal y brazalete. Las estadísticas empiezan a cero.
 */
export async function prepareSeason(_: ActionState, f: FormData): Promise<ActionState> {
  const from = str(f, "from");
  const to = str(f, "to");
  if (!/^\d{4}\/\d{2}$/.test(from) || !/^\d{4}\/\d{2}$/.test(to) || from === to) return { error: "Temporadas no válidas" };
  const ids = f.getAll("player").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  if (!ids.length) return { error: "Elige al menos un jugador" };
  const keepNumbers = f.get("keep_numbers") === "on";
  const keepArmbands = f.get("keep_armbands") === "on";

  const supabase = await createClient();
  const { data: canCreate } = await supabase.rpc("has_perm", { p_module: "squad", p_action: "create" });
  if (!canCreate) return { error: "No tienes permiso para preparar temporadas" };
  // Lo último de cada jugador (de la temporada de origen o, si no estaba, de su última temporada)
  const [{ data: rows }, { data: already }] = await Promise.all([
    supabase.from("squad_members").select("player_id, season, number, position, status, armband").in("player_id", ids).lte("season", from).order("season", { ascending: false }),
    supabase.from("squad_members").select("player_id, number, armband").eq("season", to),
  ]);
  const inTarget = new Set((already ?? []).map((r) => r.player_id));
  const usedNumbers = new Set((already ?? []).map((r) => r.number).filter((n) => n != null));
  const usedArmbands = new Set((already ?? []).map((r) => r.armband).filter(Boolean));
  const last = new Map<string, NonNullable<typeof rows>[number]>();
  for (const r of rows ?? []) if (!last.has(r.player_id)) last.set(r.player_id, r);

  const start = `${to.slice(0, 4)}-09-01`;
  const inserts = [];
  let renumbered = 0;
  for (const id of ids) {
    const r = last.get(id);
    if (!r || inTarget.has(id)) continue;
    let number = keepNumbers ? r.number : null;
    if (number != null && usedNumbers.has(number)) { number = null; renumbered++; }
    if (number != null) usedNumbers.add(number);
    let armband = keepArmbands && r.season === from ? r.armband : null;
    if (armband && usedArmbands.has(armband)) armband = null;
    if (armband) usedArmbands.add(armband);
    inserts.push({ player_id: id, season: to, number, position: r.position, status: r.status === "left" ? "active" : r.status, armband, joined_on: start });
  }
  if (!inserts.length) return { error: `Esos jugadores ya están en la temporada ${to}` };
  const { error } = await supabase.from("squad_members").insert(inserts);
  if (error) return { error: errMsg(error) };
  refresh();
  redirect(`/plantilla?temporada=${seasonSlug(to)}&preparada=${inserts.length}${renumbered ? `&sindorsal=${renumbered}` : ""}`);
}

/** Da de baja definitiva a un jugador en una temporada, con fecha. */
export async function retirePlayer(id: string, season: string, _: ActionState, f: FormData): Promise<ActionState> {
  let left_on: string | null;
  try {
    left_on = date(f, "left_on") ?? new Date().toISOString().slice(0, 10);
  } catch (e) {
    return { error: errMsg(e) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("squad_members").update({ status: "left", left_on, armband: null }).eq("player_id", id).eq("season", season).select("id");
  if (error) return { error: errMsg(error) };
  if (!data?.length) return { error: "No tienes permiso para hacer esto" };
  refresh(id);
  return { ok: "Baja registrada. Su historia se conserva." };
}

/** Vuelve a poner en activo a un jugador que estaba de baja en esa temporada. */
export async function rejoinPlayer(id: string, season: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("squad_members").update({ status: "active", left_on: null }).eq("player_id", id).eq("season", season).select("id");
  if (error) return { error: errMsg(error) + ". Cámbiale el dorsal desde Editar." };
  if (!data?.length) return { error: "No tienes permiso para hacer esto" };
  refresh(id);
  return { ok: "¡Vuelve al equipo!" };
}

// ------------------------------------------------------------------ Documentos

/**
 * Guarda un documento en la ficha. El archivo lo sube antes el navegador directamente al bucket
 * privado (así no pasa por el servidor, que tiene límite de tamaño); aquí se apuntan sus datos.
 * Pueden hacerlo los gestores con permiso de datos personales o el propio jugador (lo comprueba RLS).
 */
export async function savePlayerDoc(playerId: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const path = str(f, "file_path");
  if (!new RegExp(`^${playerId}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`).test(path)) return { error: "Sube primero el archivo" };
  const mime = str(f, "mime_type");
  const size = Number(str(f, "size_bytes"));
  if (!DOC_MIME.includes(mime) || !(size > 0 && size <= DOC_MAX_BYTES)) return { error: "Archivo no válido" };
  const kind = DOC_KINDS.some((d) => d.key === str(f, "kind")) ? str(f, "kind") : "other";
  try {
    const { data: auth } = await supabase.auth.getClaims();
    const { error } = await supabase.from("player_documents").insert({
      player_id: playerId,
      kind,
      title: opt(f, "title")?.slice(0, 80) ?? null,
      file_path: path,
      file_name: (str(f, "file_name") || path.split("/")[1]).slice(0, 120),
      mime_type: mime,
      size_bytes: size,
      expires_on: date(f, "expires_on"),
      uploaded_by: auth?.claims?.sub,
    });
    if (error) throw error;
  } catch (e) {
    await supabase.storage.from("player-docs").remove([path]);
    return { error: errMsg(e) };
  }
  revalidatePath(`/plantilla/${playerId}`);
  revalidatePath("/plantilla/documentos");
  return { ok: "Documento guardado" };
}

export async function deletePlayerDoc(docId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("player_documents").select("player_id, file_path").eq("id", docId).maybeSingle();
  if (!doc) return { error: "Ese documento ya no existe" };
  const { data: gone, error } = await supabase.from("player_documents").delete().eq("id", docId).select("id");
  if (error) return { error: errMsg(error) };
  if (!gone?.length) return { error: "No tienes permiso para borrar este documento" };
  await supabase.storage.from("player-docs").remove([doc.file_path]);
  revalidatePath(`/plantilla/${doc.player_id}`);
  revalidatePath("/plantilla/documentos");
  return { ok: "Documento borrado" };
}
