import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, NEWS_NAME, plainText, readingMinutes } from "@/lib/news";
import { fetchArticle, fetchMatchSheet, fetchPlayerFacts, fetchPublished } from "@/lib/news-queries";
import { ArticleBody } from "@/components/news/article-body";
import { MatchSheetBox } from "@/components/news/match-sheet";
import { Masthead } from "@/components/news/masthead";
import { StoryArt, StoryLine, kickerOf } from "@/components/news/story";
import { ShareButton } from "@/components/news/share-button";

const longDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await fetchArticle(await createClient(), id);
  return { title: a ? `${a.title} · ${NEWS_NAME}` : NEWS_NAME };
}

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ publicada?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("news");
  const supabase = await createClient();
  const a = await fetchArticle(supabase, id);
  if (!a) notFound();
  const canEdit = s.can("news", "update") || (s.can("news", "create") && a.created_by === s.user.id);
  const [sheet, player, more] = await Promise.all([
    a.match_id && (a.kind === "cronica" || a.kind === "previa") ? fetchMatchSheet(supabase, a.match_id, { standings: a.kind === "previa" }) : Promise.resolve(null),
    a.kind === "entrevista" && a.player_id ? fetchPlayerFacts(supabase, a.player_id) : Promise.resolve(null),
    fetchPublished(supabase, { limit: 4 }),
  ]);
  const others = more.filter((x) => x.id !== a.id).slice(0, 3);
  const official = a.kind === "comunicado";

  return (
    <div className="paper -mx-4 -mt-5 px-4 pb-8 pt-5 sm:mx-0 sm:mt-0 sm:rounded-sm sm:px-8 sm:pt-6 sm:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] lg:px-10">
      <Masthead size="sm" href="/la-voz" />

      {sp.publicada && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 ring-1 ring-green-600/15">¡Publicada! Ya está en la portada de {NEWS_NAME}.</p>}
      {a.status === "draft" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-600/20">Borrador: solo lo ve la redacción.</p>}

      <article className="mx-auto mt-6 max-w-3xl">
        <header className="press-in-2">
          <div className="flex items-center gap-3">
            <p className="news-kicker text-sm">{kickerOf(a)}</p>
            {a.kicker && <span className="news-meta">· {KIND_LABEL[a.kind]}</span>}
            {official && <span className="news-seal ml-auto rounded-md px-2 py-0.5 text-xs">Comunicado oficial</span>}
          </div>
          <h1 className="news-head mt-2 text-[2.1rem] font-black leading-[1.03] sm:text-5xl">{a.title}</h1>
          {a.summary && <p className="news-body mt-3 text-xl leading-snug text-[#141210]/80">{a.summary}</p>}
          <div className="news-rule-thin mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
            <p className="news-meta min-w-0 flex-1">
              Por <span className="text-[#141210]">{a.byline}</span> · {a.published_at ? longDate.format(new Date(a.published_at)) : "Sin publicar"} · {readingMinutes(a.summary, plainText(a.body))} min de lectura
            </p>
            {a.status === "published" && <ShareButton title={a.title} />}
            {canEdit && <Link href={`/la-voz/${a.id}/editar`} prefetch className="btn-ghost !px-3 !py-1.5 text-xs"><Pencil size={14} /> Editar</Link>}
          </div>
        </header>

        {(a.cover_url || a.kind !== "comunicado") && (
          <figure className="press-in-3 mt-5">
            <StoryArt a={a} tall />
            {a.cover_url && a.cover_caption && <figcaption className="news-caption mt-1.5">{a.cover_caption}</figcaption>}
          </figure>
        )}

        <div className={`mt-2 ${sheet ? "lg:grid lg:grid-cols-[1fr_17rem] lg:gap-8" : ""}`}>
          <div>
            {player && (
              <p className="news-meta mt-5">
                {player.name}{player.number != null ? ` · Dorsal ${player.number}` : ""} · {player.position} · {player.stats.apps} partidos, {player.stats.goals} goles esta temporada
              </p>
            )}
            <ArticleBody body={a.body} drop={!official} />
            {official && (
              <div className="mt-8 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/escudo.png" alt="" width={42} height={50} className="w-10" />
                <p className="news-body text-sm italic">{a.byline}<br />Rayo Vallecañas</p>
              </div>
            )}
          </div>
          {sheet && <div className="mt-6 lg:sticky lg:top-6 lg:self-start"><MatchSheetBox sheet={sheet} /></div>}
        </div>
      </article>

      {others.length > 0 && (
        <section aria-label="Más de La Voz del Rayo" className="news-rule mx-auto mt-10 max-w-3xl pt-3">
          <p className="news-kicker text-xs">Más de {NEWS_NAME}</p>
          <div className="divide-y divide-[#141210]/10">{others.map((x) => <StoryLine key={x.id} a={x} />)}</div>
        </section>
      )}
    </div>
  );
}
