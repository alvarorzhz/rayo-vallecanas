import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { COMPETITION_LABEL, form, hhmm, longDay, outcomeOf, type MatchRow } from "@/lib/matches";
import { fetchCallups, fetchMatch, fetchReport } from "@/lib/match-queries";
import { getStandings } from "@/lib/league-table";
import { rivalRow } from "@/lib/standings";
import { POSITION_LABEL, shirtName, type Membership, type Player } from "@/lib/squad";
import type { ReportView } from "@/lib/reports";
import type { Article, InterviewQA, InterviewStatus, MatchFacts, NewsKind, PlayerFacts } from "@/lib/news";

type DB = Awaited<ReturnType<typeof createClient>>;

/** Para las tarjetas de la portada: el partido y el jugador de cada pieza, en una sola consulta. */
export type ArticleCard = Article & {
  match: (Pick<MatchRow, "id" | "match_date" | "is_home" | "goals_for" | "goals_against" | "status" | "round" | "competition"> & { rival: Pick<MatchRow["rival"], "name" | "short_name" | "crest_url" | "color"> }) | null;
  player: Pick<Player, "id" | "first_name" | "last_name" | "nickname" | "photo_url"> | null;
};

const CARD = "*, match:matches(id, match_date, is_home, goals_for, goals_against, status, round, competition, rival:rivals(name, short_name, crest_url, color)), player:players(id, first_name, last_name, nickname, photo_url)";

/** Piezas publicadas, de la más reciente a la más antigua. */
export async function fetchPublished(supabase: DB, opts: { kind?: NewsKind | null; limit?: number } = {}): Promise<ArticleCard[]> {
  let q = supabase.from("news_articles").select(CARD).eq("status", "published");
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data } = await q.order("published_at", { ascending: false }).limit(opts.limit ?? 40).returns<ArticleCard[]>();
  return data ?? [];
}

/** Borradores (solo los ve quien puede escribir: la base de datos lo filtra). */
export async function fetchDrafts(supabase: DB): Promise<ArticleCard[]> {
  const { data } = await supabase.from("news_articles").select(CARD).eq("status", "draft").order("updated_at", { ascending: false }).limit(30).returns<ArticleCard[]>();
  return data ?? [];
}

export async function fetchArticle(supabase: DB, id: string): Promise<ArticleCard | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("news_articles").select(CARD).eq("id", id).maybeSingle<ArticleCard>();
  return data;
}

/** Cuántas piezas hay publicadas (el número de la cabecera). */
export async function countPublished(supabase: DB) {
  const { count } = await supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("status", "published");
  return count ?? 0;
}

// ------------------------------------------------------------------ Datos del partido
export type MatchSheet = { m: MatchRow; facts: MatchFacts; report: ReportView | null };

