import { createClient } from "@/lib/supabase/server";
import { loadAssets, type Format } from "@/lib/result-image";
import { mainSponsorLogos } from "@/lib/poster-sources";
import { drawSummaryPoster, drawWrappedCard, summaryPosterData } from "@/lib/summary-poster";
import { loadWrapped } from "@/lib/wrapped-server";
import { SLIDE_KEYS, type SlideKey } from "@/lib/wrapped";

export const runtime = "nodejs";

/**
 * Imagen de una historia del Rayo Wrapped (4.23.0). La del título es el póster del resumen,
 * con el cromo. ?formato=historia para la de 1080 × 1920.
 */
export async function GET(req: Request, { params }: { params: Promise<{ jugador: string; alcance: string; historia: string }> }) {
  const { jugador, alcance, historia } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  if (!/^[0-9a-f-]{36}$/.test(jugador) || !SLIDE_KEYS.includes(historia as SlideKey)) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const [w, { crest }, sponsors] = await Promise.all([loadWrapped(supabase, jugador, alcance, auth.claims.sub), loadAssets(), mainSponsorLogos(supabase)]);
  const slide = w?.slides.find((s) => s.key === historia);
  if (!w || !slide) return new Response("No encontrado", { status: 404 });
  const { body, type } = slide.key === "titulo"
    ? await drawSummaryPoster(await summaryPosterData(w, crest, sponsors), format)
    : await drawWrappedCard({ crest, scope: w.scopeLabel.toUpperCase(), player: w.name, slide, sponsors }, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}
