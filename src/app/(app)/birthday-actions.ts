"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";

/** Felicitar (o quitar la felicitación) a quien cumple años hoy. */
export async function toggleWish(playerId: string, year: number): Promise<{ error?: string }> {
  const s = await getSession();
  if (!s.can("squad")) return { error: "No tienes permiso para hacer esto" };
  if (!/^[0-9a-f-]{36}$/i.test(playerId) || !Number.isInteger(year)) return { error: "No válido" };
  const supabase = await createClient();
  const { data: mine } = await supabase.from("birthday_wishes").select("player_id").eq("player_id", playerId).eq("year", year).eq("user_id", s.user.id).maybeSingle();
  const { error } = mine
    ? await supabase.from("birthday_wishes").delete().eq("player_id", playerId).eq("year", year).eq("user_id", s.user.id)
    : await supabase.from("birthday_wishes").insert({ player_id: playerId, year, user_id: s.user.id });
  if (error) return { error: /row-level security|42501/.test(error.message) ? "No tienes permiso para hacer esto" : error.message };
  revalidatePath("/");
  return {};
}
