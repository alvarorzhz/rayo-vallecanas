import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { sortRoster, type FeeOverride, type FeePayment, type FeePlan, type Membership, type Player, type RosterEntry } from "@/lib/squad";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Plantilla de una temporada, ordenada por línea y dorsal. */
export async function fetchRoster(supabase: DB, season: string): Promise<RosterEntry[]> {
  const { data } = await supabase
    .from("squad_members_full")
    .select("*, player:players!inner(*)")
    .eq("season", season)
    .returns<(Membership & { player: Player })[]>();
  return sortRoster(data ?? []);
}

/** Un jugador en la plantilla de una temporada (para su cromo). */
export async function fetchRosterEntry(supabase: DB, season: string, playerId: string): Promise<RosterEntry | null> {
  const { data } = await supabase
    .from("squad_members_full")
    .select("*, player:players!inner(*)")
    .eq("season", season)
    .eq("player_id", playerId)
    .maybeSingle<Membership & { player: Player }>();
  return data ?? null;
}

/**
 * Fichajes por presentar: jugadores dados de alta después de `since` (a mano o desde la web de la liga)
 * que están en la plantilla de esta temporada. Como mucho del último mes.
 */
export async function fetchNewSignings(supabase: DB, since: string): Promise<RosterEntry[]> {
  const month = new Date(Date.now() - 30 * 864e5).toISOString();
  const from = since > month ? since : month;
  const { data } = await supabase
    .from("squad_members_full")
    .select("*, player:players!inner(*)")
    .eq("season", seasonOf())
    .neq("status", "left")
    .gt("player.created_at", from)
    .limit(30)
    .returns<(Membership & { player: Player })[]>();
  return data ?? [];
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

/**
 * «Mi cuota»: la cuota de la temporada de UN jugador, para enseñársela a él en Mi perfil.
 * Los jugadores no pueden leer Finanzas (RLS), así que se lee con la clave de servicio y SOLO
 * para el jugador enlazado a este usuario: nunca se enseña la de otro.
 */
export async function fetchMyFee(userId: string, season = seasonOf()) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id").eq("user_id", userId).maybeSingle<{ id: string }>();
  if (!player) return null;
  const { data: member } = await admin.from("squad_members").select("status").eq("player_id", player.id).eq("season", season).maybeSingle<{ status: string }>();
  const fees = await fetchFees(admin as unknown as DB, season, player.id);
  const override = fees.overrides.get(player.id) ?? null;
  const paid = fees.paid.get(player.id) ?? 0;
  // Fuera de la plantilla y sin pagos: no hay nada que enseñar
  if (!member && !paid) return null;
  return { season, plan: fees.plan, override, paid, payments: fees.payments };
}
