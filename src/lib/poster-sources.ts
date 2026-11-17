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
  // Lo ya preparado se guarda unos minutos: pasar de publicación a historia no vuelve a pedir ni recortar las fotos (4.18.3)
  const key = `${url}|${JSON.stringify(opts)}`;
  const hit = prepared.get(key);
  if (hit && hit.until > Date.now()) return hit.pic;
  const pic = await embedFresh(url, buckets, opts);
  if (pic) {
    if (prepared.size >= 120) prepared.delete(prepared.keys().next().value!);
    prepared.set(key, { pic, until: Date.now() + 5 * 60_000 });
  }
  return pic;
}

const prepared = new Map<string, { pic: Pic; until: number }>();

async function embedFresh(url: string, buckets: string[], opts: Parameters<typeof prepareImage>[1]): Promise<Pic | null> {
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

/** Como mucho se ponen 3 patrocinadores principales en el pie de una imagen. */
export const MAX_POSTER_SPONSORS = 3;

/**
 * Logos de los patrocinadores principales para el pie de las imágenes para compartir (4.20.0: todos los
 * principales con logo, como mucho 3, en el orden de Gestión → Patrocinadores), si el interruptor
 * «En las imágenes para compartir» (sponsor_settings.show_result) está encendido.
 */
export async function mainSponsorLogos(supabase: DB): Promise<Pic[]> {
  const [display, showcase] = await Promise.all([fetchDisplay(supabase), supabase.rpc("sponsor_showcase")]);
  if (!display.show_result) return [];
  const mains = ((showcase.data ?? []) as Showcase[]).filter((x) => x.tier === "main" && x.logo_url).slice(0, MAX_POSTER_SPONSORS);
  const pics = await Promise.all(mains.map((m) => embed(m.logo_url, ["sponsor-logos"], { max: 280 })));
  return pics.filter((p): p is Pic => !!p);
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
  // Últimos 3 resultados de cada uno según la web de la liga, del más antiguo al más reciente (v4.18.0)
  const form = (r: Rank | null | undefined) => (r?.form ?? []).slice(-3);
  const us: Team = { name: CLUB_NAME, short: "RVA", color: "#D20D17", crest, isUs: true, rank: rank(ranks?.us), form: form(ranks?.us) };
  const them: Team = { name: m.rival.name, short: rivalShort(m.rival), color: rivalColor(m.rival), crest: themCrest, isUs: false, rank: rank(ranks?.rival), form: form(ranks?.rival) };
  return { home: m.is_home ? us : them, away: m.is_home ? them : us, ranks };
}
