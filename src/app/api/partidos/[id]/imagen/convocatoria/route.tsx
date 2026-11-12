import { createClient } from "@/lib/supabase/server";
import { fetchCallups, fetchMatch } from "@/lib/match-queries";
import { hhmm } from "@/lib/matches";
import { lineOf, shirtName } from "@/lib/squad";
import { loadAssets, type Format } from "@/lib/result-image";
import { drawCallupPoster } from "@/lib/match-posters";
import { competitionLabel, mainSponsorLogo, posterDay, posterTeams } from "@/lib/poster-sources";

export const runtime = "nodejs";

/**
 * Imagen de la convocatoria para compartir (v4.4.0): ?formato=historia para la de 1080 × 1920;
 * si no, la publicación de 1080 × 1350. Solo con la convocatoria publicada. Salen todos los
 * convocados por igual, por líneas (sin titulares ni suplentes), y ni la quedada ni las notas.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const m = await fetchMatch(supabase, id);
  if (!m || !m.callup_published_at) return new Response("No encontrado", { status: 404 });
  const [rows, { crest }, sponsor] = await Promise.all([fetchCallups(supabase, m), loadAssets(), mainSponsorLogo(supabase)]);
  if (!rows.length) return new Response("No encontrado", { status: 404 });
  const { home, away } = await posterTeams(supabase, m, crest, format === "story" ? 220 : 150);

  const { body, type } = await drawCallupPoster({
    competition: competitionLabel(m),
    day: posterDay(m.match_date),
    kickoff: hhmm(m.kickoff),
    venue: m.venue,
    home,
    away,
    crest,
    sponsor,
    players: rows.map((r) => ({ name: shirtName(r.player), number: r.number, line: lineOf(r.position) })),
  }, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" } });
}
