import { createClient } from "@/lib/supabase/server";
import { loadAssets, type Format } from "@/lib/result-image";
import { mainSponsorLogos } from "@/lib/poster-sources";
import { drawSummaryPoster, summaryPosterData } from "@/lib/summary-poster";
import { loadWrapped } from "@/lib/wrapped-server";

export const runtime = "nodejs";

/** Imagen del resumen de temporada de un jugador. ?formato=historia para la de 1080 × 1920. */
export async function GET(req: Request, { params }: { params: Promise<{ jugador: string; alcance: string }> }) {
  const { jugador, alcance } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  if (!/^[0-9a-f-]{36}$/.test(jugador)) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const [w, { crest }, sponsors] = await Promise.all([loadWrapped(supabase, jugador, alcance, auth.claims.sub), loadAssets(), mainSponsorLogos(supabase)]);
  if (!w) return new Response("No encontrado", { status: 404 });
  const { body, type } = await drawSummaryPoster(await summaryPosterData(w, crest, sponsors), format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}
