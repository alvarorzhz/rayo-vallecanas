import type { Metadata } from "next";
import { NEWS_NAME } from "@/lib/news";
import { loadPublicList } from "@/lib/news-public";
import { Masthead } from "@/components/news/masthead";
import { LeadStory, StoryCard, StoryLine } from "@/components/news/story";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `${NEWS_NAME} · Rayo Vallecañas`,
  description: "Crónicas, previas, entrevistas y comunicados del Rayo Vallecañas, equipo de fútbol 7 de Salamanca.",
  robots: { index: false, follow: false },
};

export default async function PublicNewsFront() {
  const items = await loadPublicList(30);
  const [lead, ...rest] = items;
  const href = (slug: string) => `/noticias/${slug}`;
  return (
    <div className="paper -mx-4 -mt-5 px-4 pb-8 pt-5 sm:mx-0 sm:mt-0 sm:rounded-sm sm:px-8 sm:pt-6 sm:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] lg:px-10">
      <Masthead />
      {!lead ? (
        <p className="news-head py-16 text-center text-2xl font-black">Muy pronto, las primeras noticias.</p>
      ) : (
        <>
          <div className="news-rule mt-5 pt-5"><LeadStory a={lead} href={href(lead.id)} /></div>
          {rest.length > 0 && (
            <div className="news-rule mt-6 grid gap-6 pt-5 sm:grid-cols-2 lg:grid-cols-4 news-cols">
              {rest.slice(0, 4).map((a) => <StoryCard key={a.id} a={a} href={href(a.id)} />)}
            </div>
          )}
          {rest.length > 4 && (
            <section aria-label="Hemeroteca" className="news-rule mt-6 pt-3">
              <p className="news-kicker text-xs">Hemeroteca</p>
              <div className="grid divide-y divide-[#141210]/10 sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0 lg:grid-cols-3">
                {rest.slice(4).map((a) => <StoryLine key={a.id} a={a} href={href(a.id)} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
