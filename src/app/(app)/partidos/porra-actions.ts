"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PorraState = { ok?: string; error?: string } | undefined;

/** Guarda (o cambia) mi pronóstico de la porra. Con null se borra. */
export async function savePorra(matchId: string, goalsFor: number | null, goalsAgainst: number | null): Promise<PorraState> {
  const ok = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 30);
  if (!ok(goalsFor) || !ok(goalsAgainst)) return { error: "Resultado no válido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("porra_save", { p_match: matchId, p_for: goalsFor, p_against: goalsFor === null ? null : goalsAgainst });
  if (error) return { error: /cerrada/.test(error.message) ? "La porra ya está cerrada: ha empezado el partido." : /permiso|42501/.test(error.message) ? "No tienes permiso para hacer esto" : error.message };
  revalidatePath("/");
  revalidatePath(`/partidos/${matchId}`);
  return { ok: goalsFor === null ? "Porra borrada" : "¡Porra guardada!" };
}
