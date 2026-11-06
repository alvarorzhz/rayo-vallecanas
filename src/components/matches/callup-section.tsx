import Link from "next/link";
import { Clock, ClipboardList, Pencil, StickyNote } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { LineupPitch } from "@/components/matches/lineup-pitch";
import { ShareButton } from "@/components/matches/share-button";
import { RemindButton, ReplyBox, ReplyForSelect } from "@/components/matches/callup-forms";
import { remindPending, replyCallup, setReplyFor } from "@/app/(app)/partidos/callup-actions";
import { REPLY_LABEL, REPLY_TONE, callupShareText, tally, type CallupRow, type Reply } from "@/lib/callups";
import { hhmm, type MatchRow } from "@/lib/matches";
import { lineOf, shirtName } from "@/lib/squad";

const GROUPS: { key: Reply; title: string }[] = [
  { key: "yes", title: "Van" },
  { key: "maybe", title: "Duda" },
  { key: "pending", title: "Sin responder" },
  { key: "no", title: "No van" },
];

export const callupOpen = (m: MatchRow) => !!m.callup_published_at && (m.status === "scheduled" || m.status === "postponed");

/** Quedada en una línea. */
export function MeetLine({ m, className = "" }: { m: MatchRow; className?: string }) {
  if (!m.meet_time && !m.meet_place) return null;
  return (
    <p className={`flex items-start gap-2 text-sm ${className}`}>
      <Clock size={16} className="mt-0.5 shrink-0 text-dorado" />
      <span>Quedamos{m.meet_time && <> a las <b>{hhmm(m.meet_time)}</b></>}{m.meet_place && <> en <b>{m.meet_place}</b></>}</span>
    </p>
  );
}

/** Tarjeta negra «Estás convocado» con los botones de respuesta. */
export function MyCallupCard({ m, mine, meet = true }: { m: MatchRow; mine: CallupRow; meet?: boolean }) {
  return (
    <div className="franja relative overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg">
      <div className="relative space-y-3">
        <div className="flex items-center gap-3">
          <Jersey number={mine.number} goalkeeper={lineOf(mine.position) === "GK"} size={40} />
          <div className="min-w-0">
            <p className="sport text-xl font-black leading-tight text-dorado">¡Estás convocado!</p>
            <p className="text-sm text-white/80">{mine.reply === "pending" ? "¿Vas al partido? Contesta para que contemos contigo." : `Tu respuesta: ${REPLY_LABEL[mine.reply].toLowerCase()}. Puedes cambiarla.`}</p>
          </div>
        </div>
        {meet && <MeetLine m={m} className="text-white/90" />}
        <ReplyBox dark action={replyCallup.bind(null, m.id)} reply={mine.reply} note={mine.reply_note} />
      </div>
    </div>
  );
}

export function CallupSection({ m, rows, myPlayerId, canEdit, url }: { m: MatchRow; rows: CallupRow[]; myPlayerId: string | null; canEdit: boolean; url: string }) {
  const published = !!m.callup_published_at;
  if (!published && !canEdit) return null;
  const closed = m.status === "played" || m.status === "cancelled";
  if (!rows.length && closed) return null;
  const open = callupOpen(m);
  const mine = rows.find((r) => r.player_id === myPlayerId);
  const t = tally(rows);
  const placed = rows.filter((r) => r.slot != null);
  const bench = rows.filter((r) => r.slot == null);

  return (
    <section id="convocatoria" className="card scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><ClipboardList size={18} className="text-rojo" /> Convocatoria
          {!published && rows.length > 0 && <span className="badge bg-amber-100 text-amber-800">Borrador</span>}
        </h2>
        <div className="flex flex-wrap gap-2">
          {published && <ShareButton text={callupShareText(m, rows, url)} label="WhatsApp" />}
          {canEdit && !closed && (
            <Link href={`/partidos/${m.id}/convocatoria`} prefetch className={rows.length ? "btn-ghost px-3 py-1.5 text-sm" : "btn-primary"}>
              {rows.length ? <><Pencil size={15} /> Editar</> : <><ClipboardList size={16} /> Preparar convocatoria</>}
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-negro/65">Todavía no hay convocatoria. Elige a los jugadores, la hora de quedada y, si quieres, la alineación.</p>
      ) : (
        <>
          {!published && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Solo la veis los gestores. Cuando esté lista, publícala desde «Editar» y les llegará el aviso.</p>}
          <MeetLine m={m} />
          {m.callup_notes && <p className="flex gap-2 rounded-xl bg-gris p-3 text-sm"><StickyNote size={16} className="mt-0.5 shrink-0 text-dorado" /> <span className="whitespace-pre-line">{m.callup_notes}</span></p>}
          {mine && open && <MyCallupCard m={m} mine={mine} meet={false} />}

          <div className="flex flex-wrap gap-2 text-sm" aria-label="Respuestas">
            <span className="badge bg-negro text-white">{t.total} convocados</span>
            <span className={`badge ${REPLY_TONE.yes}`}>✅ {t.yes} {t.yes === 1 ? "va" : "van"}</span>
            {t.maybe > 0 && <span className={`badge ${REPLY_TONE.maybe}`}>🤔 {t.maybe} en duda</span>}
            {t.no > 0 && <span className={`badge ${REPLY_TONE.no}`}>❌ {t.no} no {t.no === 1 ? "va" : "van"}</span>}
            {t.pending > 0 && <span className={`badge ${REPLY_TONE.pending}`}>{t.pending} sin responder</span>}
          </div>

          {placed.length > 0 && (
            <div className="space-y-2">
              <LineupPitch formation={m.formation} at={(n) => { const r = rows.find((x) => x.slot === n); return r ? { player: r.player, number: r.number } : null; }} />
              {bench.length > 0 && (
                <p className="text-center text-sm text-negro/70"><b className="text-negro">Banquillo:</b> {bench.map((r) => shirtName(r.player)).join(", ")}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map((g) => {
              const list = rows.filter((r) => r.reply === g.key);
              if (!list.length) return null;
              return (
                <div key={g.key}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">{g.title} · {list.length}</h3>
                  <ul className="space-y-1.5">
                    {list.map((r) => (
                      <li key={r.id} className={`flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 ${r.player_id === myPlayerId ? "ring-2 ring-dorado" : ""}`}>
                        <Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={26} dim={r.reply === "no"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{shirtName(r.player)} <span className="font-normal text-negro/65">· {r.position}</span></span>
                          {r.reply_note && <span className="block truncate text-xs italic text-negro/70">«{r.reply_note}»</span>}
                        </span>
                        {canEdit && open ? (
                          <ReplyForSelect action={setReplyFor.bind(null, m.id, r.player_id)} reply={r.reply} name={shirtName(r.player)} />
                        ) : (
                          <span className={`badge shrink-0 ${REPLY_TONE[r.reply]}`}>{REPLY_LABEL[r.reply]}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {canEdit && open && <RemindButton action={remindPending.bind(null, m.id)} count={t.pending} />}
        </>
      )}
    </section>
  );
}
