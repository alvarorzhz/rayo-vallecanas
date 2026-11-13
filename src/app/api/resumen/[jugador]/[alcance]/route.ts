import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { loadAssets, type Format } from "@/lib/result-image";
import { embed, mainSponsorLogo } from "@/lib/poster-sources";
import { drawSummaryPoster } from "@/lib/summary-poster";
import { playerSummary, teamSummary } from "@/lib/season-summary";
import { fetchSummaryData, resolveScope } from "@/lib/season-summary-queries";
import { lineOf, shirtName } from "@/lib/squad";

export const runtime = "nodejs";

/** Imagen del resumen de temporada de un jugador. ?formato=historia para la de 1080 × 1920. */
export async function GET(req: Request, { params }: { params: Promise<{ jugador: string; alcance: string }> }) {
  const { jugador, alcance } = await params;
  const format: Format = new URL(req.url).searchParams.get("formato") === "historia" ? "story" : "post";
  if (!/^[0-9a-f-]{36}$/.test(jugador)) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });

  const scope = await resolveScope(supabase, alcance, seasonOf());
  const season = scope.kind === "season" ? scope.season : scope.season ?? seasonOf();
  const [data, { data: member }, { crest }, sponsor] = await Promise.all([
    fetchSummaryData(supabase, scope),
    supabase.from("squad_members_full").select("number, position, player:players!inner(first_name, last_name, nickname, photo_url)").eq("player_id", jugador).eq("season", season).maybeSingle(),
    loadAssets(),
    mainSponsorLogo(supabase),
  ]);
  if (!member || !data.matches.length) return new Response("No encontrado", { status: 404 });
  const p = member.player as unknown as { first_name: string; last_name: string; nickname: string | null; photo_url: string | null };
  const s = playerSummary(jugador, data);
  const t = teamSummary(data.matches);
  const gk = lineOf(member.position as string) === "GK" || s.gkApps > s.apps / 2;
  const photo = await embed(p.photo_url, ["player-photos", "avatars"], { max: 0, photo: { w: 311, h: 321 } });
  const b = s.best && (s.best.goals || s.best.assists || s.best.mvp) ? s.best : null;
  const { body, type } = await drawSummaryPoster({
    crest,
    scope: (scope.kind === "season" ? `TEMPORADA ${scope.season}` : `${scope.name}${scope.season ? ` ${scope.season}` : ""}`).toUpperCase(),
    title: s.badge.title,
    line: s.badge.line,
    player: { name: shirtName(p), number: member.number as number | null, position: member.position as string, goalkeeper: gk, photo, goals: s.goals, assists: s.assists },
    stats: gk
      ? [{ label: "Partidos", value: s.apps }, { label: "A cero", value: s.cleanSheets }, { label: "MVP", value: s.mvps }]
      : [{ label: "Partidos", value: s.apps }, { label: "Goles", value: s.goals }, { label: "Asist.", value: s.assists }, { label: "MVP", value: s.mvps }],
    best: b ? `Su mejor partido: ${b.match.is_home ? `Rayo ${b.match.goals_for}-${b.match.goals_against} ${b.match.rival}` : `${b.match.rival} ${b.match.goals_against}-${b.match.goals_for} Rayo`}${b.goals ? ` · ${b.goals} ${b.goals === 1 ? "gol" : "goles"}` : ""}${b.mvp ? " · MVP" : ""}` : null,
    team: `El equipo: ${t.W}V ${t.D}E ${t.L}D · ${t.gf} goles a favor`,
    sponsor,
  }, format);
  return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}
