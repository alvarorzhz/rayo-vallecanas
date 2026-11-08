"use server";
import { createClient } from "@/lib/supabase/server";
import type { RaffleCheck } from "@/lib/lottery/public";

export type CheckState = { result?: RaffleCheck; error?: string; number?: string; reference?: string } | undefined;

/** «Comprueba tu número»: número + referencia del justificante. No devuelve datos personales. */
export async function checkRaffleNumber(slug: string, _: CheckState, f: FormData): Promise<CheckState> {
  const raw = String(f.get("number") ?? "").trim();
  const number = Number(raw);
  const reference = String(f.get("reference") ?? "").trim().slice(0, 40);
  const keep = { number: raw, reference };
  if (!Number.isInteger(number) || number < 1) return { ...keep, error: "Escribe tu número." };
  if (!reference) return { ...keep, error: "Escribe la referencia de tu justificante." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("raffle_public_check", { p_slug: slug, p_number: number, p_reference: reference });
  if (error) return { ...keep, error: "No se ha podido comprobar ahora. Inténtalo de nuevo en un momento." };
  if (!data) return { ...keep, error: "Esta rifa ya no está publicada." };
  return { ...keep, result: data as RaffleCheck };
}
