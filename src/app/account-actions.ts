"use server";
import { createClient } from "@/lib/supabase/server";

/*
 * 4.30.4 · Lo que antes mandaba el navegador directamente a Supabase pasa por el servidor.
 * Así el navegador nunca renueva la sesión por su cuenta (ver src/lib/supabase/client.ts).
 */

/** Uso de la app (Gestión → Uso). Nunca lanza error. */
export async function trackUsageAction(area: string, device?: string, installed?: boolean) {
  try {
    const supabase = await createClient();
    await supabase.rpc("track_usage", {
      p_area: String(area).slice(0, 40),
      ...(device ? { p_device: device, p_installed: Boolean(installed) } : {}),
    });
  } catch {}
}

/** Apunta un fallo de la app (Gestión → Uso → Fallos). Nunca lanza error. */
export async function logAppErrorAction(e: { kind: string; path: string; message: string; digest?: string | null; version?: string | null; device?: string | null }) {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_app_error", {
      p_kind: e.kind, p_path: String(e.path).slice(0, 120), p_message: String(e.message).slice(0, 400),
      p_digest: e.digest ?? null, p_version: e.version ?? null, p_device: e.device ?? null,
    });
  } catch {}
}

/** Guarda en la cuenta lo ya visto (tutorial y presentación de fichajes) y renueva la sesión para que se note ya. */
export async function saveSeenAction(mark: { tutorial?: number; fichajes?: string }) {
  const data: Record<string, number | string> = {};
  if (typeof mark.tutorial === "number" && Number.isFinite(mark.tutorial)) data.tutorial = Math.trunc(mark.tutorial);
  if (typeof mark.fichajes === "string" && mark.fichajes.length <= 40) data.fichajes = mark.fichajes;
  if (!Object.keys(data).length) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ data });
    if (!error) await supabase.auth.refreshSession();
  } catch {}
}
