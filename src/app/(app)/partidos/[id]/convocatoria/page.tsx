import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchCallups, fetchMatch } from "@/lib/match-queries";
import { fetchRoster } from "@/lib/squad-queries";
import { hhmm, longDay } from "@/lib/matches";
import { PageHeader } from "@/components/ui";
import { CallupEditor, DeleteCallupButton } from "@/components/matches/callup-forms";
import { deleteCallup, saveCallup } from "../../callup-actions";

export const metadata = { title: "Convocatoria" };

export default async function CallupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const m = await fetchMatch(supabase, id);
  if (!m) notFound();
  if (m.status === "played" || m.status === "cancelled") redirect(`/partidos/${m.id}`);
  const [roster, callups] = await Promise.all([fetchRoster(supabase, m.season), fetchCallups(supabase, m)]);
  const called = new Set(callups.map((c) => c.player_id));
  const pool = roster.filter((r) => r.status !== "left" || called.has(r.player_id));
  return (
    <>
      <PageHeader
        title={m.callup_published_at ? "Editar convocatoria" : "Preparar convocatoria"}
        subtitle={<><span className="inline-block first-letter:uppercase">{longDay(m.match_date)}</span>{m.kickoff ? ` · ${hhmm(m.kickoff)}` : ""} · {m.is_home ? "En casa" : "Fuera"} contra {m.rival.name}</>}
        back={{ href: `/partidos/${m.id}`, label: "Partido" }}
      />
      <CallupEditor action={saveCallup.bind(null, m.id)} match={m} roster={pool} initial={callups.map((c) => ({ player_id: c.player_id, slot: c.slot }))} />
      {callups.length > 0 && <div className="mt-6"><DeleteCallupButton action={deleteCallup.bind(null, m.id)} /></div>}
    </>
  );
}
