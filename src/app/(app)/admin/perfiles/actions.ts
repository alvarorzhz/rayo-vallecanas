"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTS, EDITABLE_MODULES, blocked, isUuid, type Base } from "@/lib/roles";

export type ProfileState = { error?: string; ok?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function permRows(f: FormData, base: Base) {
  return EDITABLE_MODULES.map((m) => {
    const on = (a: string) => !blocked(base, m) && f.get(`${m}.${a}`) === "on";
    return { module: m, ...Object.fromEntries(ACTS.map((a) => [`can_${a}`, on(a)])) } as Record<string, string | boolean>;
  });
}

const errMsg = (e: { code?: string; message: string }) =>
  e.code === "23505" ? "Ya hay un perfil con ese nombre" :
  e.code === "42501" ? "Solo el superadministrador puede cambiar los perfiles" : e.message;

/** Guarda un perfil: los de siempre (gestor, jugador), uno a medida o uno nuevo (key = "nuevo"). */
export async function saveProfile(key: string, _: ProfileState, f: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: isSuper } = await supabase.rpc("is_superadmin");
  if (!isSuper) return { error: "Solo el superadministrador puede cambiar los perfiles" };

  if (key === "admin" || key === "player") {
    const rows = permRows(f, key).map((r) => ({ role: key, ...r }));
    const { error } = await supabase.from("role_permissions").upsert(rows);
    if (error) return { error: errMsg(error) };
  } else {
    const name = str(f, "name").slice(0, 40);
    const description = str(f, "description").slice(0, 300);
    if (name.length < 2) return { error: "Ponle un nombre al perfil" };
    if (["superadministrador", "gestor", "jugador"].includes(name.toLowerCase())) return { error: "Ese nombre ya lo usa un perfil de siempre" };
    let id = key;
    let base: Base;
    if (key === "nuevo") {
      base = str(f, "base") === "admin" ? "admin" : "player";
      const { data, error } = await supabase.from("custom_roles").insert({ name, description, base }).select("id").single();
      if (error) return { error: errMsg(error) };
      id = data.id;
    } else {
      if (!isUuid(key)) return { error: "Perfil no encontrado" };
      const { data, error } = await supabase.from("custom_roles").update({ name, description }).eq("id", key).select("base").single();
      if (error) return { error: errMsg(error) };
      base = data.base;
    }
    const rows = permRows(f, base).map((r) => ({ role_id: id, ...r }));
    const { error } = await supabase.from("custom_role_permissions").upsert(rows);
    if (error) return { error: errMsg(error) };
  }
  revalidatePath("/", "layout");
  redirect("/admin/perfiles?guardado=1");
}

/** Elimina un perfil a medida: sus personas vuelven a su perfil base (gestor o jugador). */
export async function deleteProfile(id: string): Promise<ProfileState> {
  if (!isUuid(id)) return { error: "Perfil no encontrado" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("custom_roles").delete().eq("id", id).select("id");
  if (error) return { error: errMsg(error) };
  if (!data?.length) return { error: "Solo el superadministrador puede eliminar perfiles" };
  revalidatePath("/", "layout");
  redirect("/admin/perfiles?borrado=1");
}
