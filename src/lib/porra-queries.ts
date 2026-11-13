import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shirtName } from "@/lib/squad";
import { porraOpen, porraPoints, porraTable, type Prediction } from "@/lib/porra";
import type { Match } from "@/lib/matches";

type DB = Awaited<ReturnType<typeof createClient>>;
export type PorraName = { name: string; avatar: string | null };

/**
 * Nombres de los que juegan la porra: el apodo de su ficha de jugador o, si no tiene, su nombre.
 * Los jugadores no pueden leer la lista de usuarios, así que se lee con la clave de servicio (solo el nombre y la foto).
 */
export async function porraNames(ids: string[]): Promise<Map<string, PorraName>> {
  const out = new Map<string, PorraName>();
  if (!ids.length) return out;
  const admin = createAdminClient();
  const [{ data: profiles }, { data: players }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_url").in("id", ids),
    admin.from("players").select("user_id, first_name, last_name, nickname, photo_url").in("user_id", ids),
  ]);
  for (const p of profiles ?? []) out.set(p.id as string, { name: String(p.full_name).split(" ")[0], avatar: (p.avatar_url as string | null) ?? null });
  for (const p of players ?? []) {
    const prev = out.get(p.user_id as string);
    out.set(p.user_id as string, { name: shirtName(p as { first_name: string; last_name: string; nickname: string | null }), avatar: (p.photo_url as string | null) ?? prev?.avatar ?? null });
  }
  return out;
}

export type PorraPick = { user_id: string; goals_for: number; goals_against: number; points: number | null; name: string; avatar: string | null; me: boolean };
export type PorraBoard = { open: boolean; mine: { goals_for: number; goals_against: number } | null; count: number; picks: PorraPick[] };

/** La porra de un partido: mi pronóstico, cuántos han jugado y, ya cerrada, los de todos con sus puntos. */
export async function fetchPorra(supabase: DB, m: Pick<Match, "id" | "status" | "match_date" | "kickoff" | "goals_for" | "goals_against">, userId: string): Promise<PorraBoard> {
  const open = porraOpen(m);
  const { data } = await supabase.from("match_predictions").select("match_id, user_id, goals_for, goals_against").eq("match_id", m.id).returns<Prediction[]>();
  const rows = data ?? [];
  const mineRow = rows.find((r) => r.user_id === userId) ?? null;
  const mine = mineRow ? { goals_for: mineRow.goals_for, goals_against: mineRow.goals_against } : null;
  if (open) {
    // Mientras está abierta cada uno ve solo el suyo: el total se cuenta con la clave de servicio (solo el número)
    const { count } = await createAdminClient().from("match_predictions").select("match_id", { count: "exact", head: true }).eq("match_id", m.id);
    return { open, mine, count: count ?? rows.length, picks: [] };
  }
  const names = await porraNames(rows.map((r) => r.user_id));
  const picks = rows
    .map((r) => ({ ...r, points: porraPoints(r, m), name: names.get(r.user_id)?.name ?? "—", avatar: names.get(r.user_id)?.avatar ?? null, me: r.user_id === userId }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name, "es"));
  return { open, mine, count: rows.length, picks };
}

/** Clasificación de la porra de una temporada (solo partidos ya jugados). */
export async function fetchPorraSeason(supabase: DB, season: string) {
  const { data: matches } = await supabase.from("matches").select("id, status, goals_for, goals_against, match_date").eq("season", season).eq("status", "played");
  const ids = (matches ?? []).map((m) => m.id as string);
  const { data: preds } = ids.length
    ? await supabase.from("match_predictions").select("match_id, user_id, goals_for, goals_against").in("match_id", ids).returns<Prediction[]>()
    : { data: [] as Prediction[] };
  const table = porraTable(preds ?? [], (matches ?? []) as { id: string; status: string; goals_for: number | null; goals_against: number | null }[]);
  const names = await porraNames(table.map((r) => r.user_id));
  return { table: table.map((r) => ({ ...r, ...(names.get(r.user_id) ?? { name: "—", avatar: null }) })), matches: ids.length };
}
