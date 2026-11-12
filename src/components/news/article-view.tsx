import { ExternalLink, Shirt } from "lucide-react";
import { KIND_LABEL, NEWS_NAME, plainText, readingMinutes, type NewsKind } from "@/lib/news";
import type { ArticleCard, MatchSheet } from "@/lib/news-queries";
import { ArticleBody } from "@/components/news/article-body";
import { MatchSheetBox } from "@/components/news/match-sheet";
import { Masthead } from "@/components/news/masthead";
import { ReadBar } from "@/components/news/read-bar";
import { StoryArt, StoryThumb } from "@/components/news/story";

const longDate = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export type PlayerLine = { name: string; number: number | null; position: string; apps: number; goals: number };

/** El color de cada sección: la etiqueta de arriba lo lleva para que cada tipo de pieza se distinga a simple vista. */
const KIND_TAG: Record<NewsKind, string> = {
  cronica: "bg-rojo text-white",
  previa: "bg-dorado text-negro",
  entrevista: "bg-negro text-white",
  comunicado: "bg-white text-rojo ring-2 ring-rojo",
  promocion: "bg-gradient-to-r from-dorado to-[#ecd37a] text-negro",
};

/** La noticia entera, igual dentro de la app que en su página pública. */
export function ArticleView({ a, sheet, player, others, home, hrefOf, actions, share, notice, sheetLink = true }: {
  a: ArticleCard;
  sheet: MatchSheet | null;
  player: PlayerLine | null;
  others: ArticleCard[];
  home: string;
  hrefOf: (a: ArticleCard) => string;
  actions?: React.ReactNode;
  /** El botón de compartir para la franja del final. */
  share?: React.ReactNode;
  notice?: React.ReactNode;
  sheetLink?: boolean;
}) {
  const official = a.kind === "comunicado";
  const promo = a.kind === "promocion";
  const showArt = a.cover_url || !official;
  // Sin foto, la portada ya es el marcador: en el móvil la ficha va al final para no repetir el resultado
  const sheetFirst = !!a.cover_url;
  return (
    <div className="paper -mx-4 -mt-5 px-4 pb-8 pt-5 sm:mx-0 sm:mt-0 sm:rounded-sm sm:px-8 sm:pt-6 sm:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] lg:px-10">
      <ReadBar target="noticia" />
      <Masthead size="sm" href={home} />
      {notice}

      <article id="noticia" className="mx-auto mt-6 max-w-3xl">
        <header className="press-in-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`sport rounded-sm px-2 py-0.5 text-xs font-black uppercase italic tracking-[0.12em] ${KIND_TAG[a.kind]}`}>{KIND_LABEL[a.kind]}</span>
            {a.kicker && <p className="news-kicker text-sm">{a.kicker}</p>}
            {official && <span className="news-seal ml-auto rounded-md px-2 py-0.5 text-xs">Comunicado oficial</span>}
          </div>
          <h1 className="news-head mt-3 text-[2.2rem] font-black leading-[1.02] text-balance sm:text-5xl">{a.title}</h1>
          {a.summary && <p className="news-body mt-3 border-l-4 border-dorado pl-3 text-xl leading-snug text-[#141210]/80">{a.summary}</p>}
          <div className="news-rule-thin mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
            <p className="news-meta min-w-0 flex-1">
              Por <span className="text-[#141210]">{a.byline}</span> · {a.published_at ? longDate.format(new Date(a.published_at)) : "Sin publicar"} · {readingMinutes(a.summary, plainText(a.body))} min de lectura
            </p>
            {actions}
          </div>
        </header>

        {showArt && (
          <figure className="press-in-3 mt-5">
            <StoryArt a={a} tall />
            {a.cover_url && a.cover_caption && <figcaption className="news-caption mt-1.5">{a.cover_caption}</figcaption>}
          </figure>
        )}

        <div className={`mt-2 ${sheet ? "lg:grid lg:grid-cols-[1fr_17rem] lg:gap-8" : ""}`}>
          {/* En el móvil, con foto de portada la ficha va antes del texto: lo primero que se busca es el resultado */}
          {sheet && sheetFirst && <div className="mt-5 lg:hidden"><MatchSheetBox sheet={sheet} link={sheetLink} /></div>}
          <div>
            {player && <PlayerCard a={a} p={player} />}
            <ArticleBody body={a.body} drop={!official} />
            {official && (
              <div className="mt-8 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/escudo.png" alt="" width={42} height={50} className="w-10" />
                <p className="news-body text-sm italic">{a.byline}<br />Rayo Vallecañas</p>
              </div>
            )}
            {promo && a.sponsor && <SponsorBox s={a.sponsor} />}
            {sheet && !sheetFirst && <div className="mt-8 lg:hidden"><MatchSheetBox sheet={sheet} link={sheetLink} /></div>}
          </div>
          {sheet && <div className="mt-6 hidden lg:sticky lg:top-6 lg:block lg:self-start"><MatchSheetBox sheet={sheet} link={sheetLink} /></div>}
        </div>

        {share && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-negro px-4 py-3 text-white">
            <p className="sport text-lg font-black uppercase italic tracking-wide">¿Te ha gustado? <span className="text-dorado">Compártela</span></p>
            <div className="[&_button]:!bg-white [&_button]:!text-negro">{share}</div>
          </div>
        )}
      </article>

      {others.length > 0 && (
        <section aria-label={`Más de ${NEWS_NAME}`} className="news-rule mx-auto mt-10 max-w-3xl pt-3">
          <p className="news-kicker text-xs">Más de {NEWS_NAME}</p>
          <div className="divide-y divide-[#141210]/10">{others.map((x) => <StoryThumb key={x.id} a={x} href={hrefOf(x)} />)}</div>
        </section>
      )}
    </div>
  );
}