/** Todo lo que se sabe de un partido, con los jugadores por su apodo: para la ficha técnica y para el prompt. */
export async function fetchMatchSheet(supabase: DB, matchId: string, opts: { standings?: boolean } = {}): Promise<MatchSheet | null> {
  const m = await fetchMatch(supabase, matchId);
  if (!m) return null;
  const played = m.status === "played" && m.goals_for != null && m.goals_against != null;
  const [report, callups, recent, standings] = await Promise.all([
    played && m.report_saved_at ? fetchReport(supabase, m) : Promise.resolve(null),
    played ? Promise.resolve([]) : fetchCallups(supabase, m),
    supabase.from("matches").select("*, rival:rivals!inner(*)").eq("season", m.season).eq("status", "played").lte("match_date", m.match_date)
      .order("match_date", { ascending: false }).limit(6).returns<MatchRow[]>(),
    opts.standings !== false && m.competition === "league" && m.season === seasonOf() ? getStandings(supabase) : Promise.resolve(null),
  ]);

  const name = (p: { player: Player } | null | undefined) => (p ? shirtName(p.player) : null);
  const scorers = new Map<string, number>();
  const assists = new Map<string, number>();
  let ownGoals = 0;
  for (const g of report?.goals ?? []) {
    if (g.own_goal) ownGoals++;
    const s = name(g.scorer);
    if (s) scorers.set(s, (scorers.get(s) ?? 0) + 1);
    const a = name(g.assist);
    if (a) assists.set(a, (assists.get(a) ?? 0) + 1);
  }
  const apps = report?.appearances ?? [];
  const rank = (r: { pos: number; points: number } | null | undefined, total: number) => (r ? { pos: r.pos, points: r.points, total } : null);
  const rows = standings?.table.rows ?? [];
  const before = (recent.data ?? []).filter((x) => x.id !== m.id || played);
  const outcomes = form(before, 5).map((x) => ({ W: "V", D: "E", L: "D" })[outcomeOf(x)!]).join("");

  const facts: MatchFacts = {
    rival: m.rival.name,
    home: m.is_home,
    date: longDay(m.match_date),
    competition: COMPETITION_LABEL[m.competition],
    round: m.round,
    venue: m.venue,
    kickoff: hhmm(m.kickoff),
    played,
    goalsFor: m.goals_for,
    goalsAgainst: m.goals_against,
    scorers: [...scorers].map(([n, goals]) => ({ name: n, goals })).sort((a, b) => b.goals - a.goals),
    ownGoals,
    assists: [...assists].map(([n, count]) => ({ name: n, count })).sort((a, b) => b.count - a.count),
    starters: apps.filter((a) => a.started).map((a) => shirtName(a.player)),
    subs: apps.filter((a) => !a.started).map((a) => shirtName(a.player)),
    goalkeeper: apps.find((a) => a.goalkeeper) ? shirtName(apps.find((a) => a.goalkeeper)!.player) : null,
    cards: apps.filter((a) => a.yellows || a.red).map((a) => ({ name: shirtName(a.player), yellows: a.yellows, red: a.red })),
    mvp: name(report?.mvp),
    usRank: standings ? rank(rows.find((r) => r.teamId === standings.us), rows.length) : null,
    rivalRank: standings ? rank(rivalRow(rows, m.rival), rows.length) : null,
    callup: callups.filter((c) => c.reply === "yes").map((c) => shirtName(c.player)),
    form: outcomes || null,
  };
  return { m, facts, report };
}

/** El entrevistado con su dorsal, su posición y sus números de la temporada. */
export async function fetchPlayerFacts(supabase: DB, playerId: string): Promise<(PlayerFacts & { player: Player }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) return null;
  const season = seasonOf();
  const [{ data: p }, { data: sm }] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle<Player>(),
    supabase.from("squad_members_full").select("*").eq("player_id", playerId).eq("season", season).maybeSingle<Membership>(),
  ]);
  if (!p) return null;
  return {
    player: p,
    name: shirtName(p),
    position: POSITION_LABEL[sm?.position ?? ""] ?? "Jugador",
    number: sm?.number ?? null,
    season,
    stats: { apps: sm?.apps ?? 0, goals: sm?.goals ?? 0, assists: sm?.assists ?? 0, mvps: sm?.mvps ?? 0 },
  };
}

// ------------------------------------------------------------------ Para el editor
export type MatchOption = { id: string; label: string; played: boolean; hasReport: boolean; date: string };

/** Partidos de la temporada para elegir en el editor: los jugados (más recientes primero) y los próximos. */
export async function fetchMatchOptions(supabase: DB): Promise<MatchOption[]> {
  const { data } = await supabase.from("matches").select("id, match_date, is_home, status, goals_for, goals_against, report_saved_at, round, rival:rivals!inner(name)")
    .eq("season", seasonOf()).in("status", ["played", "scheduled", "postponed"]).order("match_date", { ascending: false }).limit(60)
    .returns<{ id: string; match_date: string; is_home: boolean; status: string; goals_for: number | null; goals_against: number | null; report_saved_at: string | null; round: string | null; rival: { name: string } }[]>();
  return (data ?? []).map((x) => {
    const played = x.status === "played" && x.goals_for != null;
    const score = played ? (x.is_home ? ` ${x.goals_for}-${x.goals_against}` : ` ${x.goals_against}-${x.goals_for}`) : "";
    const vs = x.is_home ? `Rayo${score} ${x.rival.name}` : `${x.rival.name}${score} Rayo`;
    return { id: x.id, date: x.match_date, played, hasReport: !!x.report_saved_at, label: `${longDay(x.match_date).replace(/^\w+, /, "")} · ${vs}${x.round ? ` · ${x.round}` : ""}` };
  });
}

