import { createClient } from "@/lib/supabase/server";
import { fetchCallups, fetchMatch } from "@/lib/match-queries";
import { hhmm } from "@/lib/matches";
import { lineOf, shirtName } from "@/lib/squad";
import { loadAssets, type Format } from "@/lib/result-image";
import { PHOTO_BOX, drawCallupPoster } from "@/lib/match-posters";
import { competitionLabel, embed, mainSponsorLogos, posterDay, posterTeams } from "@/lib/poster-sources";

export const runtime = "nodejs";

/**
 * Imagen de la convocatoria para compartir (v4.4.0): ?formato=historia para la de 1080 × 1920;
 * si no, la publicación de 1080 × 1350. Solo con la convocatoria publicada. Salen solo los que han
 * dicho «Voy» (4.4.1), por igual y por líneas (sin titulares ni suplentes), y ni la quedada ni las notas.
 * Desde la 4.18.0 cada convocado sale en su cromo, con su foto si la tiene (los porteros, sin foto), y solo
 * con su línea (POR, DEF, MED, DEL), no la posición exacta, para no dar pistas al rival.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const m = await fetchMatch(supabase, id);
  if (!m || !m.callup_published_at) return new Response("No encontrado", { status: 404 });
  const [all, { crest }, sponsors] = await Promise.all([fetchCallups(supabase, m), loadAssets(), mainSponsorLogos(supabase)]);
  const rows = all.filter((r) => r.reply === "yes");
  if (!rows.length) return new Response("No encontrado", { status: 404 });
  // Fotos de los cromos (v4.18.0), recortadas al hueco del cromo; sin foto sale la camiseta
  const [{ home, away }, photos] = await Promise.all([
    posterTeams(supabase, m, crest, format === "story" ? 160 : 120),
    // Los porteros van siempre sin foto, con su cromo dorado (decisión de Alvaro)
    Promise.all(rows.map((r) => (lineOf(r.position) === "GK" ? null : embed(r.player.photo_url, ["player-photos"], { max: 0, photo: PHOTO_BOX })))),
  ]);

  const { body, type } = await drawCallupPoster({
    competition: competitionLabel(m),
    day: posterDay(m.match_date),
    kickoff: hhmm(m.kickoff),
    venue: m.venue,
    home,
    away,
    crest,
    sponsors,
    players: rows.map((r, i) => ({ name: shirtName(r.player), number: r.number, line: lineOf(r.position), photo: photos[i] })),
  }, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" } });
}
