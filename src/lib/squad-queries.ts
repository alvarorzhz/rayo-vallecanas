import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { sortRoster, type FeeOverride, type FeePayment, type FeePlan, type Membership, type Player, type RosterEntry } from "@/lib/squad";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Plantilla de una temporada, ordenada por línea y dorsal. */
export async function fetchRoster(supabase: DB, season: string): Promise<RosterEntry[]> {
  const { data } = await supabase
    .from("squad_members")
    .select("*, player:players!inner(*)")
    .eq("season", season)
    .returns<(Membership & { player: Player })[]>();
  return sortRoster(data ?? []);
}

/** Temporadas con plantilla, más la actual. */
export async function fetchSeasons(supabase: DB): Promise<string[]> {
  const { data } = await supabase.from("squad_members").select("season").limit(1000);
  const set = new Set<string>((data ?? []).map((r) => r.season));
  set.add(seasonOf());
  return [...set].sort().reverse();
}


/** Cuotas de una temporada (solo con permiso de Finanzas: RLS devuelve vacío si no). */
export async function fetchFees(supabase: DB, season: string, playerId?: string) {
  let pay = supabase.from("finance_movements")
    .select("id, player_id, fee_season, amount_cents, op_date, method, voided_at")
    .eq("fee_season", season).is("voided_at", null).order("op_date");
  let ovr = supabase.from("squad_fee_overrides").select("*").eq("season", season);
  if (playerId) {
    pay = pay.eq("player_id", playerId);
    ovr = ovr.eq("player_id", playerId);
  }
  const [{ data: plan }, { data: overrides }, { data: payments }] = await Promise.all([
    supabase.from("squad_fee_plans").select("*").eq("season", season).maybeSingle<FeePlan>(),
    ovr.returns<FeeOverride[]>(),
    pay.returns<FeePayment[]>(),
  ]);
  const paid = new Map<string, number>();
  for (const p of payments ?? []) paid.set(p.player_id, (paid.get(p.player_id) ?? 0) + p.amount_cents);
  return {
    plan: plan ?? null,
    overrides: new Map((overrides ?? []).map((o) => [o.player_id, o])),
    payments: payments ?? [],
    paid,
  };
}
