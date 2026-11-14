"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Bell, BellRing, Megaphone, Trash2 } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { Jersey } from "@/components/squad/jersey";
import { LineupPitch } from "@/components/matches/lineup-pitch";
import { LINES, STATUS_LABEL, lineOf, shirtName, type RosterEntry } from "@/lib/squad";
import { FORMATIONS, DEFAULT_FORMATION, REPLIES, REPLY_LABEL, slotsOf, type Reply } from "@/lib/callups";
import { hhmm, type MatchRow } from "@/lib/matches";
import type { CallupState } from "@/app/(app)/partidos/callup-actions";
import { CYCLE, type Discipline } from "@/lib/discipline";

type A = (s: CallupState, f: FormData) => Promise<CallupState>;

/** Etiqueta del ciclo de amarillas junto al jugador: solo si está a una o le toca sanción. */
function CardChip({ d }: { d?: Discipline }) {
  if (!d || d.status === "ok") return null;
  return d.status === "banned"
    ? <span title={d.reason ?? ""} className="badge shrink-0 bg-rojo text-white">⛔ Sanción</span>
    : <span title={d.reason ?? ""} className="badge shrink-0 bg-amber-100 text-amber-900"><span aria-hidden className="mr-1 inline-block h-3 w-2 rounded-[2px] bg-amber-400 align-[-1px]" />{d.inCycle}/{CYCLE}</span>;
}

/** Aviso arriba de la convocatoria: quién podría estar sancionado y quién está a una amarilla. */
function CardsAlert({ roster, cards }: { roster: RosterEntry[]; cards: Record<string, Discipline> }) {
  const banned = roster.filter((r) => cards[r.player_id]?.status === "banned");
  const warn = roster.filter((r) => cards[r.player_id]?.status === "warn");
  if (!banned.length && !warn.length) return null;
  return (
    <div role="note" className="space-y-1.5 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
      {banned.map((r) => (
        <p key={r.player_id}><b>⛔ {shirtName(r.player)}</b>: {cards[r.player_id].reason?.toLowerCase()}. Podría tener que cumplir sanción este partido: compruébalo en la federación.</p>
      ))}
      {warn.length > 0 && (
        <p><b>🟨 A una amarilla de la sanción:</b> {warn.map((r) => shirtName(r.player)).join(", ")}. Si ven otra, se pierden el partido siguiente.</p>
      )}
    </div>
  );
}

