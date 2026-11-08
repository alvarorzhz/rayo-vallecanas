import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { byKickoff, todayMadrid, type Match, type MatchRow, type Rival } from "@/lib/matches";
import { sortCallups, type Callup, type CallupRow } from "@/lib/callups";
import { sortRoster, type Player, type SquadStatus } from "@/lib/squad";
import type { Appearance, MatchGoal, ReportPlayer, ReportView } from "@/lib/reports";
import { POST_DAYS, addDays, matchdayPhase, type MatchdayPhase } from "@/lib/matchday";

type DB = Awaited<ReturnType<typeof createClient>>;

const SELECT = "*, rival:rivals!inner(*)";

/** Partidos de una temporada, por fecha. */
export async function fetchMatches(supabase: DB, season: string): Promise<MatchRow[]> {
  const { data } = await supabase.from("matches").select(SELECT).eq("season", season).returns<MatchRow[]>();
  return (data ?? []).sort(byKickoff);
}

export async function fetchMatch(supabase: DB, id: string): Promise<MatchRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("matches").select(SELECT).eq("id", id).maybeSingle<MatchRow>();
  return data;
}

/** Próximo partido pendiente o aplazado sin fecha nueva (desde hoy) y los últimos resultados. */
export async function fetchMatchday(supabase: DB, last = 5) {
  const today = todayMadrid();
  const [{ data: next }, { data: recent }] = await Promise.all([
    supabase.from("matches").select(SELECT).eq("status", "scheduled").gte("match_date", today)
      .order("match_date").order("kickoff", { nullsFirst: false }).limit(1).returns<MatchRow[]>(),
    supabase.from("matches").select(SELECT).eq("status", "played")
      .order("match_date", { ascending: false }).order("kickoff", { ascending: false, nullsFirst: false }).limit(last).returns<MatchRow[]>(),
  ]);
  return { next: next?.[0] ?? null, recent: recent ?? [] };
}

/** Partido del Matchday: el de hoy (pendiente o ya jugado); si no hay, el de mañana; si tampoco, el de los últimos días (post partido). */
export async function fetchMatchdayFocus(supabase: DB): Promise<{ m: MatchRow; phase: MatchdayPhase } | null> {
  const today = todayMadrid();
  const { data } = await supabase.from("matches").select(SELECT).in("status", ["scheduled", "played"])
    .gte("match_date", addDays(today, -POST_DAYS)).lte("match_date", addDays(today, 1)).returns<MatchRow[]>();
  const now = new Date();
  const rows = (data ?? []).sort(byKickoff).map((m) => ({ m, phase: matchdayPhase(m, now) })).filter((x): x is { m: MatchRow; phase: MatchdayPhase } => !!x.phase);
  // Hoy manda sobre mañana; si hoy hay dos, el que aún no se ha jugado
  // La víspera manda sobre el post partido; del post partido, el más reciente
  return rows.find((x) => x.phase === "day" || x.phase === "live") ?? rows.find((x) => x.phase === "final")
    ?? rows.find((x) => x.phase === "eve") ?? rows.filter((x) => x.phase === "post").pop() ?? null;
}

/** Previa: último partido contra el rival y nuestro máximo goleador de la temporada. */
export async function fetchMatchdayPreview(supabase: DB, m: Pick<Match, "id" | "rival_id" | "season">) {
  const [{ data: last }, { data: top }] = await Promise.all([
    supabase.from("matches").select(SELECT).eq("rival_id", m.rival_id).eq("status", "played").neq("id", m.id)
      .order("match_date", { ascending: false }).limit(1).returns<MatchRow[]>(),
    supabase.from("squad_members_full").select("goals, number, position, status, player:players!inner(*)").eq("season", m.season)
      .neq("status", "left").gt("goals", 0).order("goals", { ascending: false }).limit(1)
      .returns<{ goals: number; number: number | null; position: string; status: SquadStatus; player: Player }[]>(),
  ]);
  return { lastH2H: last?.[0] ?? null, topScorer: top?.[0] ?? null };
}

/** Lo justo para la tira «Hoy jugamos» de todas las páginas. */
export async function fetchTodayMatch(supabase: DB) {
  const { data } = await supabase.from("matches").select("id, kickoff, status, is_home, goals_for, goals_against, match_date, rival:rivals!inner(name, short_name)")
    .eq("match_date", todayMadrid()).in("status", ["scheduled", "played"]).order("kickoff", { nullsFirst: false }).limit(2)
    .returns<(Pick<Match, "id" | "kickoff" | "status" | "is_home" | "goals_for" | "goals_against" | "match_date"> & { rival: Pick<Rival, "name" | "short_name"> })[]>();
  return (data ?? []).find((x) => x.status === "scheduled") ?? data?.[0] ?? null;
}

export async function fetchRivals(supabase: DB): Promise<Rival[]> {
  const { data } = await supabase.from("rivals").select("*").order("name").returns<Rival[]>();
  return data ?? [];
}

