import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { COMPETITION_LABEL, hhmm, longDay, type Competition, type MatchRow } from "@/lib/matches";
import { POSITION_LABEL } from "@/lib/squad";
import { isNewsSlug, type NewsKind } from "@/lib/news";
import { createAdminClient } from "@/lib/supabase/admin";
import { sponsorCards, type ArticleCard, type MatchSheet } from "@/lib/news-queries";

/** Las promociones públicas llevan su patrocinador (nombre, logo y web). */
async function withPublicSponsors(cards: ArticleCard[]): Promise<ArticleCard[]> {
  const promos = cards.filter((c) => c.kind === "promocion" && c.public_slug);
  if (!promos.length) return cards;
  const { data } = await createAdminClient().from("news_articles").select("public_slug, sponsor_id").eq("is_public", true).in("public_slug", promos.map((c) => c.public_slug!))
    .returns<{ public_slug: string; sponsor_id: string | null }[]>();
  const bySlug = new Map((data ?? []).map((r) => [r.public_slug, r.sponsor_id]));
  const map = await sponsorCards([...bySlug.values()]);
  return cards.map((c) => {
    const sid = c.public_slug ? bySlug.get(c.public_slug) : null;
    return sid ? { ...c, sponsor_id: sid, sponsor: map.get(sid) ?? null } : c;
  });
}

/** Lo que devuelve la base de datos para una pieza pública (jugadores solo por su apodo). */
type PublicRow = {
  id: string; slug: string; kind: NewsKind; title: string; kicker: string | null; summary: string | null; body?: string;
  cover_url: string | null; cover_caption: string | null; byline: string; published_at: string; updated_at: string;
  match: {
    id: string; match_date: string; kickoff: string | null; is_home: boolean; goals_for: number | null; goals_against: number | null;
    status: MatchRow["status"]; round: string | null; competition: Competition; venue: string | null; report: boolean; mvp: string | null;
    rival: { name: string; short_name: string | null; crest_url: string | null; color: string | null };
  } | null;
  player: { id: string; name: string; photo_url: string | null } | null;
  sheet?: { starters: string[]; subs: string[]; goals: { scorer: string | null; assist: string | null; own_goal: boolean }[]; cards: { name: string; yellows: number; red: boolean }[] };
  player_info?: { number: number | null; position: string; apps: number; goals: number } | null;
};

export type PublicArticle = { card: ArticleCard; sheet: MatchSheet | null; player: { name: string; number: number | null; position: string; apps: number; goals: number } | null };

/** La convierte en la tarjeta de siempre para reutilizar los mismos componentes que dentro de la app. */
function toCard(r: PublicRow): ArticleCard {
  return {
    id: r.slug, kind: r.kind, title: r.title, kicker: r.kicker, summary: r.summary, body: r.body ?? "",
    match_id: r.match?.id ?? null, player_id: r.player?.id ?? null, cover_url: r.cover_url, cover_caption: r.cover_caption,
    byline: r.byline, ai_notes: null, featured: false, status: "published", published_at: r.published_at, notified_at: null,
    created_by: null, created_at: r.published_at, updated_at: r.updated_at, is_public: true, public_slug: r.slug,
    match: r.match ? { ...r.match } : null,
    // El nombre público va como apodo: nunca nombre y apellidos
    player: r.player ? { id: r.player.id, first_name: "", last_name: "", nickname: r.player.name, photo_url: r.player.photo_url } : null,
  };
}

function toSheet(r: PublicRow): MatchSheet | null {
  const m = r.match;
  if (!m || (r.kind !== "cronica" && r.kind !== "previa")) return null;
  const played = m.status === "played" && m.goals_for != null && m.goals_against != null;
  const s = r.sheet ?? { starters: [], subs: [], goals: [], cards: [] };
  const count = (xs: (string | null)[]) => {
    const map = new Map<string, number>();
    for (const x of xs) if (x) map.set(x, (map.get(x) ?? 0) + 1);
    return [...map];
  };
  return {
    m: { ...m, rival: { ...m.rival, id: "", home_venue: null, home_maps_url: null, notes: null } } as unknown as MatchRow,
    report: played && m.report ? ({} as MatchSheet["report"]) : null,
    facts: {
      rival: m.rival.name, home: m.is_home, date: longDay(m.match_date), competition: COMPETITION_LABEL[m.competition], round: m.round,
      venue: m.venue, kickoff: hhmm(m.kickoff), played, goalsFor: m.goals_for, goalsAgainst: m.goals_against,
      scorers: count(s.goals.filter((g) => !g.own_goal).map((g) => g.scorer)).map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals),
      ownGoals: s.goals.filter((g) => g.own_goal).length,
      assists: count(s.goals.map((g) => g.assist)).map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count),
      starters: s.starters, subs: s.subs, goalkeeper: null, cards: s.cards, mvp: m.mvp,
      usRank: null, rivalRank: null, callup: [], form: null,
    },
  };
}

export const loadPublicArticle = cache(async (slug: string): Promise<PublicArticle | null> => {
  if (!isNewsSlug(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("news_public", { p_slug: slug });
  if (error || !data) return null;
  const r = data as PublicRow;
  const pi = r.player_info;
  return {
    card: (await withPublicSponsors([toCard(r)]))[0],
    sheet: toSheet(r),
    player: r.player && pi ? { name: r.player.name, number: pi.number, position: POSITION_LABEL[pi.position] ?? "Jugador", apps: pi.apps, goals: pi.goals } : null,
  };
});

export const loadPublicList = cache(async (limit = 30): Promise<ArticleCard[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("news_public_list", { p_limit: limit });
  return withPublicSponsors(((data ?? []) as PublicRow[]).map(toCard));
});
