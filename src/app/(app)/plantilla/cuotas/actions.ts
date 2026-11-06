"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseEuros } from "@/lib/format";
import { fullName } from "@/lib/squad";
import type { ActionState } from "@/app/(app)/plantilla/actions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const SEASON = /^\d{4}\/\d{2}$/;
const METHODS = ["cash", "bizum", "transfer", "card", "other"];
const msg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  return /row-level security|42501/.test(m) ? "No tienes permiso para hacer esto" : m;
};

function refresh(playerId?: string) {
  revalidatePath("/plantilla/cuotas");
  revalidatePath("/finanzas", "layout");
  if (playerId) revalidatePath(`/plantilla/${playerId}`);
}

/** Cuota general de la temporada. */
export async function saveFeePlan(season: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  try {
    const amount_cents = parseEuros(f.get("amount"));
    const due = str(f, "due_on");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Fecha no válida");
    const supabase = await createClient();
    const { error } = await supabase.from("squad_fee_plans").upsert({ season, amount_cents, due_on: due || null, notes: str(f, "notes").slice(0, 300) || null });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh();
  return { ok: "Cuota de la temporada guardada" };
}

/** Cuota distinta para un jugador (descuento, hermanos, exento...). Vacío = vuelve a la general. */
export async function saveFeeOverride(season: string, playerId: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const supabase = await createClient();
  try {
    if (f.get("reset") === "1" || str(f, "amount") === "") {
      const { error } = await supabase.from("squad_fee_overrides").delete().eq("season", season).eq("player_id", playerId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("squad_fee_overrides").upsert({
        season, player_id: playerId, amount_cents: parseEuros(f.get("amount")), reason: str(f, "reason").slice(0, 120) || null,
      });
      if (error) throw error;
    }
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(playerId);
  return { ok: "Cuota del jugador guardada" };
}

/** Apunta un pago de cuota: es un ingreso de Finanzas (categoría «Cuotas de jugadores») enlazado al jugador. */
export async function registerFeePayment(season: string, playerId: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const supabase = await createClient();
  let amount: number;
  try {
    amount = parseEuros(f.get("amount"));
    if (amount <= 0) throw new Error("Indica el importe");
    const op_date = str(f, "op_date") || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(op_date)) throw new Error("Fecha no válida");
    const method = METHODS.includes(str(f, "method")) ? str(f, "method") : "cash";
    const [{ data: player }, { data: cats }] = await Promise.all([
      supabase.from("players").select("first_name, last_name").eq("id", playerId).single(),
      supabase.from("finance_categories").select("id, name").eq("kind", "income").eq("active", true).order("sort"),
    ]);
    if (!player) throw new Error("Jugador no encontrado");
    const cat = cats?.find((c) => /cuota/i.test(c.name)) ?? cats?.[0];
    if (!cat) throw new Error("No hay ninguna categoría de ingresos en Finanzas");
    const name = fullName(player);
    const { error } = await supabase.from("finance_movements").insert({
      kind: "income",
      op_date,
      concept: `Cuota ${season} · ${name}`.slice(0, 200),
      category_id: cat.id,
      amount_cents: amount,
      method,
      counterparty: name,
      notes: str(f, "notes").slice(0, 300) || null,
      player_id: playerId,
      fee_season: season,
    });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(playerId);
  return { ok: `Pago de ${(amount / 100).toFixed(2).replace(".", ",")} € apuntado en Finanzas` };
}
