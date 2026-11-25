"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tempPassword } from "@/lib/password";
import { EDITABLE_MODULES, isUuid } from "@/lib/roles";

export type ActionState = { error?: string; ok?: string; password?: string; name?: string; phone?: string | null; email?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const MODULES = EDITABLE_MODULES;

/** «player», «admin», «superadmin» o el id de un perfil a medida → rol y perfil a medida. */
async function resolveProfile(supabase: Awaited<ReturnType<typeof createClient>>, key: string) {
  if (isUuid(key)) {
    const { data } = await supabase.from("custom_roles").select("id, base").eq("id", key).maybeSingle();
    if (!data) return null;
    return { role: data.base as string, custom_role_id: data.id as string };
  }
  if (!["player", "admin", "superadmin"].includes(key)) return null;
  return { role: key, custom_role_id: null };
}

export async function inviteUser(_: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "users", p_action: "create" });
  if (!allowed) return { error: "No tienes permiso para dar de alta usuarios" };

  const email = str(f, "email").toLowerCase();
  const full_name = str(f, "full_name");
  const phone = str(f, "phone") || null;
  const target = await resolveProfile(supabase, str(f, "profile") || "player");
  if (!target) return { error: "Ese perfil no existe" };
  if (!email || !full_name) return { error: "Nombre y email son obligatorios" };

  const admin = createAdminClient();
  // 4.30.4 · Siempre con contraseña provisional que el gestor le pasa por WhatsApp (sin invitación por email)
  const password = tempPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "Ya existe un usuario con ese email" : error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);

  // El rol se asigna con la sesión del usuario actual: la BD comprueba que puede hacerlo.
  if (target.role !== "player" || target.custom_role_id) {
    const { error: roleErr } = await supabase.from("profiles").update(target).eq("id", data.user.id);
    if (roleErr) return { error: `Usuario creado, pero no se pudo asignar el perfil: ${roleErr.message}` };
  }
  revalidatePath("/admin/usuarios");
  return { ok: `Usuario creado: ${full_name}`, password, name: full_name, phone, email };
}

export async function updateUser(uid: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const target = await resolveProfile(supabase, str(f, "profile"));
  if (!target) return { error: "Ese perfil no existe" };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(f, "full_name"),
      phone: str(f, "phone") || null,
      ...target,
    })
    .eq("id", uid);
  if (error) return { error: error.message };

  // Permisos personalizados por módulo
  for (const m of MODULES) {
    if (f.get(`${m}.custom`) === "on") {
      const { error: e } = await supabase.from("user_permissions").upsert({
        user_id: uid,
        module: m,
        can_read: f.get(`${m}.read`) === "on",
        can_create: f.get(`${m}.create`) === "on",
        can_update: f.get(`${m}.update`) === "on",
        can_delete: f.get(`${m}.delete`) === "on",
        updated_at: new Date().toISOString(),
      });
      if (e) return { error: e.message };
    } else {
      const { error: e } = await supabase.from("user_permissions").delete().eq("user_id", uid).eq("module", m);
      if (e) return { error: e.message };
    }
  }
  revalidatePath(`/admin/usuarios/${uid}`);
  revalidatePath("/admin/usuarios");
  return { ok: "Cambios guardados" };
}

/**
 * Deshabilita o habilita el acceso de un usuario. Se marca en su perfil (la app y la
 * base de datos lo bloquean al momento) y, si hay clave de servicio, se bloquea también
 * su inicio de sesión en Supabase Auth.
 */
export async function setUserAccess(uid: string, enable: boolean) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === uid) throw new Error("No puedes deshabilitarte a ti mismo");

  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "users", p_action: "update" });
  if (!allowed) throw new Error("No tienes permiso para cambiar el acceso de usuarios");

  const { data: target } = await supabase.from("profiles").select("removed_at").eq("id", uid).maybeSingle();
  if (target?.removed_at) throw new Error("Este usuario está dado de baja: no se puede volver a habilitar");

  // La base de datos vuelve a comprobarlo (y que solo un superadmin toque a otro superadmin)
  const { data: changed, error } = await supabase.from("profiles").update({ active: enable }).eq("id", uid).select("id");
  if (error) throw new Error(error.message);
  if (!changed?.length) throw new Error("No se pudo cambiar el acceso de este usuario");

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(uid, { ban_duration: enable ? "none" : "876000h" });
  } catch {
    // Sin clave de servicio basta con el perfil: la app le cierra la sesión al entrar
  }
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${uid}`);
}

/**
 * 4.30.7 · Da de baja a un usuario para siempre y borra sus datos personales (nombre,
 * email, teléfono, foto y cuenta de acceso). Sus ventas, cobros, apuntes y votos se
 * conservan a nombre de «Antiguo miembro». Lo hace la base de datos (remove_member),
 * que vuelve a comprobar los permisos; aquí se borran además los archivos de su foto.
 */
export async function removeMember(uid: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (str(f, "confirm").toUpperCase() !== "BAJA") return { error: "Escribe BAJA para confirmar" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === uid) return { error: "No puedes darte de baja a ti mismo" };
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "users", p_action: "delete" });
  if (!allowed) return { error: "No tienes permiso para dar de baja usuarios" };

  const { error } = await supabase.rpc("remove_member", { p_uid: uid });
  if (error) return { error: error.message };

  // Archivos de su foto de perfil (se guardan en avatars/<uid>/…)
  try {
    const admin = createAdminClient();
    const { data: files } = await admin.storage.from("avatars").list(uid, { limit: 100 });
    if (files?.length) await admin.storage.from("avatars").remove(files.map((x) => `${uid}/${x.name}`));
  } catch {
    // Sin clave de servicio la foto ya no se enseña en ningún sitio (el enlace se ha borrado)
  }
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${uid}`);
  redirect(`/admin/usuarios/${uid}`);
}

/** Crea una contraseña provisional nueva (por si la olvida o no le llega el correo de recuperación). */
export async function resetPassword(uid: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "users", p_action: "update" });
  if (!allowed) return { error: "No tienes permiso para cambiar contraseñas" };
  const { data: target } = await supabase.from("profiles").select("full_name, email, phone, role").eq("id", uid).single();
  if (!target) return { error: "Usuario no encontrado" };
  const { data: me } = await supabase.rpc("is_superadmin");
  if (target.role === "superadmin" && !me) return { error: "Solo un superadministrador puede cambiar la contraseña de otro superadministrador" };

  const password = tempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(uid, { password });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", uid);
  return { ok: `Contraseña provisional nueva para ${target.full_name}`, password, name: target.full_name, phone: target.phone, email: target.email ?? "" };
}
