import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { NEWS_NAME } from "@/lib/news";
import { fetchArticle, fetchMatchSheet, fetchPlayerFacts, fetchPublished } from "@/lib/news-queries";
import { ArticleView } from "@/components/news/article-view";
import { ShareButton } from "@/components/news/share-button";
import { PublicPanel } from "@/components/news/public-panel";
import { setNewsPublic } from "../actions";

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
  const isSuper = s.profile.role === "superadmin";
  const [sheet, facts, more] = await Promise.all([
    a.match_id && (a.kind === "cronica" || a.kind === "previa") ? fetchMatchSheet(supabase, a.match_id, { standings: a.kind === "previa" }) : Promise.resolve(null),
    a.kind === "entrevista" && a.player_id ? fetchPlayerFacts(supabase, a.player_id) : Promise.resolve(null),
    fetchPublished(supabase, { limit: 4 }),
  ]);
  const player = facts && { name: facts.name, number: facts.number, position: facts.position, apps: facts.stats.apps, goals: facts.stats.goals };

  return (
    <>
      <ArticleView a={a} sheet={sheet} player={player} others={more.filter((x) => x.id !== a.id).slice(0, 3)} home="/la-voz" hrefOf={(x) => `/la-voz/${x.id}`}
        notice={
          <>
            {sp.publicada && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800 ring-1 ring-green-600/15">¡Publicada! Ya está en la portada de {NEWS_NAME}.</p>}
            {a.status === "draft" && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-600/20">Borrador: solo lo ve la redacción.</p>}
          </>
        }
        actions={
          <>
            {a.status === "published" && <ShareButton title={a.title} url={a.is_public && a.public_slug ? `/noticias/${a.public_slug}` : undefined} />}
            {canEdit && <Link href={`/la-voz/${a.id}/editar`} prefetch className="btn-ghost !px-3 !py-1.5 text-xs"><Pencil size={14} /> Editar</Link>}
          </>
        } />
      {/* Solo el superadministrador decide qué se lee fuera de la app */}
      {(isSuper || a.is_public) && a.status === "published" && (
        <PublicPanel title={a.title} slug={a.is_public ? a.public_slug ?? null : null} canToggle={isSuper}
          toggle={isSuper ? setNewsPublic.bind(null, a.id) : undefined} />
      )}
    </>
  );
}
