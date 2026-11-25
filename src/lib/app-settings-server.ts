import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { normalizeSettings, type AppSettings } from "@/lib/app-settings";

/** Los mandos de la app (una fila). Cacheado por petición; si falla, la app sigue como siempre. */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_settings").select("*").maybeSingle();
    return normalizeSettings(data as Partial<AppSettings> | null);
  } catch {
    return normalizeSettings(null);
  }
});

/** Para las páginas sin sesión (mantenimiento, rifa, noticias). */
export type PublicStatus = { maintenance: boolean; message: string | null; until: string | null; public_closed: boolean; reload_at: string | null; updated_at: string | null };
const CLOSED_NOT: PublicStatus = { maintenance: false, message: null, until: null, public_closed: false, reload_at: null, updated_at: null };
export const getPublicStatus = cache(async (): Promise<PublicStatus> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("app_public_status");
    const row = (Array.isArray(data) ? data[0] : data) as PublicStatus | null;
    return row ?? CLOSED_NOT;
  } catch {
    return CLOSED_NOT;
  }
});

/** Cookie de «ver como otro perfil» (solo la tiene en cuenta un superadministrador). */
export const VIEW_AS_COOKIE = "rv_ver_como";
export async function viewAsKey(): Promise<string | null> {
  const v = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  return v && /^(admin|player|[0-9a-f-]{36})$/i.test(v) ? v : null;
}
