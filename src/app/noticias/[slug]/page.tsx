import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NEWS_NAME, teaser } from "@/lib/news";
import { loadPublicArticle, loadPublicList } from "@/lib/news-public";
import { ArticleView } from "@/components/news/article-view";
import { ShareButton } from "@/components/news/share-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await loadPublicArticle((await params).slug);
  if (!p) return { title: "Noticia no encontrada", robots: { index: false } };
  const description = teaser(p.card, 200);
  return {
    title: `${p.card.title} · ${NEWS_NAME}`,
    description,
    robots: { index: false, follow: false },
    openGraph: { type: "article", title: p.card.title, description, siteName: `${NEWS_NAME} · Rayo Vallecañas`, publishedTime: p.card.published_at ?? undefined, locale: "es_ES" },
    twitter: { card: "summary_large_image", title: p.card.title, description },
  };
}

export default async function PublicArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, list] = await Promise.all([loadPublicArticle(slug), loadPublicList(4)]);
  if (!p) notFound();
  return (
    <ArticleView a={p.card} sheet={p.sheet} player={p.player} others={list.filter((x) => x.id !== p.card.id).slice(0, 3)}
      home="/noticias" hrefOf={(x) => `/noticias/${x.id}`} sheetLink={false}
      actions={<ShareButton title={p.card.title} />} />
  );
}
