import Link from "next/link";
import type { Metadata } from "next";
import { PenLine, Sparkles } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { KINDS, NEWS_NAME, kindOf } from "@/lib/news";
import { countPublished, fetchDrafts, fetchPendingChronicle, fetchPublished } from "@/lib/news-queries";
import { Masthead } from "@/components/news/masthead";
import { LeadStory, StoryCard, StoryLine, kickerOf, newsDate } from "@/components/news/story";

export const metadata: Metadata = { title: NEWS_NAME };

export default async function NewsFront({ searchParams }: { searchParams: Promise<{ tipo?: string; eliminada?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("news");
  const supabase = await createClient();
  const kind = kindOf(sp.tipo);
  const writer = s.can("news", "create") || s.can("news", "update");
  const [items, total, drafts, pending] = await Promise.all([
    fetchPublished(supabase, { kind, limit: 40 }),
    countPublished(supabase),
    writer ? fetchDrafts(supabase) : Promise.resolve([]),
    writer && s.can("news", "create") ? fetchPendingChronicle(supabase) : Promise.resolve(null),
  ]);
  const [lead, ...rest] = items;
  const cards = rest.slice(0, 4);
  const lines = rest.slice(4);

  return (
    <div className="paper -mx-4 -mt-5 px-4 pb-8 pt-5 sm:mx-0 sm:mt-0 sm:rounded-sm sm:px-8 sm:pt-6 sm:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] lg:px-10">
      <Masthead count={total} />

      {/* Secciones del periódico */}
      <nav aria-label="Secciones" className="news-rule-thin mt-3 flex gap-1 overflow-x-auto pb-1 pt-2 text-[13px] font-bold">
        <Link href="/la-voz" prefetch className={`shrink-0 rounded-full px-3 py-1 ${!kind ? "bg-[#141210] text-white" : "hover:bg-black/5"}`}>Portada</Link>
        {KINDS.map((k) => (
          <Link key={k.key} href={`/la-voz?tipo=${k.key}`} prefetch className={`shrink-0 rounded-full px-3 py-1 ${kind === k.key ? "bg-[#141210] text-white" : "hover:bg-black/5"}`}>{k.plural}</Link>
        ))}
      </nav>

      {sp.eliminada && <p className="mt-3 rounded-lg bg-black/5 px-3 py-2 text-sm font-medium">Pieza eliminada.</p>}

      {/* La redacción: escribir y borradores */}
      {writer && (
        <section aria-label="Redacción" className="mt-4 rounded-sm border border-dashed border-[#141210]/30 bg-white/50 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="news-kicker mr-auto text-xs">Redacción</p>
            {pending && (
              <Link href={`/la-voz/nueva?tipo=cronica&partido=${pending.id}`} prefetch className="btn-dark !py-2 text-sm">
                <Sparkles size={16} /> Crónica vs {pending.rival}
              </Link>
            )}
            {s.can("news", "create") && <Link href="/la-voz/nueva" prefetch className="btn-primary !py-2 text-sm"><PenLine size={16} /> Escribir</Link>}
          </div>
          {drafts.length > 0 && (
            <ul className="mt-2 divide-y divide-[#141210]/10">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/la-voz/${d.id}/editar`} prefetch className="flex items-baseline gap-2 py-2 hover:text-rojo">
                    <span className="badge shrink-0 bg-amber-100 text-amber-800">Borrador</span>
                    <span className="news-head min-w-0 flex-1 truncate font-bold">{d.title}</span>
                    <span className="news-meta shrink-0">{kickerOf(d)} · {newsDate(d.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!lead ? (
        <div className="py-16 text-center">
          <p className="news-head text-2xl font-black">{kind ? "Todavía no hay piezas de esta sección." : "La rotativa está a punto de arrancar."}</p>
          <p className="news-body mt-2 text-[#141210]/70">{writer ? "Escribe la primera pieza y saldrá aquí, en portada." : "Muy pronto, las crónicas de cada partido."}</p>
        </div>
      ) : (
        <>
          <div className="news-rule mt-5 pt-5"><LeadStory a={lead} /></div>
          {cards.length > 0 && (
            <div className="news-rule mt-6 grid gap-6 pt-5 sm:grid-cols-2 lg:grid-cols-4 news-cols">
              {cards.map((a) => <StoryCard key={a.id} a={a} />)}
            </div>
          )}
          {lines.length > 0 && (
            <section aria-label="Más noticias" className="news-rule mt-6 pt-3">
              <p className="news-kicker text-xs">Hemeroteca</p>
              <div className="grid divide-y divide-[#141210]/10 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0 lg:grid-cols-3">
                {lines.map((a) => <StoryLine key={a.id} a={a} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
