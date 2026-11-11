import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { NEWS_NAME } from "@/lib/news";
import { fetchArticle, fetchInterview, fetchMatchOptions, fetchPlayerOptions, fetchSponsorOptions } from "@/lib/news-queries";
import { PageHeader } from "@/components/ui";
import { NewsEditor } from "@/components/news/editor";
import { geminiConfigured } from "@/lib/gemini";
import { deleteArticle, draftWithAi, promptFor, saveArticle, suggestQuestions, unpublishArticle } from "../../actions";

const INTERVIEW_ERROR: Record<string, string> = {
  jugador: "Ese jugador ya no está en la plantilla.",
  "sin-usuario": "Este jugador aún no tiene usuario en la app: hazle la entrevista a mano.",
  fallo: "El borrador se ha guardado, pero no se pudo mandar la entrevista. Prueba otra vez.",
};

// La IA puede tardar: hasta 2 minutos para «Redactar borrador»
export const maxDuration = 120;
export const metadata: Metadata = { title: `Editar · ${NEWS_NAME}` };

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardada?: string; retirada?: string; enviada?: string; entrevista?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("news");
  const supabase = await createClient();
  const a = await fetchArticle(supabase, id);
  if (!a) notFound();
  const own = a.created_by === s.user.id && s.can("news", "create");
  if (!s.can("news", "update") && !own) redirect(`/la-voz/${id}`);
  const [matches, players, sponsors, interview] = await Promise.all([fetchMatchOptions(supabase), fetchPlayerOptions(supabase), fetchSponsorOptions(supabase), a.kind === "entrevista" ? fetchInterview(supabase, id) : null]);
  const canDelete = s.can("news", "delete") || (own && a.status === "draft");
  return (
    <>
      <PageHeader title={a.status === "draft" ? "Borrador" : "Editar pieza"} subtitle={a.title} back={{ href: a.status === "published" ? `/la-voz/${id}` : "/la-voz", label: a.status === "published" ? "Ver la pieza" : NEWS_NAME }} />
      {sp.guardada && !sp.enviada && <p className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800 ring-1 ring-green-600/15">Borrador guardado. Solo lo ve la redacción.</p>}
      {sp.retirada && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-600/20">Retirada de la portada: vuelve a ser un borrador.</p>}
      <NewsEditor action={saveArticle.bind(null, id)} promptFor={promptFor} draftWithAi={draftWithAi} suggestQuestions={suggestQuestions} aiReady={geminiConfigured()} interview={interview}
        interviewFlash={sp.enviada ? { ok: "Preguntas mandadas. Le ha llegado un aviso al móvil y te avisaremos cuando las entregue." } : sp.entrevista ? { error: INTERVIEW_ERROR[sp.entrevista] ?? INTERVIEW_ERROR.fallo } : undefined}
        article={a} matches={matches} players={players} sponsors={sponsors} canPublish
        unpublish={s.can("news", "update") ? unpublishArticle.bind(null, id) : undefined}
        remove={canDelete ? deleteArticle.bind(null, id) : undefined} />
    </>
  );
}
