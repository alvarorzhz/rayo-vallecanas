import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchCallups, fetchMatch, fetchReportPool } from "@/lib/match-queries";
import { fetchLiveEvents, fetchLiveView } from "@/lib/live-queries";
import { fetchDiscipline } from "@/lib/discipline-queries";
import { CLUB_NAME, todayMadrid } from "@/lib/matches";
import { lineOf, shirtName } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { LiveConsole, type LivePlayer } from "@/components/matches/live-console";

export const metadata = { title: "Acta en vivo" };

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const m = await fetchMatch(supabase, id);
  if (!m) notFound();
  if (m.status === "played") redirect(`/partidos/${m.id}/acta`);
  if (m.status !== "scheduled") redirect(`/partidos/${m.id}`);
  const [callups, pool, view, events, disc] = await Promise.all([
    fetchCallups(supabase, m), fetchReportPool(supabase, m.season), fetchLiveView(supabase, m), fetchLiveEvents(supabase, m.id),
    m.competition === "league" ? fetchDiscipline(supabase) : Promise.resolve(null),
  ]);
  // 4.21.0 · Para la tarjeta que sale al apuntarla: amarillas de hoy y cómo va su ciclo de liga
  const yellowsToday = new Map<string, number>();
  for (const e of events) if (e.kind === "yellow" && e.player_id) yellowsToday.set(e.player_id, (yellowsToday.get(e.player_id) ?? 0) + 1);
  // Primero los convocados que no han dicho «No voy» (o están en la alineación); el resto de la plantilla, por si alguien entra a última hora
  const going = new Set(callups.filter((c) => c.reply !== "no" || c.slot != null).map((c) => c.player_id));
  const players: LivePlayer[] = pool.map((p) => ({
    id: p.player_id, name: shirtName(p.player), number: p.number, gk: lineOf(p.position) === "GK", going: going.has(p.player_id),
    inCycle: disc ? disc.byPlayer.get(p.player_id)?.inCycle ?? 0 : null, yellowsToday: yellowsToday.get(p.player_id) ?? 0,
  }));
  return (
    <>
      <PageHeader title="Acta en vivo" subtitle={<>{m.is_home ? `${CLUB_NAME} vs ${m.rival.name}` : `${m.rival.name} vs ${CLUB_NAME}`}{m.match_date !== todayMadrid() ? " · ojo: el partido no es hoy" : ""}</>}
        back={{ href: `/partidos/${m.id}`, label: "Partido" }} />
      <LiveConsole matchId={m.id} home={m.is_home} rival={m.rival} view={view} players={players} />
    </>
  );
}
