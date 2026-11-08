"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type CloseState = { error?: string; ok?: string } | undefined;

/** Un superadministrador cierra una sesión abierta (p. ej. la de un móvil perdido). */
export async function closeSession(_: CloseState, formData: FormData): Promise<CloseState> {
  const s = await getSession();
  if (s.profile.role !== "superadmin") return { error: "Solo un superadministrador puede cerrar sesiones" };
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Sesión no válida" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_close_session", { p_id: id });
  if (error) return { error: error.message.includes("ya no está") ? "Esa sesión ya estaba cerrada" : "No se pudo cerrar la sesión" };
  revalidatePath("/admin/auditoria/sesiones");
  return { ok: "Sesión cerrada" };
}
