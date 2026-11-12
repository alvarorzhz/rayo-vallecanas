import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareImage, type Pic } from "@/lib/result-image";
import { fetchDisplay, type Showcase } from "@/lib/sponsors";
import type { createClient } from "@/lib/supabase/server";
import { CLUB_NAME, COMPETITION_LABEL, longDay, rivalColor, rivalShort, type MatchRow } from "@/lib/matches";
import { getStandings } from "@/lib/league-table";
import { matchRanks, type MatchRanks, type Rank } from "@/lib/standings";
import type { Team } from "@/lib/match-posters";

type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * Lee una imagen y la prepara para un póster. Solo ficheros de la propia app o de nuestro
 * almacenamiento: así nadie puede hacer que el servidor pida una dirección cualquiera.
 */
export async function embed(url: string | null | undefined, buckets: string[], opts: Parameters<typeof prepareImage>[1]): Promise<Pic | null> {
  if (!url) return null;
  try {
    let buf: Buffer;
    if (url.startsWith("/")) {
      if (!/^\/patrocinadores\/[\w.-]+\.(png|jpe?g|webp)$/.test(url)) return null;
      buf = await readFile(join(process.cwd(), "public", url));
    } else {
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
      if (!base || !buckets.some((b) => url.startsWith(`${base}/storage/v1/object/public/${b}/`))) return null;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      buf = Buffer.from(await r.arrayBuffer());
    }
    return await prepareImage(buf, opts);
  } catch {
    return null;
  }
}

/** Escudo de un rival: el nuestro preparado si está en el almacenamiento; si no, el enlace tal cual. */
export async function rivalCrest(url: string | null, size: number): Promise<Pic | string | null> {
  if (!url) return null;
  return (await embed(url, ["rival-crests"], { max: size })) ?? (/^https:\/\//.test(url) ? url : null);
}

/** Lo que tarde algo de fuera (la web de la liga, el tiempo) no puede frenar la imagen. */
export const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);

/**
 * Logo del patrocinador principal para el pie de las imágenes para compartir, si el interruptor
 * «En las imágenes para compartir» (sponsor_settings.show_result) está encendido.
 */
export async function mainSponsorLogo(supabase: DB): Promise<Pic | null> {
  const [display, showcase] = await Promise.all([fetchDisplay(supabase), supabase.rpc("sponsor_showcase")]);
  if (!display.show_result) return null;
  const main = ((showcase.data ?? []) as Showcase[]).find((x) => x.tier === "main" && x.logo_url);
  return main ? embed(main.logo_url, ["sponsor-logos"], { max: 280 }) : null;
}

/** «LIGA · JORNADA 7» */
export function competitionLabel(m: { competition: keyof typeof COMPETITION_LABEL; round: string | null }) {
  return ([COMPETITION_LABEL[m.competition], m.round].filter(Boolean).join(" · ") || "PARTIDO").toUpperCase();
}

/** «Sábado, 7 de noviembre» */
export function posterDay(date: string) {
  const day = longDay(date);
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Los dos equipos para los pósters de antes del partido, con su posición y puntos si es de liga
 * y la web de la liga contesta a tiempo.
 */
export async function posterTeams(supabase: DB, m: MatchRow, crest: Pic, crestSize: number): Promise<{ home: Team; away: Team; ranks: MatchRanks | null }> {
  const [themCrest, standings] = await Promise.all([
    rivalCrest(m.rival.crest_url, crestSize),
    m.competition === "league" && m.status !== "played" && m.status !== "cancelled" ? getStandings(supabase).catch(() => null) : null,
  ]);
  const ranks = standings ? matchRanks(standings.table.rows, standings.us, [m], m.season).get(m.id) ?? null : null;
  const rank = (r: Rank | null | undefined) => (r ? { pos: r.pos, points: r.points } : null);
  const us: Team = { name: CLUB_NAME, short: "RVA", color: "#D20D17", crest, isUs: true, rank: rank(ranks?.us) };
  const them: Team = { name: m.rival.name, short: rivalShort(m.rival), color: rivalColor(m.rival), crest: themCrest, isUs: false, rank: rank(ranks?.rival) };
  return { home: m.is_home ? us : them, away: m.is_home ? them : us, ranks };
}