/** hasUser: tiene usuario en la app (se le puede mandar la entrevista para que la conteste él). */
export type PlayerOption = { id: string; label: string; name: string; hasUser: boolean };

export async function fetchPlayerOptions(supabase: DB): Promise<PlayerOption[]> {
  const { data } = await supabase.from("squad_members").select("number, status, player:players!inner(id, first_name, last_name, nickname, user_id)").eq("season", seasonOf()).neq("status", "left")
    .returns<{ number: number | null; status: string; player: Pick<Player, "id" | "first_name" | "last_name" | "nickname" | "user_id"> }[]>();
  return (data ?? []).map((r) => ({ id: r.player.id, name: shirtName(r.player), hasUser: !!r.player.user_id, label: `${r.number != null ? `${r.number} · ` : ""}${shirtName(r.player)}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
}

/** El último partido jugado con acta que aún no tiene crónica (para proponerla en Inicio y en la portada). */
export async function fetchPendingChronicle(supabase: DB): Promise<{ id: string; rival: string } | null> {
  const { data: last } = await supabase.from("matches").select("id, report_saved_at, rival:rivals!inner(name)").eq("status", "played")
    .not("report_saved_at", "is", null).order("match_date", { ascending: false }).limit(1)
    .returns<{ id: string; report_saved_at: string; rival: { name: string } }[]>();
  const m = last?.[0];
  if (!m) return null;
  // Solo si es de las dos últimas semanas
  if (Date.now() - new Date(m.report_saved_at).getTime() > 14 * 86_400_000) return null;
  const { count } = await supabase.from("news_articles").select("id", { count: "exact", head: true }).eq("kind", "cronica").eq("match_id", m.id);
  return count ? null : { id: m.id, rival: m.rival.name };
}

// ------------------------------------------------------------------ Entrevistas en la app (4.2.0)
export type Interview = {
  id: string;
  article_id: string;
  player_id: string;
  questions: InterviewQA[];
  status: InterviewStatus;
  sent_by: string | null;
  sent_at: string;
  answered_at: string | null;
};

/** La entrevista mandada desde un borrador (si la hay). */
export async function fetchInterview(supabase: DB, articleId: string): Promise<Interview | null> {
  const { data } = await supabase.from("news_interviews").select("*").eq("article_id", articleId).maybeSingle<Interview>();
  return data;
}

/** Una entrevista para contestarla (la base de datos solo deja ver las propias, o todas a la redacción). */
export async function fetchInterviewById(supabase: DB, id: string): Promise<(Interview & { player: Pick<Player, "id" | "first_name" | "last_name" | "nickname" | "photo_url" | "user_id"> }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("news_interviews").select("*, player:players!inner(id, first_name, last_name, nickname, photo_url, user_id)").eq("id", id)
    .maybeSingle<Interview & { player: Pick<Player, "id" | "first_name" | "last_name" | "nickname" | "photo_url" | "user_id"> }>();
  return data;
}

/** Las entrevistas que me han mandado y aún no he entregado (para la tarjeta de Inicio). */
export async function fetchMyPendingInterviews(supabase: DB, userId: string): Promise<Pick<Interview, "id" | "questions" | "sent_at">[]> {
  const { data } = await supabase.from("news_interviews").select("id, questions, sent_at, player:players!inner(user_id)").eq("status", "pending").eq("player.user_id", userId)
    .order("sent_at", { ascending: false }).limit(3).returns<(Pick<Interview, "id" | "questions" | "sent_at">)[]>();
  return data ?? [];
}
