import type { Metadata } from "next";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { kindOf, NEWS_NAME } from "@/lib/news";
import { fetchMatchOptions, fetchPlayerOptions, fetchSponsorOptions } from "@/lib/news-queries";
import { PageHeader } from "@/components/ui";
import { NewsEditor } from "@/components/news/editor";
import { geminiConfigured } from "@/lib/gemini";
import { draftWithAi, promptFor, saveArticle, suggestQuestions } from "../actions";

// La IA puede tardar: hasta 2 minutos para «Redactar borrador»
export const maxDuration = 120;
export const metadata: Metadata = { title: `Escribir · ${NEWS_NAME}` };

export default async function NewArticle({ searchParams }: { searchParams: Promise<{ tipo?: string; partido?: string; jugador?: string }> }) {
  const sp = await searchParams;
  await requirePerm("news", "create");
  const supabase = await createClient();
  const [matches, players, sponsors] = await Promise.all([fetchMatchOptions(supabase), fetchPlayerOptions(supabase), fetchSponsorOptions(supabase)]);
  return (
    <>
      <PageHeader title="Escribir" subtitle={`Una pieza nueva para ${NEWS_NAME}`} back={{ href: "/la-voz", label: NEWS_NAME }} />
      <NewsEditor action={saveArticle.bind(null, null)} promptFor={promptFor} draftWithAi={draftWithAi} suggestQuestions={suggestQuestions} aiReady={geminiConfigured()} article={null} matches={matches} players={players} sponsors={sponsors} canPublish
        init={{ kind: kindOf(sp.tipo), matchId: sp.partido ?? null, playerId: sp.jugador ?? null }} />
    </>
  );
}
