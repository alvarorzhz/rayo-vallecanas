import { ClipboardList, History, StickyNote, UserPlus } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { LineupPitch } from "@/components/matches/lineup-pitch";
import { MeetLine } from "@/components/matches/callup-section";
import {
  ATTENDANCE_LABEL, ATTENDANCE_TONE, REPLY_LABEL, REPLY_TONE, callupVsReport, tally,
  type CallupRow, type Reply,
} from "@/lib/callups";
import { fecha } from "@/lib/format";
import type { MatchRow } from "@/lib/matches";
import type { ReportView } from "@/lib/reports";
import { lineOf, shirtName } from "@/lib/squad";

const ORDER: Reply[] = ["yes", "maybe", "no", "pending"];
const EMOJI: Record<Reply, string> = { yes: "✅", maybe: "🤔", no: "❌", pending: "⏳" };

/**
 * Historial de la convocatoria de un partido ya jugado o suspendido:
 * a quién se convocó, qué contestó cada uno y cuándo, y (si hay acta) quién jugó al final.
 */
export function CallupHistory({ m, rows, report, myPlayerId }: { m: MatchRow; rows: CallupRow[]; report: ReportView | null; myPlayerId: string | null }) {
  if (!rows.length) return null;
  const published = !!m.callup_published_at;
  const t = tally(rows);
  const hasReport = m.status === "played" && !!m.report_saved_at && !!report;
  const cross = callupVsReport(rows, hasReport ? report.appearances : null);
  const list = [...rows].sort((a, b) => ORDER.indexOf(a.reply) - ORDER.indexOf(b.reply));
  const placed = rows.some((r) => r.slot != null);
  const bench = rows.filter((r) => r.slot == null);
  const answered = rows.length - t.pending;

  return (
    <section id="convocatoria" className="card scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2">
          <ClipboardList size={18} className="text-rojo" /> Convocatoria
          <span className="badge bg-dorado/20 text-negro"><History size={12} className="mr-1 inline" />Historial</span>
        </h2>
        <p className="text-xs text-negro/65">
          {published ? <>Publicada el {fecha(m.callup_published_at, true)}</> : "No se llegó a publicar"}
          {m.status === "cancelled" && " · Partido suspendido"}
        </p>
      </div>

      <MeetLine m={m} />
      {m.callup_notes && <p className="flex gap-2 rounded-xl bg-gris p-3 text-sm"><StickyNote size={16} className="mt-0.5 shrink-0 text-dorado" /> <span className="whitespace-pre-line">{m.callup_notes}</span></p>}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Convocados" value={t.total} dark />
        <Stat label="Contestaron" value={answered} hint={t.total ? `${Math.round((answered / t.total) * 100)}%` : undefined} />
        <Stat label="Dijeron «Voy»" value={t.yes} hint={[t.maybe && `${t.maybe} en duda`, t.no && `${t.no} no`].filter(Boolean).join(" · ") || undefined} />
        {hasReport
          ? <Stat label="Jugaron" value={cross.playedCalled ?? 0} hint={cross.saidYes ? `${cross.keptWord} de ${cross.saidYes} que dijeron «Voy»` : undefined} gold />
          : <Stat label="Sin responder" value={t.pending} />}
      </div>
      {m.status === "played" && !hasReport && (
        <p className="text-xs text-negro/65">Cuando se rellene el acta verás aquí quién jugó de verdad.</p>
      )}

      {placed && (
        <details className="group rounded-xl bg-gris p-3">
          <summary className="cursor-pointer text-sm font-bold">Alineación prevista {m.formation ? `(${m.formation})` : ""}</summary>
          <div className="mx-auto mt-3 max-w-sm space-y-2">
            <LineupPitch formation={m.formation} at={(n) => { const r = rows.find((x) => x.slot === n); return r ? { player: r.player, number: r.number } : null; }} />
            {bench.length > 0 && <p className="text-center text-sm text-negro/70"><b className="text-negro">Banquillo:</b> {bench.map((r) => shirtName(r.player)).join(", ")}</p>}
          </div>
        </details>
      )}

      {/* Uno a uno */}
      <ul className="space-y-1.5" aria-label="Respuestas de los convocados">
        {list.map((r) => {
          const att = cross.attendance(r.player_id);
          const byOther = !!r.replied_by && r.replied_by !== r.player.user_id;
          return (
            <li key={r.id} className={`flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 ${r.player_id === myPlayerId ? "ring-2 ring-dorado" : ""}`}>
              <Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={26} dim={att === "absent" || (att === null && r.reply === "no")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{shirtName(r.player)} <span className="font-normal text-negro/65">· {r.position}</span></span>
                <span className="block text-xs text-negro/65">
                  {r.replied_at ? <>Contestó el {fecha(r.replied_at, true)}{byOther && " · lo apuntó un gestor"}</> : "No llegó a contestar"}
                </span>
                {r.reply_note && <span className="block truncate text-xs italic text-negro/70">«{r.reply_note}»</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                <span className={`badge ${REPLY_TONE[r.reply]}`}><span aria-hidden>{EMOJI[r.reply]}</span> {REPLY_LABEL[r.reply]}</span>
                {att && <span className={`badge ${ATTENDANCE_TONE[att]}`}>{ATTENDANCE_LABEL[att]}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {cross.extras.length > 0 && hasReport && (
        <div className="rounded-xl border border-dashed border-black/15 p-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-negro/65"><UserPlus size={14} /> Jugaron sin estar convocados · {cross.extras.length}</h3>
          <p className="text-sm">{cross.extras.map((a) => shirtName(a.player)).join(", ")}</p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint, dark, gold }: { label: string; value: number; hint?: string; dark?: boolean; gold?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${dark ? "bg-negro text-white" : gold ? "bg-dorado/20" : "bg-gris"}`}>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${dark ? "text-white/70" : "text-negro/65"}`}>{label}</div>
      <div className="sport text-3xl font-black leading-none">{value}</div>
      {hint && <div className={`mt-1 text-xs ${dark ? "text-white/70" : "text-negro/65"}`}>{hint}</div>}
    </div>
  );
}
