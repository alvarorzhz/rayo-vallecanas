import { KIND_LABEL, NEWS_NAME, plainText, readingMinutes } from "@/lib/news";
import type { ArticleCard, MatchSheet } from "@/lib/news-queries";
import { ArticleBody } from "@/components/news/article-body";
import { MatchSheetBox } from "@/components/news/match-sheet";
import { Masthead } from "@/components/news/masthead";
import { StoryArt, StoryLine, kickerOf } from "@/components/news/story";

const longDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export type PlayerLine = { name: string; number: number | null; position: string; apps: number; goals: number };

/** La noticia entera, igual dentro de la app que en su página pública. */
export function ArticleView({ a, sheet, player, others, home, hrefOf, actions, notice, sheetLink = true }: {
  a: ArticleCard;
  sheet: MatchSheet | null;
  player: PlayerLine | null;
  others: ArticleCard[];
  home: string;
  hrefOf: (a: ArticleCard) => string;
  actions?: React.ReactNode;
  notice?: React.ReactNode;
  sheetLink?: boolean;
}) {
  const official = a.kind === "comunicado";
  return (
    <div className="paper -mx-4 -mt-5 px-4 pb-8 pt-5 sm:mx-0 sm:mt-0 sm:rounded-sm sm:px-8 sm:pt-6 sm:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] lg:px-10">
      <Masthead size="sm" href={home} />
      {notice}

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
            {actions}
          </div>
        </header>

        {(a.cover_url || !official) && (
          <figure className="press-in-3 mt-5">
            <StoryArt a={a} tall />
            {a.cover_url && a.cover_caption && <figcaption className="news-caption mt-1.5">{a.cover_caption}</figcaption>}
          </figure>
        )}

        <div className={`mt-2 ${sheet ? "lg:grid lg:grid-cols-[1fr_17rem] lg:gap-8" : ""}`}>
          <div>
            {player && (
              <p className="news-meta mt-5">
                {player.name}{player.number != null ? ` · Dorsal ${player.number}` : ""} · {player.position} · {player.apps} partidos, {player.goals} goles esta temporada
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
          {sheet && <div className="mt-6 lg:sticky lg:top-6 lg:self-start"><MatchSheetBox sheet={sheet} link={sheetLink} /></div>}
        </div>
      </article>

      {others.length > 0 && (
        <section aria-label={`Más de ${NEWS_NAME}`} className="news-rule mx-auto mt-10 max-w-3xl pt-3">
          <p className="news-kicker text-xs">Más de {NEWS_NAME}</p>
          <div className="divide-y divide-[#141210]/10">{others.map((x) => <StoryLine key={x.id} a={x} href={hrefOf(x)} />)}</div>
        </section>
      )}
    </div>
  );
}
