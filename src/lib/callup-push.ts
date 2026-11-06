import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Usuarios activos vinculados a esas fichas de jugador (para los avisos de la convocatoria). */
export async function usersOfPlayers(playerIds: string[]): Promise<string[]> {
  if (!playerIds.length) return [];
  const admin = createAdminClient();
  const { data: players } = await admin.from("players").select("user_id").in("id", playerIds).not("user_id", "is", null);
  const ids = (players ?? []).map((p) => p.user_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await admin.from("profiles").select("id").in("id", ids).eq("active", true);
  return (profiles ?? []).map((p) => p.id as string);
}
