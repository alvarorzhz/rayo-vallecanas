import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Busca el nombre de cada id (personas, jugadores, rivales, campañas…) para enseñarlo en la auditoría. */
export async function namesFor(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const list = ids.slice(0, 400);
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
  const [people, players, rivals, cats, campaigns, sponsors, buyers, roles, matches] = await Promise.all([
    supabase.from("member_directory").select("id, full_name").in("id", list),
    supabase.from("players").select("id, first_name, last_name, nickname").in("id", list),
    supabase.from("rivals").select("id, name").in("id", list),
    supabase.from("finance_categories").select("id, name").in("id", list),
    supabase.from("lottery_campaigns").select("id, name").in("id", list),
    supabase.from("sponsors").select("id, name").in("id", list),
    supabase.from("buyers").select("id, full_name").in("id", list),
    supabase.from("custom_roles").select("id, name").in("id", list),
    supabase.from("matches").select("id, match_date, rival:rivals(name)").in("id", list),
  ]);
  for (const r of people.data ?? []) names.set(r.id, r.full_name);
  for (const r of players.data ?? []) names.set(r.id, r.nickname || `${r.first_name} ${r.last_name ?? ""}`.trim());
  for (const t of [rivals, cats, campaigns, sponsors, roles]) for (const r of (t.data ?? []) as { id: string; name: string }[]) names.set(r.id, r.name);
  for (const r of buyers.data ?? []) names.set(r.id, r.full_name);
  for (const m of (matches.data ?? []) as { id: string; match_date: string; rival: { name: string } | { name: string }[] | null }[]) {
    const rival = Array.isArray(m.rival) ? m.rival[0]?.name : m.rival?.name;
    names.set(m.id, `${rival ? `vs ${rival}` : "Partido"} · ${fmt.format(new Date(`${m.match_date}T12:00:00Z`))}`);
  }
  return names;
}
