import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { NEWS_NAME } from "@/lib/news";
import { fetchInterviewById } from "@/lib/news-queries";
import { shirtName } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { InterviewAnswers } from "@/components/news/interview-answers";
import { answerInterview } from "../../actions";

export const metadata: Metadata = { title: `Tu entrevista · ${NEWS_NAME}` };

/** El jugador contesta las preguntas que le ha mandado la redacción. Solo ve las suyas (la base de datos lo filtra). */
export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const supabase = await createClient();
  const iv = await fetchInterviewById(supabase, id);
  if (!iv) notFound();
  const mine = iv.player.user_id === s.user.id;
  return (
    <>
      <PageHeader title="Tu entrevista" subtitle={`${NEWS_NAME} quiere saber de ti`} back={{ href: "/", label: "Inicio" }} />
      <InterviewAnswers action={answerInterview.bind(null, id)} name={shirtName(iv.player)} photo={iv.player.photo_url}
        questions={iv.questions} status={iv.status} mine={mine} />
    </>
  );
}