/** Hora de quedada propuesta: 45 minutos antes del partido. */
function meetDefault(kickoff: string | null) {
  if (!kickoff) return "";
  const [h, m] = kickoff.split(":").map(Number);
  const t = h * 60 + m - 45;
  if (t < 0) return "";
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Preparar la convocatoria: convocados, quedada, sistema y alineación. */
export function CallupEditor({ action, match, roster, initial, cards = {} }: {
  action: A;
  match: MatchRow;
  roster: RosterEntry[];
  initial: { player_id: string; slot: number | null }[];
  /** Ciclo de amarillas de la liga (solo en partidos de liga). */
  cards?: Record<string, Discipline>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, start] = useTransition();
  const isNew = initial.length === 0;
  const [chosen, setChosen] = useState<Set<string>>(() =>
    new Set(isNew ? roster.filter((r) => r.status === "active").map((r) => r.player_id) : initial.map((c) => c.player_id)));
  const [formation, setFormation] = useState(match.formation ?? DEFAULT_FORMATION);
  const [slots, setSlots] = useState<Record<number, string>>(() =>
    Object.fromEntries(initial.filter((c) => c.slot != null).map((c) => [c.slot!, c.player_id])));
  const published = !!match.callup_published_at;

  const byId = useMemo(() => new Map(roster.map((r) => [r.player_id, r])), [roster]);
  const spots = slotsOf(formation);
  const picked = roster.filter((r) => chosen.has(r.player_id));
  const used = new Set(Object.entries(slots).filter(([k, v]) => v && chosen.has(v) && Number(k) <= spots.length).map(([, v]) => v));

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    start(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Convocados <span className="sport ml-1 rounded-md bg-negro px-2 py-0.5 text-base text-white tabular-nums">{chosen.size}</span></h2>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setChosen(new Set(roster.filter((r) => r.status === "active").map((r) => r.player_id)))}>Todos los disponibles</button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setChosen(new Set())}>Ninguno</button>
            </div>
          </div>
          {roster.length === 0 && <p className="text-sm text-negro/65">No hay jugadores en la plantilla de esta temporada.</p>}
          <CardsAlert roster={roster} cards={cards} />
          {LINES.map((l) => {
            const rows = roster.filter((r) => lineOf(r.position) === l.key);
            if (!rows.length) return null;
            return (
              <fieldset key={l.key}>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">{l.plural}</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {rows.map((r) => {
                    const on = chosen.has(r.player_id);
                    return (
                      <li key={r.player_id}>
                        <label className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2 pr-3 ring-1 transition ${on ? "bg-white ring-2 ring-rojo shadow-sm" : "bg-gris ring-black/5 opacity-75 hover:opacity-100"}`}>
                          <input type="checkbox" name="player" value={r.player_id} checked={on} onChange={() => toggle(r.player_id)} className="h-5 w-5 shrink-0 accent-[var(--color-rojo)]" />
                          <Jersey number={r.number} goalkeeper={l.key === "GK"} size={30} dim={r.status !== "active"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{shirtName(r.player)}</span>
                            <span className="block text-xs text-negro/65">{r.position}{r.status !== "active" ? ` · ${STATUS_LABEL[r.status]}` : ""}</span>
                          </span>
                          <CardChip d={cards[r.player_id]} />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </section>

        <section className="card space-y-4">
          <h2>Quedada</h2>
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div><label className="label" htmlFor="meet_time">Hora</label>
              <input id="meet_time" name="meet_time" type="time" step={300} className="input" defaultValue={hhmm(match.meet_time) ?? (isNew ? meetDefault(match.kickoff) : "")} /></div>
            <div><label className="label" htmlFor="meet_place">Sitio</label>
              <input id="meet_place" name="meet_place" maxLength={120} className="input" defaultValue={match.meet_place ?? ""} placeholder={match.venue ? `Ej.: en la puerta de ${match.venue}` : "Ej.: en la puerta del campo"} /></div>
          </div>
          <div><label className="label" htmlFor="callup_notes">Notas para los convocados</label>
            <textarea id="callup_notes" name="callup_notes" rows={3} maxLength={1000} className="input" defaultValue={match.callup_notes ?? ""} placeholder="Ej.: equipación negra, traed las dos camisetas" /></div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card space-y-4">
          <h2>Alineación <span className="text-sm font-normal text-negro/65">(opcional)</span></h2>
          <div role="radiogroup" aria-label="Sistema" className="flex flex-wrap gap-2">
            {FORMATIONS.map((f) => (
              <label key={f} className={`sport cursor-pointer rounded-lg px-3 py-1.5 text-base font-black ring-1 ${formation === f ? "bg-rojo text-white ring-rojo" : "bg-white ring-black/15"}`}>
                <input type="radio" name="formation" value={f} checked={formation === f} onChange={() => setFormation(f)} className="sr-only" />{f}
              </label>
            ))}
          </div>
          <LineupPitch compact formation={formation} at={(n) => {
            const r = slots[n] && chosen.has(slots[n]) ? byId.get(slots[n]) : null;
            return r ? { player: r.player, number: r.number } : null;
          }} />
          <div className="grid gap-2">
            {spots.map((sp) => {
              const val = slots[sp.slot] && chosen.has(slots[sp.slot]) ? slots[sp.slot] : "";
              const options = [...picked].sort((a, b) => Number(lineOf(b.position) === sp.line) - Number(lineOf(a.position) === sp.line));
              return (
                <div key={sp.slot} className="flex items-center gap-2">
                  <label htmlFor={`slot_${sp.slot}`} className="sport w-12 shrink-0 rounded bg-negro px-1 py-1 text-center text-xs font-black text-white">{sp.label}</label>
                  <select id={`slot_${sp.slot}`} name={`slot_${sp.slot}`} value={val} className="input py-2"
                    onChange={(e) => setSlots((p) => ({ ...p, [sp.slot]: e.target.value }))}>
                    <option value="">— Sin asignar —</option>
                    {options.map((r) => (
                      <option key={r.player_id} value={r.player_id} disabled={used.has(r.player_id) && val !== r.player_id}>
                        {r.number != null ? `${r.number} · ` : ""}{shirtName(r.player)} ({r.position})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-negro/65">Los convocados que no pongas en el campo salen en el banquillo.</p>
        </section>

        <section className="card space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-[var(--color-rojo)]" />
            <Bell size={15} className="text-rojo" /> {published ? "Avisar a los convocados nuevos" : "Avisar a los convocados en el móvil"}
          </label>
          <FormMessage state={state} />
          {published ? (
            <button type="submit" name="intent" value="publish" disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Guardar cambios"}</button>
          ) : (
            <>
              <button type="submit" name="intent" value="publish" disabled={pending} className="btn-primary w-full"><Megaphone size={18} /> {pending ? "Publicando…" : "Publicar convocatoria"}</button>
              <button type="submit" name="intent" value="draft" disabled={pending} className="btn-ghost w-full">Guardar borrador</button>
              <p className="text-xs text-negro/65">El borrador solo lo veis los gestores.</p>
            </>
          )}
        </section>
      </aside>
    </form>
  );
}

/** «Voy / Duda / No voy» del propio jugador. */
export function ReplyBox({ action, reply, note, dark = false }: { action: A; reply: Reply; note: string | null; dark?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  const [choice, setChoice] = useState<Reply>(reply);
  const [pending, start] = useTransition();
  const [text, setText] = useState(note ?? "");
  function send(r: Reply) {
    setChoice(r);
    const fd = new FormData();
    fd.set("reply", r);
    fd.set("note", text);
    start(() => formAction(fd));
  }
  return (
    <div className="space-y-3">
      <div role="group" aria-label="¿Vas al partido?" className="grid grid-cols-3 gap-2">
        {REPLIES.map((r) => {
          const on = choice === r.key;
          return (
            <button key={r.key} type="button" disabled={pending} aria-pressed={on} onClick={() => send(r.key)}
              className={`sport flex flex-col items-center gap-0.5 rounded-2xl px-2 py-3 text-lg font-black ring-2 transition active:scale-95 ${on ? `${r.on} scale-[1.03] shadow-lg` : dark ? "bg-white/10 text-white ring-white/20 hover:bg-white/20" : "bg-white text-negro ring-black/10 hover:ring-negro/30"}`}>
              <span aria-hidden className="text-2xl leading-none">{r.emoji}</span>{r.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <label htmlFor="reply-note" className="sr-only">Comentario</label>
        <input id="reply-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={140}
          placeholder="¿Algo que contar? (llego tarde, voy en coche…)"
          className={`input py-2 text-sm ${dark ? "bg-white/10 text-white placeholder:text-white/60" : ""}`} />
        {choice !== "pending" && text !== (note ?? "") && (
          <button type="button" disabled={pending} onClick={() => send(choice)} className={dark ? "btn-primary px-3 text-sm" : "btn-dark px-3 text-sm"}>Enviar</button>
        )}
      </div>
      {pending ? <p className={`text-sm ${dark ? "text-white/80" : "text-negro/65"}`}>Guardando…</p> : <FormMessage state={state} />}
    </div>
  );
}

/** El gestor apunta la respuesta de otro jugador. */
export function ReplyForSelect({ action, reply, name }: { action: (r: Reply) => Promise<CallupState>; reply: Reply; name: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState<Reply>(reply);
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex items-center gap-1">
      <label className="sr-only" htmlFor={`r-${name}`}>Respuesta de {name}</label>
      <select id={`r-${name}`} value={value} disabled={pending} aria-invalid={!!error} title={error}
        className="rounded-lg border-0 bg-gris py-1 pl-2 pr-7 text-xs font-bold ring-1 ring-black/10"
        onChange={(e) => {
          const r = e.target.value as Reply;
          setValue(r);
          start(async () => { const res = await action(r); setError(res?.error); if (res?.error) setValue(reply); });
        }}>
        {(["pending", "yes", "maybe", "no"] as Reply[]).map((r) => <option key={r} value={r}>{REPLY_LABEL[r]}</option>)}
      </select>
    </span>
  );
}

/** Botón de recordatorio manual. */
export function RemindButton({ action, count }: { action: () => Promise<CallupState>; count: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<CallupState>();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending || count === 0} className="btn-ghost w-full" onClick={() => start(async () => setState(await action()))}>
        <BellRing size={16} className="text-rojo" /> {pending ? "Enviando…" : `Recordar a los que faltan (${count})`}
      </button>
      <FormMessage state={state} />
    </div>
  );
}

export function DeleteCallupButton({ action }: { action: () => Promise<CallupState> }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<CallupState>();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-ghost text-rojo"
        onClick={() => { if (confirm("¿Borrar la convocatoria y las respuestas? No se puede deshacer.")) start(async () => setState(await action())); }}>
        <Trash2 size={16} /> {pending ? "Borrando…" : "Borrar convocatoria"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}
