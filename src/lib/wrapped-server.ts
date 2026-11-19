import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchRoster } from "@/lib/squad-queries";
import { lineOf, shirtName } from "@/lib/squad";
import { seasonRatingPool, type SeasonRating } from "@/lib/ratings";
import { teamSummary } from "@/lib/season-summary";
import { fetchSummaryData, resolveScope, scopeSlug } from "@/lib/season-summary-queries";
import { wrappedSlides, type SeasonRatingOf } from "@/lib/wrapped";

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Todo lo del Rayo Wrapped de un jugador en un alcance (temporada o competición): las historias,
 * su resumen y su ficha. Lo usan la pantalla de historias y las imágenes de cada una.
 */
export async function loadWrapped(supabase: DB, playerId: string, alcance: string | undefined, viewerId: string | null) {
  const scope = await resolveScope(supabase, alcance, seasonOf());
  const season = scope.kind === "season" ? scope.season : scope.season ?? seasonOf();
  const [data, roster, ratings] = await Promise.all([
    fetchSummaryData(supabase, scope),
    fetchRoster(supabase, season),
    supabase.rpc("rating_season", { p_season: season }).then((r) => (r.data ?? []) as SeasonRating[]),
  ]);
  const entry = roster.find((r) => r.player_id === playerId);
  if (!entry || !data.matches.length) return null;

  // Nota media de la temporada, si entra en la tarjeta de Estadísticas (mismo criterio)
  const pool = seasonRatingPool(ratings);
  const mine = pool.get(playerId);
  const rating: SeasonRatingOf | null = mine
    ? { avg: mine.avg_score, matches: mine.matches, best: mine.best, rank: 1 + [...pool.values()].filter((r) => r.avg_score > mine.avg_score).length }
    : null;

  const apps = data.apps.filter((a) => a.player_id === playerId);
  const gk = lineOf(entry.position) === "GK" || apps.filter((a) => a.goalkeeper).length > apps.length / 2;
  const scopeLabel = scope.kind === "season" ? `temporada ${scope.season}` : `${scope.name}${scope.season ? ` ${scope.season}` : ""}`;
  const name = shirtName(entry.player);
  const { slides, summary } = wrappedSlides({
    playerId, you: !!viewerId && entry.player.user_id === viewerId, name, scope: scopeLabel,
    scopeShort: scope.kind === "season" ? "temporada" : scope.name, gk,
    data, names: new Map(roster.map((r) => [r.player_id, shirtName(r.player)])), rating,
  });
  return { scope, slug: scopeSlug(scope), scopeLabel, season, entry, name, gk, data, slides, summary, team: teamSummary(data.matches) };
}

export type Wrapped = NonNullable<Awaited<ReturnType<typeof loadWrapped>>>;
