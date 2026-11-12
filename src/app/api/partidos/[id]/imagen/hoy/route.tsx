import { createClient } from "@/lib/supabase/server";
import { fetchMatch } from "@/lib/match-queries";
import { byKickoff, hhmm, longDay, outcomeOf, todayMadrid, type MatchRow, type Outcome } from "@/lib/matches";
import { addDays } from "@/lib/matchday";
import { fetchMatchWeather, skyOf } from "@/lib/weather";
import { gapLabel } from "@/lib/standings";
import { loadAssets, type Format } from "@/lib/result-image";
import { drawMatchdayPoster, type Sky } from "@/lib/match-posters";
import { competitionLabel, mainSponsorLogo, posterDay, posterTeams, within } from "@/lib/poster-sources";

export const runtime = "nodejs";

/** «¡HOY JUGAMOS!», «¡MAÑANA JUGAMOS!» o «¡EL SÁBADO JUGAMOS!», según cuándo se saque la imagen. */
function matchdayTitle(date: string, today = todayMadrid()) {
  if (date === today) return "¡HOY JUGAMOS!";
  if (date === addDays(today, 1)) return "¡MAÑANA JUGAMOS!";
  return `¡EL ${longDay(date).split(",")[0].toUpperCase()} JUGAMOS!`;
}

/** Código del tiempo → icono dibujado. */
function skyKind(code: number): Sky {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code <= 2) return "sun";
  return "cloud";
}

/**
 * Imagen «Hoy jugamos» para compartir antes del partido (v4.4.0): rival, hora, campo y cómo
 * llegamos (racha, clasificación y el tiempo). ?formato=historia para la de 1080 × 1920.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const m = await fetchMatch(supabase, id);
  if (!m || m.status !== "scheduled") return new Response("No encontrado", { status: 404 });

  const today = todayMadrid();
  const soon = m.match_date >= today && m.match_date <= addDays(today, 10);
  const [{ crest }, sponsor, season, weather] = await Promise.all([
    loadAssets(),
    mainSponsorLogo(supabase),
    supabase.from("matches").select("*, rival:rivals!inner(*)").eq("season", m.season).eq("status", "played").returns<MatchRow[]>().then((r) => r.data ?? []),
    soon ? within(fetchMatchWeather(m.match_date, m.kickoff), 3000) : null,
  ]);
  const { home, away, ranks } = await posterTeams(supabase, m, crest, format === "story" ? 260 : 200);

  const form = [...season].filter((x) => x.match_date <= m.match_date).sort(byKickoff)
    .map((x) => outcomeOf(x)).filter((x): x is Outcome => !!x).slice(-5);
  const sky = weather ? skyOf(weather) : null;

  const { body, type } = await drawMatchdayPoster({
    title: matchdayTitle(m.match_date, today),
    competition: competitionLabel(m),
    day: posterDay(m.match_date),
    kickoff: hhmm(m.kickoff),
    venue: m.venue,
    home,
    away,
    crest,
    sponsor,
    form,
    gap: ranks ? gapLabel(ranks.us, ranks.rival) : null,
    weather: weather && sky ? { temp: Math.round(weather.temp), text: sky.text, kind: skyKind(weather.code) } : null,
  }, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" } });
}
