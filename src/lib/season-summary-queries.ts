import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { porraTable, type Prediction } from "@/lib/porra";
import type { SumApp, SumCallup, SumGoal, SumMatch } from "@/lib/season-summary";

type DB = Awaited<ReturnType<typeof createClient>>;

/** De qué va el resumen: una temporada entera o una competición de la liga (el Apertura…). */
export type Scope = { kind: "season"; season: string } | { kind: "competition"; competition: string; name: string; season: string | null; finished: boolean };

/** «c15868» → competición; «2026-27» → temporada. */
export const scopeSlug = (s: Scope) => (s.kind === "season" ? seasonSlug(s.season) : `c${s.competition}`);

/** «F7 - LIGA 4ª DIVISIÓN APERTURA | GRUPO I» → «Apertura»; si no, el nombre tal cual (sin «F7 -»). */
export function competitionShort(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  const half = n.match(/\b(apertura|clausura)\b/i);
  if (half) return half[1][0].toUpperCase() + half[1].slice(1).toLowerCase();
  return n.replace(/^F7\s*-\s*/i, "").split("|")[0].trim() || "Liga";
}

export async function fetchCompetitions(supabase: DB) {
  const { data } = await supabase.from("league_competitions").select("competition, name, season, finished").order("created_at", { ascending: false });
  return (data ?? []) as { competition: string; name: string | null; season: string | null; finished: boolean }[];
}

export async function resolveScope(supabase: DB, slug: string | undefined, fallbackSeason: string): Promise<Scope> {
  if (slug && /^c\d{1,9}$/.test(slug)) {
    const c = (await fetchCompetitions(supabase)).find((x) => x.competition === slug.slice(1));
    if (c) return { kind: "competition", competition: c.competition, name: competitionShort(c.name), season: c.season, finished: c.finished };
  }
  return { kind: "season", season: seasonFromSlug(slug) ?? fallbackSeason };
}

/** Todo lo que hace falta para los resúmenes de un alcance: partidos jugados, actas, goles, convocatorias y porra. */
export async function fetchSummaryData(supabase: DB, scope: Scope) {
  let q = supabase.from("matches").select("id, match_date, status, goals_for, goals_against, mvp_player_id, is_home, rival:rivals!inner(name)").eq("status", "played");
  q = scope.kind === "season" ? q.eq("season", scope.season) : q.eq("league_competition", scope.competition);
  const { data: rows } = await q.order("match_date");
  const matches: SumMatch[] = (rows ?? []).map((m) => ({
    id: m.id as string, match_date: m.match_date as string, status: m.status as string, goals_for: m.goals_for as number | null, goals_against: m.goals_against as number | null,
    mvp_player_id: m.mvp_player_id as string | null, is_home: m.is_home as boolean, rival: (m.rival as unknown as { name: string }).name,
  }));
  const ids = matches.map((m) => m.id);
  if (!ids.length) return { matches, apps: [] as SumApp[], goals: [] as SumGoal[], callups: [] as SumCallup[], preds: [] as Prediction[] };
  const [{ data: apps }, { data: goals }, { data: callups }, { data: preds }] = await Promise.all([
    supabase.from("match_appearances").select("match_id, player_id, goalkeeper, conceded, yellows, red").in("match_id", ids),
    supabase.from("match_goals").select("match_id, scorer_id, assist_id").in("match_id", ids),
    supabase.from("match_callups").select("match_id, player_id, reply").in("match_id", ids),
    supabase.from("match_predictions").select("match_id, user_id, goals_for, goals_against").in("match_id", ids),
  ]);
  return { matches, apps: (apps ?? []) as SumApp[], goals: (goals ?? []) as SumGoal[], callups: (callups ?? []) as SumCallup[], preds: (preds ?? []) as Prediction[] };
}

/** Puntos y puesto en la porra de ese alcance para un usuario. */
export function porraOf(data: Awaited<ReturnType<typeof fetchSummaryData>>, userId: string | null) {
  if (!userId) return null;
  const table = porraTable(data.preds, data.matches);
  return table.find((r) => r.user_id === userId) ?? null;
}
