import { createClient } from "@/lib/supabase/server";
import { fetchMatch, fetchReport } from "@/lib/match-queries";
import { CLUB_NAME, COMPETITION_LABEL, byKickoff, hhmm, longDay, outcomeOf, rivalColor, rivalShort, shortDay, type MatchRow, type Outcome } from "@/lib/matches";
import { shirtName } from "@/lib/squad";
import { mainSponsorLogo, rivalCrest, within, embed } from "@/lib/poster-sources";
import { fetchMvpBoard } from "@/lib/mvp-server";
import { getLeagueTable } from "@/lib/league-table";
import { drawPoster, loadAssets, type Format, type PosterData } from "@/lib/result-image";

export const runtime = "nodejs";

/**
 * Imagen del resultado para compartir: ?formato=historia para la de 1080 × 1920 (estados e historias);
 * si no, la publicación de 1080 × 1350.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  // Primero la votación del MVP: si ya tocaba cerrarla, se hace el recuento y el MVP sale en la imagen
  const board = await fetchMvpBoard(supabase, id).catch(() => null);
  const m = await fetchMatch(supabase, id);
  if (!m || m.status !== "played") return new Response("No encontrado", { status: 404 });
  const o = outcomeOf(m)!;

  const [report, { crest }, season, league] = await Promise.all([
    fetchReport(supabase, m),
    loadAssets(),
    supabase.from("matches").select("*, rival:rivals!inner(*)").eq("season", m.season).in("status", ["played", "scheduled"]).returns<MatchRow[]>().then((r) => r.data ?? []),
    supabase.from("league_sync").select("competition, team").eq("id", 1).maybeSingle<{ competition: string; team: string }>().then((r) => r.data),
  ]);

  // Racha hasta este partido y siguiente partido
  const ordered = [...season].sort(byKickoff);
  const at = ordered.findIndex((x) => x.id === m.id);
  const form = ordered.slice(0, at + 1).map((x) => outcomeOf(x)).filter((x): x is Outcome => !!x).slice(-5);
  const next = ordered.slice(at + 1).find((x) => x.status === "scheduled");
  // Clasificación: solo si es el último partido de liga jugado (si no, la tabla de hoy no es la de ese día)
  const lastLeague = ordered.filter((x) => x.competition === "league" && x.status === "played").at(-1);
  const tableP = m.competition === "league" && lastLeague?.id === m.id && league?.competition && league.team
    ? within(getLeagueTable(league.competition), 2500).then((t) => t?.rows.find((r) => r.teamId === league.team) ?? null)
    : Promise.resolve(null);

  const [sponsor, mvpPhoto, themCrest, nextCrest, row] = await Promise.all([
    mainSponsorLogo(supabase),
    embed(report.mvp?.player.photo_url, ["player-photos"], { max: 0, photo: { w: 300, h: 310 } }),
    rivalCrest(m.rival.crest_url, format === "story" ? 240 : 200),
    next ? rivalCrest(next.rival.crest_url, 60) : null,
    tableP,
  ]);

  // Goleadores agrupados («EISIEL» con dos balones) y sus asistentes
  const scorers = new Map<string, { goals: number; assists: Set<string> }>();
  for (const g of report.goals) {
    const n = g.own_goal ? "En propia puerta" : g.scorer ? shirtName(g.scorer.player) : null;
    if (!n) continue;
    const e = scorers.get(n) ?? { goals: 0, assists: new Set<string>() };
    e.goals++;
    if (g.assist) e.assists.add(shirtName(g.assist.player));
    scorers.set(n, e);
  }
  const all = [...scorers].sort((x, y) => y[1].goals - x[1].goals);
  const scorerList = all.slice(0, format === "story" ? 5 : 3).map(([name, e]) => ({ name, goals: e.goals, assists: [...e.assists] }));

  const keeper = report.appearances.find((a) => a.goalkeeper);
  const mvp = report.mvp;
  const us = { name: CLUB_NAME, short: "RVA", color: "#D20D17", crest, goals: m.goals_for ?? 0, isUs: true };
  const them = { name: m.rival.name, short: rivalShort(m.rival), color: rivalColor(m.rival), crest: themCrest, goals: m.goals_against ?? 0, isUs: false };
  const day = longDay(m.match_date);

  const data: PosterData = {
    outcome: o,
    competition: ([COMPETITION_LABEL[m.competition], m.round].filter(Boolean).join(" · ") || "PARTIDO").toUpperCase(),
    day: day.charAt(0).toUpperCase() + day.slice(1),
    venue: m.venue,
    home: m.is_home ? us : them,
    away: m.is_home ? them : us,
    crest,
    scorers: scorerList,
    moreScorers: all.length - scorerList.length,
    cleanSheet: m.goals_against === 0 && keeper ? shirtName(keeper.player) : null,
    cards: report.appearances.filter((a) => a.yellows > 0 || a.red).map((a) => ({ name: shirtName(a.player), yellows: a.yellows, red: a.red })),
    played: report.appearances.map((a) => shirtName(a.player)),
    mvp: mvp ? {
      name: shirtName(mvp.player),
      number: mvp.number,
      position: mvp.position,
      goalkeeper: mvp.position === "POR",
      goals: report.goals.filter((g) => g.scorer_id === mvp.player_id).length,
      assists: report.goals.filter((g) => g.assist_id === mvp.player_id).length,
      photo: mvpPhoto,
    } : null,
    mvpPending: !mvp && !!board && !board.counted,
    form,
    table: row ? { pos: row.pos, points: row.points } : null,
    next: next ? {
      name: next.rival.name,
      short: rivalShort(next.rival),
      color: rivalColor(next.rival),
      crest: nextCrest,
      when: [shortDay(next.match_date), hhmm(next.kickoff)].filter(Boolean).join(" · "),
      home: next.is_home,
    } : null,
    sponsor,
  };

  const { body, type } = await drawPoster(data, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" } });
}