/** El entrevistado, como un cromo pequeño antes de las preguntas. */
function PlayerCard({ a, p }: { a: ArticleCard; p: PlayerLine }) {
  const photo = a.player?.photo_url;
  return (
    <div className="mt-5 flex items-center gap-3 rounded-sm bg-negro p-3 text-white">
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover object-top ring-2 ring-dorado" />
        : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 ring-2 ring-dorado"><Shirt size={24} className="text-dorado" /></span>}
      <div className="min-w-0 flex-1">
        <p className="sport truncate text-2xl font-black leading-none">{p.name}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/60">{p.number != null ? `Dorsal ${p.number} · ` : ""}{p.position}</p>
      </div>
      <div className="flex shrink-0 gap-3 text-center">
        <div><p className="sport text-2xl font-black leading-none text-dorado">{p.apps}</p><p className="text-[10px] font-bold uppercase text-white/60">Partidos</p></div>
        <div><p className="sport text-2xl font-black leading-none text-dorado">{p.goals}</p><p className="text-[10px] font-bold uppercase text-white/60">Goles</p></div>
      </div>
    </div>
  );
}

/** Al final de una promoción: el patrocinador con su logo y su web. */
function SponsorBox({ s }: { s: NonNullable<ArticleCard["sponsor"]> }) {
  return (
    <aside aria-label="Patrocinador" className="mt-8 overflow-hidden rounded-sm ring-1 ring-dorado/60">
      <p className="bg-gradient-to-r from-dorado to-[#ecd37a] px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-negro">
        {s.tier === "main" ? "Patrocinador principal" : "Colaborador"} del Rayo Vallecañas
      </p>
      <div className="flex flex-col items-center gap-3 bg-white/70 p-4 text-center sm:flex-row sm:gap-4 sm:text-left">
        {s.logo_url && (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-white p-2 shadow ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo_url} alt={s.name} className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="news-head text-2xl font-black leading-tight">{s.name}</p>
          <p className="news-body text-sm text-[#141210]/70">Gracias por apoyar al equipo del barrio.</p>
        </div>
        {s.website && (
          <a href={s.website} target="_blank" rel="noopener noreferrer sponsored" className="btn-primary w-full shrink-0 justify-center sm:w-auto">
            Visitar su web <ExternalLink size={16} />
          </a>
        )}
      </div>
    </aside>
  );
}
