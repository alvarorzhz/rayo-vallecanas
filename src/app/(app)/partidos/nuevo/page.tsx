import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchRivals } from "@/lib/match-queries";
import { todayMadrid } from "@/lib/matches";
import { PageHeader } from "@/components/ui";
import { MatchForm } from "@/components/matches/match-forms";
import { createMatch } from "../actions";

export const metadata = { title: "Nuevo partido" };

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "create");
  const supabase = await createClient();
  const rivals = await fetchRivals(supabase);
  return (
    <>
      <PageHeader title="Nuevo partido" subtitle="Añádelo al calendario de la temporada" back={{ href: "/partidos", label: "Partidos" }} />
      {sp.ok && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">¡Partido añadido! Puedes meter el siguiente.</p>}
      <MatchForm key={sp.ok ?? "new"} action={createMatch} rivals={rivals} defaultDate={todayMadrid()} />
    </>
  );
}
