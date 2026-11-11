import Link from "next/link";
import { Crest } from "@/components/matches/crest";
import { KIND_LABEL, readingMinutes, teaser, plainText } from "@/lib/news";
import { CLUB_SHORT, rivalShort } from "@/lib/matches";
import { shirtName } from "@/lib/squad";
import type { ArticleCard } from "@/lib/news-queries";

const when = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
export const newsDate = (s: string | null) => (s ? when.format(new Date(s)).replace(".", "") : "");

/** Antetítulo: el que se escribió o, si no, el tipo de pieza. */
export const kickerOf = (a: ArticleCard) => a.kicker?.trim() || KIND_LABEL[a.kind];

/** Imagen de la pieza: la foto de portada o, si no hay, una portada hecha con los datos (marcador, jugador o sello). */
export function StoryArt({ a, tall = false }: { a: ArticleCard; tall?: boolean }) {
  const ratio = tall ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[16/10]";
  if (a.cover_url)
    return (
      <div className={`news-photo ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.cover_url} alt={a.cover_caption || a.title} className="h-full w-full object-cover" />
      </div>
    );
  const m = a.match;
  if (m && (a.kind === "cronica" || a.kind === "previa")) {
    const played = m.status === "played" && m.goals_for != null;
    const left = m.is_home ? { us: true } : { rival: m.rival };
    const right = m.is_home ? { rival: m.rival } : { us: true };
    const score = played ? (m.is_home ? `${m.goals_for}-${m.goals_against}` : `${m.goals_against}-${m.goals_for}`) : "vs";
    return (
      <div className={`franja relative flex items-center justify-center gap-3 overflow-hidden bg-negro text-white sm:gap-6 ${ratio}`}>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(213,175,50,0.18),transparent_65%)]" />
        <div className="relative flex flex-col items-center gap-1.5">
          <Crest {...left} size={tall ? 72 : 44} />
          <span className="sport text-xs font-bold tracking-widest text-white/70">{"us" in left ? CLUB_SHORT : rivalShort(m.rival)}</span>
        </div>
        <span className={`sport relative whitespace-nowrap font-black tabular-nums ${tall ? "text-6xl sm:text-7xl" : "text-4xl"} ${played ? "text-white" : "text-dorado"}`}>{score}</span>
        <div className="relative flex flex-col items-center gap-1.5">
          <Crest {...right} size={tall ? 72 : 44} />
          <span className="sport text-xs font-bold tracking-widest text-white/70">{"us" in right ? CLUB_SHORT : rivalShort(m.rival)}</span>
        </div>
      </div>
    );
  }
  if (a.kind === "promocion" && a.sponsor)
    return (
      <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#f3e3a4] via-dorado to-[#a8841c] ${ratio}`}>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_55%)]" />
        {a.sponsor.logo_url ? (
          <span className={`relative grid place-items-center rounded-2xl bg-white p-3 shadow-xl ${tall ? "h-36 w-36 sm:h-44 sm:w-44" : "h-20 w-20"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.sponsor.logo_url} alt={a.sponsor.name} className="max-h-full max-w-full object-contain" />
          </span>
        ) : (
          <span className={`news-head relative px-4 text-center font-black text-negro ${tall ? "text-4xl" : "text-xl"}`}>{a.sponsor.name}</span>
        )}
        <span className="news-seal promo absolute bottom-3 right-3 rounded-md bg-white/70 px-2 py-0.5 text-xs">Promoción</span>
      </div>
    );
  if (a.kind === "entrevista" && a.player?.photo_url)
    return (
      <div className={`news-photo ${ratio} bg-negro`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.player.photo_url} alt={shirtName(a.player)} className="h-full w-full object-cover object-top" />
      </div>
    );
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-[#efe8d6] ${ratio}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/escudo.png" alt="" width={84} height={100} className={`${tall ? "w-20 sm:w-24" : "w-14"} opacity-90 drop-shadow-lg`} />
      {a.kind === "comunicado" && <span className="news-seal absolute bottom-3 right-3 rounded-md px-2 py-0.5 text-xs">Oficial</span>}
      {a.kind === "entrevista" && a.player && <span className="sport absolute bottom-3 left-3 text-lg font-black text-negro/80">{shirtName(a.player)}</span>}
    </div>
  );
}

function Meta({ a, read = false }: { a: ArticleCard; read?: boolean }) {
  return (
    <p className="news-meta mt-2">
      {a.byline} · {newsDate(a.published_at ?? a.updated_at)}{read ? ` · ${readingMinutes(a.summary, plainText(a.body))} min` : ""}
    </p>
  );
}

/** La noticia grande de la portada. */
export function LeadStory({ a, href = `/la-voz/${a.id}` }: { a: ArticleCard; href?: string }) {
  return (
    <Link href={href} prefetch className="group block">
      <article className="grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:gap-6">
        <div className="press-in-2 transition duration-300 group-hover:brightness-105"><StoryArt a={a} tall /></div>
        <div className="press-in-3">
          <p className="news-kicker text-sm">{kickerOf(a)}</p>
          <h2 className="news-head mt-1 text-[2rem] font-black leading-[1.02] group-hover:underline group-hover:decoration-rojo group-hover:decoration-2 group-hover:underline-offset-4 sm:text-5xl">{a.title}</h2>
          {(a.summary || a.body) && <p className="news-body mt-3 text-lg leading-snug text-[#141210]/80">{teaser(a, 220)}</p>}
          <Meta a={a} read />
        </div>
      </article>
    </Link>
  );
}

/** Pieza mediana (con foto). */
export function StoryCard({ a, href = `/la-voz/${a.id}` }: { a: ArticleCard; href?: string }) {
  return (
    <Link href={href} prefetch className="group block">
      <article>
        <StoryArt a={a} />
        <p className="news-kicker mt-3 text-xs">{kickerOf(a)}</p>
        <h3 className="news-head mt-0.5 text-xl font-extrabold leading-tight group-hover:underline group-hover:decoration-rojo group-hover:underline-offset-4">{a.title}</h3>
        {(a.summary || a.body) && <p className="news-body mt-1.5 text-[15px] leading-snug text-[#141210]/75">{teaser(a, 130)}</p>}
        <Meta a={a} />
      </article>
    </Link>
  );
}

/** Pieza pequeña, solo texto (la columna de «Más noticias»). */
export function StoryLine({ a, href = `/la-voz/${a.id}` }: { a: ArticleCard; href?: string }) {
  return (
    <Link href={href} prefetch className="group block py-3">
      <p className="news-kicker text-[11px]">{kickerOf(a)}</p>
      <h3 className="news-head text-lg font-bold leading-tight group-hover:text-rojo">{a.title}</h3>
      <Meta a={a} />
    </Link>
  );
}

/** Pieza pequeña con foto a la izquierda (el «Más de La Voz del Rayo» del final de cada noticia). */
export function StoryThumb({ a, href = `/la-voz/${a.id}` }: { a: ArticleCard; href?: string }) {
  return (
    <Link href={href} prefetch className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 py-3 sm:grid-cols-[9rem_1fr]">
      <div className="overflow-hidden transition duration-300 group-hover:brightness-105"><StoryArt a={a} /></div>
      <div className="min-w-0">
        <p className="news-kicker text-[11px]">{kickerOf(a)}</p>
        <h3 className="news-head text-[17px] font-bold leading-tight group-hover:text-rojo">{a.title}</h3>
        <Meta a={a} />
      </div>
    </Link>
  );
}