/** Temporadas con partidos, más la actual. */
export async function fetchMatchSeasons(supabase: DB): Promise<string[]> {
  const { data } = await supabase.from("matches").select("season").limit(2000);
  const set = new Set<string>((data ?? []).map((r) => r.season));
  set.add(seasonOf());
  return [...set].sort().reverse();
}

/** Convocados de un partido con su dorsal y posición de esa temporada (RLS: el borrador solo lo ven los gestores). */
export async function fetchCallups(supabase: DB, m: Pick<Match, "id" | "season">): Promise<CallupRow[]> {
  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase.from("match_callups").select("*, player:players!inner(*)").eq("match_id", m.id).returns<(Callup & { player: Player })[]>(),
    supabase.from("squad_members").select("player_id, number, position, status").eq("season", m.season)
      .returns<{ player_id: string; number: number | null; position: string; status: SquadStatus }[]>(),
  ]);
  const by = new Map((members ?? []).map((x) => [x.player_id, x]));
  return sortCallups((rows ?? []).map((r) => {
    const sm = by.get(r.player_id);
    return { ...r, number: sm?.number ?? null, position: sm?.position ?? "MCD", status: sm?.status ?? null };
  }));
}

/** Ficha de jugador vinculada al usuario (si la tiene). */
export async function fetchMyPlayerId(supabase: DB, userId: string): Promise<string | null> {
  const { data } = await supabase.from("players").select("id").eq("user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Jugadores de la plantilla de una temporada (para el acta), más los que ya salgan en ella aunque no estén. */
export async function fetchReportPool(supabase: DB, season: string, extra: string[] = []): Promise<ReportPlayer[]> {
  const { data: members } = await supabase.from("squad_members").select("player_id, number, position, status, player:players!inner(*)").eq("season", season)
    .returns<{ player_id: string; number: number | null; position: string; status: SquadStatus; player: Player }[]>();
  const rows = (members ?? []).filter((m) => m.status !== "left" || extra.includes(m.player_id));
  const missing = extra.filter((id) => !rows.some((r) => r.player_id === id));
  if (missing.length) {
    const { data: ps } = await supabase.from("players").select("*").in("id", missing).returns<Player[]>();
    for (const p of ps ?? []) rows.push({ player_id: p.id, number: null, position: "MCD", status: "left", player: p });
  }
  return sortRoster(rows).map(({ player_id, player, number, position }) => ({ player_id, player, number, position }));
}

/** Acta guardada de un partido. */
export async function fetchReport(supabase: DB, m: Pick<Match, "id" | "season" | "mvp_player_id">): Promise<ReportView & { pool: ReportPlayer[] }> {
  const [{ data: apps }, { data: goals }] = await Promise.all([
    supabase.from("match_appearances").select("*").eq("match_id", m.id).returns<Appearance[]>(),
    supabase.from("match_goals").select("*").eq("match_id", m.id).order("sort").returns<MatchGoal[]>(),
  ]);
  const ids = [...new Set([...(apps ?? []).map((a) => a.player_id), ...(goals ?? []).flatMap((g) => [g.scorer_id, g.assist_id]), m.mvp_player_id].filter((x): x is string => !!x))];
  const pool = await fetchReportPool(supabase, m.season, ids);
  const by = new Map(pool.map((p) => [p.player_id, p]));
  const appearances = (apps ?? []).filter((a) => by.has(a.player_id)).map((a) => ({ ...a, ...by.get(a.player_id)! }));
  const order = new Map(pool.map((p, i) => [p.player_id, i]));
  appearances.sort((a, b) => Number(b.started) - Number(a.started) || (order.get(a.player_id)! - order.get(b.player_id)!));
  return {
    pool,
    appearances,
    goals: (goals ?? []).map((g) => ({ ...g, scorer: g.scorer_id ? by.get(g.scorer_id) ?? null : null, assist: g.assist_id ? by.get(g.assist_id) ?? null : null })),
    mvp: m.mvp_player_id ? by.get(m.mvp_player_id) ?? null : null,
  };
}

/** Partidos jugados por un jugador en una temporada (según las actas), del más reciente al más antiguo, con sus goles y asistencias. */
export async function fetchPlayerLog(supabase: DB, playerId: string, season: string) {
  const { data } = await supabase.from("match_appearances").select("*, match:matches!inner(*, rival:rivals!inner(*))")
    .eq("player_id", playerId).eq("match.season", season).eq("match.status", "played").returns<(Appearance & { match: MatchRow })[]>();
  const apps = (data ?? []).sort((a, b) => byKickoff(b.match, a.match));
  const { data: goals } = apps.length
    ? await supabase.from("match_goals").select("match_id, scorer_id, assist_id").in("match_id", apps.map((a) => a.match_id)).or(`scorer_id.eq.${playerId},assist_id.eq.${playerId}`)
    : { data: [] as Pick<MatchGoal, "match_id" | "scorer_id" | "assist_id">[] };
  return apps.map((a) => ({
    ...a,
    goals: (goals ?? []).filter((g) => g.match_id === a.match_id && g.scorer_id === playerId).length,
    assists: (goals ?? []).filter((g) => g.match_id === a.match_id && g.assist_id === playerId).length,
    mvp: a.match.mvp_player_id === playerId,
  }));
}
