import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Revocación de los botones de los avisos (4.31.4). Un token emitido ANTES de que a esa persona
 * le cerraran las sesiones a distancia, cambiara la contraseña o la desactivaran deja de valer:
 * así, si se pierde un móvil, «Cerrar sesión» en Auditoría o en los Mandos también apaga sus botones.
 * Se mira el historial de accesos (access_log, índice por usuario y fecha), sin tablas nuevas.
 */
const REVOKING_EVENTS = ["revoked", "password", "disabled"];

export async function tokenRevoked(userId: string, issuedAt: number): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("access_log")
    .select("id")
    .eq("user_id", userId)
    .in("event", REVOKING_EVENTS)
    .gt("created_at", new Date(issuedAt).toISOString())
    .limit(1);
  // Si no se puede comprobar, mejor no dejar pasar
  if (error) return true;
  return (data?.length ?? 0) > 0;
}

/** «Ya contestado desde que salió este aviso»: el token es de un solo uso. */
export const usedSince = (answeredAt: string | null | undefined, issuedAt: number) =>
  !!answeredAt && new Date(answeredAt).getTime() >= issuedAt;
