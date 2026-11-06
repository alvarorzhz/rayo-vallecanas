import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch, fetchRivals } from "@/lib/match-queries";
import { PageHeader } from "@/components/ui";
import { MatchForm } from "@/components/matches/match-forms";
import { updateMatch } from "../../actions";

export const metadata = { title: "Editar partido" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const [m, rivals] = await Promise.all([fetchMatch(supabase, id), fetchRivals(supabase)]);
  if (!m) notFound();
  return (
    <>
      <PageHeader title="Editar partido" subtitle={`Contra ${m.rival.name}`} back={{ href: `/partidos/${m.id}`, label: "Partido" }} />
      <MatchForm action={updateMatch.bind(null, m.id)} rivals={rivals} match={m} />
    </>
  );
}
