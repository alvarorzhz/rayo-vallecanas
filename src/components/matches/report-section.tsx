import Link from "next/link";
import { ClipboardCheck, Pencil, Star } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { ShareImageButton } from "@/components/matches/share-image";
import { lineOf, shirtName } from "@/lib/squad";
import type { MatchRow } from "@/lib/matches";
import type { ReportView } from "@/lib/reports";

/** Acta en la página del partido. */
export function ReportSection({ m, report, canEdit }: { m: MatchRow; report: ReportView; canEdit: boolean }) {
  if (m.status !== "played") return null;
  if (!m.report_saved_at) {
    if (!canEdit) return null;
    return (
      <section id="acta" className="card scroll-mt-24 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2"><ClipboardCheck size={18} className="text-rojo" /> Acta</h2>
          <p className="text-sm text-negro/65">Apunta quién jugó, los goles, las tarjetas y el MVP: las estadísticas de los cromos salen de aquí.</p>
        </div>
        <Link href={`/partidos/${m.id}/acta`} prefetch className="btn-primary"><ClipboardCheck size={16} /> Rellenar acta</Link>
      </section>
    );
  }
  const starters = report.appearances.filter((a) => a.started);
  const subs = report.appearances.filter((a) => !a.started);
  const cards = report.appearances.filter((a) => a.yellows > 0 || a.red);
  const gks = report.appearances.filter((a) => a.goalkeeper);
  const unnamed = (m.goals_for ?? 0) - report.goals.filter((g) => g.scorer || g.own_goal).length;

  return (
    <section id="acta" className="card scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><ClipboardCheck size={18} className="text-rojo" /> Acta</h2>
        <div className="flex flex-wrap gap-2">
          <ShareImageButton url={`/api/partidos/${m.id}/imagen`} name={`resultado-${m.match_date}.png`} />
          {canEdit && <Link href={`/partidos/${m.id}/acta`} prefetch className="btn-ghost px-3 py-1.5 text-sm"><Pencil size={15} /> Editar</Link>}
        </div>
      </div>

      {report.mvp && (
        <div className="franja relative flex items-center gap-3 overflow-hidden rounded-2xl bg-negro p-3 text-white">
          <span className="relative"><Jersey number={report.mvp.number} goalkeeper={lineOf(report.mvp.position) === "GK"} size={44} /></span>
          <div className="relative min-w-0">
            <p className="sport flex items-center gap-1 text-xs font-black tracking-widest text-dorado"><Star size={13} className="fill-dorado" /> MVP DEL PARTIDO</p>
            <p className="sport truncate text-2xl font-black leading-tight">{shirtName(report.mvp.player)}</p>
          </div>
        </div>
      )}

      {(m.goals_for ?? 0) > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">Goles</h3>
          <ol className="space-y-1.5">
            {report.goals.filter((g) => g.scorer || g.own_goal).map((g, i) => (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                <span aria-hidden>⚽</span>
                <span className="font-bold">{g.own_goal ? "En propia puerta" : shirtName(g.scorer!.player)}</span>
                {g.assist && <span className="text-negro/65">· asist. {shirtName(g.assist.player)}</span>}
                <span className="sr-only">gol {i + 1}</span>
              </li>
            ))}
            {unnamed > 0 && <li className="text-sm text-negro/65">{unnamed} {unnamed === 1 ? "gol" : "goles"} sin autor apuntado</li>}
          </ol>
        </div>
      )}

      {cards.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">Tarjetas</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {cards.map((a) => (
              <span key={a.player_id} className="badge bg-gris text-negro">{"🟨".repeat(a.yellows)}{a.red ? "🟥" : ""} {shirtName(a.player)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[["Titulares", starters], [starters.length ? "Entraron" : "Jugaron", subs]].map(([title, list]) => (list as typeof starters).length > 0 && (
          <div key={title as string}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">{title as string} · {(list as typeof starters).length}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {(list as typeof starters).map((a) => (
                <li key={a.player_id} className="inline-flex items-center gap-1 rounded-lg bg-gris py-0.5 pl-0.5 pr-2 text-sm font-semibold">
                  <Jersey number={a.number} goalkeeper={a.goalkeeper} size={22} /> {shirtName(a.player)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {gks.length > 0 && (
        <p className="text-sm text-negro/70">🧤 {gks.map((a) => `${shirtName(a.player)} encajó ${a.conceded}`).join(" · ")}</p>
      )}
    </section>
  );
}
