import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchCallups, fetchMatch, fetchReport } from "@/lib/match-queries";
import { CLUB_NAME, longDay } from "@/lib/matches";
import { emptyApp, type DraftApp, type ReportDraft } from "@/lib/reports";
import { PageHeader } from "@/components/ui";
import { DeleteReportButton, ReportEditor } from "@/components/matches/report-editor";
import { deleteReport, leaguePrefill, saveReport } from "../../report-actions";
import { fetchLiveEvents } from "@/lib/live-queries";
import { draftFromLive } from "@/lib/live";

export const metadata = { title: "Acta del partido" };
export const maxDuration = 30;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const m = await fetchMatch(supabase, id);
  if (!m) notFound();
  if (m.status !== "played") redirect(`/partidos/${m.id}`);
  const [report, callups, live] = await Promise.all([fetchReport(supabase, m), fetchCallups(supabase, m), m.report_saved_at ? Promise.resolve([]) : fetchLiveEvents(supabase, m.id)]);

  // Acta guardada o, si aún no hay, lo que se sabe por la convocatoria
  let initial: ReportDraft;
  if (m.report_saved_at) {
    initial = {
      apps: Object.fromEntries(report.appearances.map((a) => [a.player_id, { started: a.started, goalkeeper: a.goalkeeper, conceded: a.conceded, yellows: a.yellows, red: a.red } satisfies DraftApp])),
      goals: report.goals.map((g) => ({ scorer: g.own_goal ? "own" : g.scorer_id ?? "", assist: g.assist_id ?? "" })),
    };
  } else {
    const going = callups.filter((c) => c.reply === "yes" || c.slot != null);
    initial = {
      apps: Object.fromEntries(going.filter((c) => report.pool.some((p) => p.player_id === c.player_id)).map((c) => [c.player_id, {
        ...emptyApp(), started: c.slot != null, goalkeeper: c.slot === 1, conceded: c.slot === 1 ? m.goals_against ?? 0 : 0,
      }])),
      goals: [],
    };
    // Si se llevó el acta en vivo, sale ya con las tarjetas y los goles apuntados desde la banda
    if (live.length) initial = draftFromLive(live, initial.apps, new Set(report.pool.map((p) => p.player_id)), m.goals_against ?? 0);
  }
  const score = m.is_home ? `${CLUB_NAME} ${m.goals_for}-${m.goals_against} ${m.rival.name}` : `${m.rival.name} ${m.goals_against}-${m.goals_for} ${CLUB_NAME}`;
  return (
    <>
      <PageHeader
        title={m.report_saved_at ? "Editar acta" : "Rellenar acta"}
        subtitle={<>{score} · <span className="inline-block first-letter:uppercase">{longDay(m.match_date)}</span></>}
        back={{ href: `/partidos/${m.id}`, label: "Partido" }}
      />
      {live.length > 0 && (
        <p className="mb-4 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          📋 Rellenada con el acta en vivo: revisa quién jugó y de titular, y guárdala para abrir la votación del MVP.
        </p>
      )}
      <ReportEditor action={saveReport.bind(null, m.id)} prefill={m.ext_id ? leaguePrefill.bind(null, m.id) : null} match={m} pool={report.pool} initial={initial} />
      {m.report_saved_at && <div className="mt-6"><DeleteReportButton action={deleteReport.bind(null, m.id)} /></div>}
    </>
  );
}
