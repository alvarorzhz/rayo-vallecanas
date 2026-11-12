import Link from "next/link";
import { Newspaper, Sparkles } from "lucide-react";
import { NEWS_NAME } from "@/lib/news";
import type { ArticleCard } from "@/lib/news-queries";
import { Masthead, editionStamp } from "@/components/news/masthead";
import { LeadStory, StoryLine, kickerOf, newsDate } from "@/components/news/story";

/** Inicio en modo periódico: la portada de La Voz del Rayo con la noticia destacada. */
export function HomeFront({ lead, others, count }: { lead: ArticleCard; others: ArticleCard[]; count: number }) {
  return (
    <section aria-label={NEWS_NAME} className="paper mb-6 rounded-sm px-4 pb-5 pt-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)] sm:px-6">
      <Masthead count={count} size="sm" href="/la-voz" stamp={editionStamp(lead.published_at)} />
      <div className="news-rule mt-4 pt-4"><LeadStory a={lead} /></div>
      {others.length > 0 && (
        <div className="news-rule mt-5 grid divide-y divide-[#141210]/10 pt-1 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
          {others.map((a) => <StoryLine key={a.id} a={a} />)}
        </div>
      )}
      <Link href="/la-voz" prefetch className="mt-2 inline-block text-sm font-bold text-rojo hover:underline">Leer {NEWS_NAME} →</Link>
    </section>
  );
}

/** Sin noticia destacada: una línea con la última pieza (y la crónica pendiente para la redacción). */
export function HomeLatest({ a, pending }: { a: ArticleCard | null; pending: { id: string; rival: string } | null }) {
  if (!a && !pending) return null;
  return (
    <section aria-label={NEWS_NAME} className="paper mb-6 flex flex-col gap-3 rounded-sm px-4 py-3 shadow-sm ring-1 ring-black/5 sm:flex-row sm:items-center">
      {a ? (
        <Link href={`/la-voz/${a.id}`} prefetch className="group flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#141210] text-white"><Newspaper size={18} /></span>
          <span className="min-w-0">
            <span className="news-kicker block text-[11px]">{NEWS_NAME} · {kickerOf(a)} · {newsDate(a.published_at)}</span>
            <span className="news-head block truncate text-lg font-bold leading-tight group-hover:text-rojo">{a.title}</span>
          </span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#141210] text-white"><Newspaper size={18} /></span>
          <span className="news-head text-lg font-bold">{NEWS_NAME}</span>
        </span>
      )}
      {pending && (
        <Link href={`/la-voz/nueva?tipo=cronica&partido=${pending.id}`} prefetch className="btn-dark shrink-0 !py-2 text-sm">
          <Sparkles size={16} /> Escribir la crónica vs {pending.rival}
        </Link>
      )}
    </section>
  );
}
