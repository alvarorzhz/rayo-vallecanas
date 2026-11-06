"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/receipt";
import { tempPassword } from "@/lib/password";

export type ActionState = { error?: string; ok?: string; password?: string; name?: string; phone?: string | null; email?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const MODULES = ["lottery_admin", "lottery_sell", "users", "finances", "squad", "squad_private", "matches"] as const;

export async function inviteUser(_: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "users", p_action: "create" });
  if (!allowed) return { error: "No tienes permiso para dar de alta usuarios" };

  const email = str(f, "email").toLowerCase();
  const full_name = str(f, "full_name");
  const phone = str(f, "phone") || null;
  const role = str(f, "role") || "player";
  if (!email || !full_name) return { error: "Nombre y email son obligatorios" };

  const admin = createAdminClient();
  const byEmail = str(f, "mode") === "email";
  // Sin dominio propio el email de Supabase tiene un límite muy bajo, así que por defecto
  // se crea el usuario con una contraseña provisional que el gestor le pasa por WhatsApp.
  const password = byEmail ? undefined : tempPassword();
  const { data, error } = byEmail
    ? await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, phone },
        redirectTo: `${siteUrl()}/auth/callback?next=/auth/nueva-clave`,
      })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, phone } });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "Ya existe un usuario con ese email" : error.message };
  if (!byEmail) await admin.from("profiles").update({ must_change_password: true }).eq("id", data.user.id);

  // El rol se asigna con la sesión del usuario actual: la BD comprueba que puede hacerlo.
  if (role !== "player") {
    const { error: roleErr } = await supabase.from("profiles").update({ role }).eq("id", data.user.id);
    if (roleErr) return { error: `Usuario creado, pero no se pudo asignar el rol: ${roleErr.message}` };
  }
  revalidatePath("/admin/usuarios");
  if (byEmail) return { ok: `Invitación enviada a ${email}` };
  return { ok: `Usuario creado: ${full_name}`, password, name: full_name, phone, email };
}

export async function updateUser(uid: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(f, "full_name"),
      phone: str(f, "phone") || null,
      role: str(f, "role"),
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

/** Crea una contraseña provisional nueva (por si la olvida o no le llega el email). */
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
