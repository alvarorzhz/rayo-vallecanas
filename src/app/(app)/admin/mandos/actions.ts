"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/app-settings-server";
import { madridLocalToIso, MODULE_KEYS, type AppSettings } from "@/lib/app-settings";
import { fetchProfileDefs } from "@/lib/roles";

export type MandoState = { ok?: string; error?: string } | undefined;

/** Solo el superadministrador de verdad (también mientras mira la app como otro perfil). */
async function superOnly() {
  const s = await getSession();
  return s.realRole === "superadmin" ? s : null;
}

async function save(patch: Partial<AppSettings>): Promise<string | null> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("app_settings").update(patch, { count: "exact" }).eq("id", true);
  if (error) return error.message.includes("app_settings") ? "Falta ejecutar el SQL de la versión 4.31.0" : "No se pudo guardar";
  if (!count) return "No se pudo guardar (¿falta ejecutar el SQL de la 4.31.0?)";
  // Cambia lo que ven todos en todas las pantallas
  revalidatePath("/", "layout");
  return null;
}

/** Modo mantenimiento: interruptor, mensaje, hora de vuelta y si se cierran también las páginas públicas. */
export async function saveMaintenance(_: MandoState, f: FormData): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede tocar los mandos" };
  const on = f.get("on") === "1";
  const message = String(f.get("message") ?? "").trim().slice(0, 400) || null;
  const rawUntil = String(f.get("until") ?? "").trim();
  const until = madridLocalToIso(rawUntil);
  if (rawUntil && !until) return { error: "La hora de vuelta no es válida" };
  if (on && until && new Date(until).getTime() < Date.now()) return { error: "La hora de vuelta ya ha pasado" };
  const err = await save({ maintenance: on, maintenance_message: message, maintenance_until: until, maintenance_public: f.get("public") === "1" });
  if (err) return { error: err };
  return { ok: on ? "Mantenimiento puesto: ahora solo entras tú." : "Mantenimiento quitado: la app vuelve a estar abierta para todos." };
}

/** Mensaje fijo arriba en todas las pantallas. Vacío = quitarlo. */
export async function saveBanner(_: MandoState, f: FormData): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede tocar los mandos" };
  const clear = f.get("clear") === "1";
  const text = clear ? null : String(f.get("text") ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  const rawUntil = clear ? "" : String(f.get("until") ?? "").trim();
  const until = madridLocalToIso(rawUntil);
  if (rawUntil && !until) return { error: "La fecha para quitarlo no es válida" };
  if (text && until && new Date(until).getTime() < Date.now()) return { error: "La fecha para quitarlo ya ha pasado" };
  const err = await save({ banner_text: text, banner_tone: f.get("tone") === "urgent" ? "urgent" : "info", banner_until: until });
  if (err) return { error: err };
  return { ok: text ? "Mensaje puesto: ya lo ve todo el mundo arriba." : "Mensaje quitado." };
}

/** Apartados apagados para todos. */
export async function saveModules(_: MandoState, f: FormData): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede tocar los mandos" };
  const on = new Set(f.getAll("on").map(String));
  const off = MODULE_KEYS.filter((k) => !on.has(k));
  const err = await save({ modules_off: off });
  if (err) return { error: err };
  return { ok: off.length ? `Guardado. ${off.length === 1 ? "Queda 1 apartado apagado" : `Quedan ${off.length} apartados apagados`} para los demás.` : "Guardado. Todos los apartados encendidos." };
}

/** Forzar actualización: cada móvil recarga la última versión en cuanto abre la app o cambia de pantalla. */
export async function forceUpdate(): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede tocar los mandos" };
  const err = await save({ reload_at: new Date().toISOString() });
  if (err) return { error: err };
  return { ok: "Hecho. Cada móvil cargará la última versión en cuanto abra la app o cambie de pantalla." };
}

/** Cerrar sesión a todos menos a quien lo pulsa. */
export async function closeAllSessions(): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede cerrar sesiones" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_close_all_sessions");
  if (error) return { error: "No se pudieron cerrar las sesiones" };
  revalidatePath("/admin/auditoria/sesiones");
  const n = Number(data) || 0;
  return { ok: n ? `${n === 1 ? "Cerrada 1 sesión" : `Cerradas ${n} sesiones`}. Tendrán que volver a entrar con su contraseña.` : "No había nadie más con la sesión abierta." };
}

/** Ver la app como otro perfil (solo menús y apartados; los datos siguen siendo los del superadministrador). */
export async function startViewAs(_: MandoState, f: FormData): Promise<MandoState> {
  if (!(await superOnly())) return { error: "Solo un superadministrador puede ver la app como otro perfil" };
  const key = String(f.get("key") ?? "");
  const supabase = await createClient();
  const def = (await fetchProfileDefs(supabase)).find((d) => d.key === key && d.base !== "superadmin");
  if (!def) return { error: "Elige un perfil" };
  (await cookies()).set(VIEW_AS_COOKIE, def.key, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 4 });
  redirect("/");
}

export async function stopViewAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin/mandos");
}
