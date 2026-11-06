"use client";
import { useActionState, useState, useTransition } from "react";
import { Bell, Trash2 } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Crest } from "@/components/matches/crest";
import { COMPETITIONS, hhmm, CLUB_NAME, type Match, type Rival } from "@/lib/matches";
import type { MatchState } from "@/app/(app)/partidos/actions";

type A = (s: MatchState, f: FormData) => Promise<MatchState>;

function Notify({ label, defaultChecked = true }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name="notify" defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--color-rojo)]" />
      <Bell size={15} className="text-rojo" /> {label}
    </label>
  );
}

/** Alta y edición de un partido. */
export function MatchForm({ action, rivals, match, defaultDate }: { action: A; rivals: Rival[]; match?: Match; defaultDate?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, start] = useTransition();
  const [rivalId, setRivalId] = useState(match?.rival_id ?? (rivals.length ? "" : "new"));
  const [home, setHome] = useState(match?.is_home ?? true);
  const rival = rivals.find((r) => r.id === rivalId);
  // Se envía a mano para que React no vacíe los campos si hay un error
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    start(() => formAction(fd));
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <section className="card space-y-4">
          <h2>Rival</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="rival_id">Equipo rival *</label>
              <select id="rival_id" name="rival_id" value={rivalId} onChange={(e) => setRivalId(e.target.value)} className="input">
                <option value="" disabled>Elige el rival…</option>
                {rivals.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                <option value="new">+ Otro rival nuevo…</option>
              </select>
            </div>
            {rivalId === "new" && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="new_rival">Nombre del rival nuevo *</label>
                <input id="new_rival" name="new_rival" maxLength={60} required className="input" placeholder="Ej.: C.D. San Blas" autoComplete="off" />
                <p className="mt-1 text-xs text-negro/65">Se guarda en la lista de rivales. Su escudo y su campo se ponen en «Rivales».</p>
              </div>
            )}
            <fieldset className="sm:col-span-2">
              <legend className="label">¿Dónde se juega?</legend>
              <input type="hidden" name="is_home" value={home ? "1" : "0"} />
              <div className="grid grid-cols-2 gap-2">
                {[true, false].map((h) => (
                  <button key={String(h)} type="button" aria-pressed={home === h} onClick={() => setHome(h)}
                    className={`sport rounded-xl px-3 py-3 text-lg font-black ring-2 transition ${home === h ? "bg-negro text-white ring-negro" : "bg-white text-negro/60 ring-black/10 hover:ring-negro/40"}`}>
                    {h ? "🏠 En casa" : "🚌 Fuera"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="card space-y-4">
          <h2>Partido</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="match_date">Fecha *</label><input id="match_date" name="match_date" type="date" required defaultValue={match?.match_date ?? defaultDate} className="input" /></div>
            <div><label className="label" htmlFor="kickoff">Hora</label><input id="kickoff" name="kickoff" type="time" step={300} defaultValue={hhmm(match?.kickoff) ?? ""} className="input" /></div>
            <div>
              <label className="label" htmlFor="competition">Competición</label>
              <select id="competition" name="competition" defaultValue={match?.competition ?? "league"} className="input">
                {COMPETITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="round">Jornada o ronda</label><input id="round" name="round" maxLength={40} defaultValue={match?.round ?? ""} placeholder="Ej.: Jornada 5" className="input" /></div>
            <div>
              <label className="label" htmlFor="venue">Campo</label>
              <input id="venue" name="venue" maxLength={120} defaultValue={match?.venue ?? ""} className="input"
                placeholder={!home && rival?.home_venue ? `El suyo: ${rival.home_venue}` : "Ej.: Polideportivo de Vallecas, campo 2"} />
            </div>
            <div>
              <label className="label" htmlFor="maps_url">Enlace de Google Maps</label>
              <input id="maps_url" name="maps_url" type="url" inputMode="url" defaultValue={match?.maps_url ?? ""} placeholder="https://maps.app.goo.gl/…" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="notes">Observaciones</label>
              <textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={match?.notes ?? ""} className="input" placeholder="Equipación, vestuario, árbitro…" />
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="franja relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl">
          <div className="relative flex items-center justify-around gap-2 text-center">
            {(home ? [true, false] : [false, true]).map((us) => (
              <div key={String(us)} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <Crest us={us} rival={us ? null : rival ?? { name: "Rival", short_name: "?", color: "#374151", crest_url: null }} size={52} />
                <span className="sport block w-full truncate text-sm font-black">{us ? CLUB_NAME : rival?.name ?? "Rival"}</span>
              </div>
            ))}
          </div>
          <p className="sport relative mt-2 text-center text-2xl font-black italic text-white/70">VS</p>
        </div>
        <div className="card space-y-3">
          <Notify label={match ? "Avisar al equipo si cambia la fecha, la hora o el campo" : "Avisar al equipo del nuevo partido"} defaultChecked={!match} />
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">{pending ? "Guardando…" : match ? "Guardar cambios" : "Añadir al calendario"}</button>
          {!match && <button type="submit" name="again" value="1" disabled={pending} className="btn-ghost w-full">Guardar y añadir otro</button>}
        </div>
      </aside>
    </form>
  );
}

/** Marcador final. */
export function ResultForm({ action, match, rivalName }: { action: A; match: Match; rivalName: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const us = (
    <div className="flex flex-col items-center gap-1">
      <label htmlFor="goals_for" className="sport max-w-28 truncate text-sm font-black">{CLUB_NAME}</label>
      <input id="goals_for" name="goals_for" type="number" min={0} max={99} inputMode="numeric" required defaultValue={match.goals_for ?? ""}
        className="sport h-20 w-20 rounded-2xl bg-negro text-center text-5xl font-black text-white tabular-nums outline-none ring-2 ring-transparent focus:ring-dorado" />
    </div>
  );
  const them = (
    <div className="flex flex-col items-center gap-1">
      <label htmlFor="goals_against" className="sport max-w-28 truncate text-sm font-black">{rivalName}</label>
      <input id="goals_against" name="goals_against" type="number" min={0} max={99} inputMode="numeric" required defaultValue={match.goals_against ?? ""}
        className="sport h-20 w-20 rounded-2xl bg-negro text-center text-5xl font-black text-white tabular-nums outline-none ring-2 ring-transparent focus:ring-dorado" />
    </div>
  );
  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-end justify-center gap-3">
        {match.is_home ? us : them}
        <span className="sport pb-5 text-4xl font-black text-negro/30">-</span>
        {match.is_home ? them : us}
      </div>
      {match.status !== "played" && <Notify label="Avisar al equipo del resultado" />}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{match.status === "played" ? "Corregir resultado" : "Guardar resultado final"}</SubmitButton>
    </form>
  );
}

/** Aplazar, suspender o poner fecha nueva. */
export function StatusForm({ action, match }: { action: A; match: Match }) {
  const [state, formAction] = useActionState(action, undefined);
  const [mode, setMode] = useState<"" | "postponed" | "cancelled" | "date" | "scheduled">("");
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {match.status !== "postponed" && <button type="button" onClick={() => setMode("postponed")} className={`btn-ghost ${mode === "postponed" ? "ring-2 ring-amber-500" : ""}`}>⏸️ Aplazar</button>}
        <button type="button" onClick={() => setMode("date")} className={`btn-ghost ${mode === "date" ? "ring-2 ring-negro" : ""}`}>📅 {match.status === "postponed" ? "Poner fecha nueva" : "Cambiar fecha"}</button>
        {match.status !== "cancelled" && <button type="button" onClick={() => setMode("cancelled")} className={`btn-ghost ${mode === "cancelled" ? "ring-2 ring-rojo" : ""}`}>⛔ Suspender</button>}
        {match.status !== "scheduled" && <button type="button" onClick={() => setMode("scheduled")} className={`btn-ghost ${mode === "scheduled" ? "ring-2 ring-sky-600" : ""}`}>↩️ Volver a pendiente</button>}
      </div>
      {mode && (
        <div className="anim-rise space-y-3 rounded-2xl bg-gris p-3">
          <input type="hidden" name="status" value={mode === "date" ? "scheduled" : mode} />
          {mode === "date" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="new_date">Nueva fecha</label><input id="new_date" name="new_date" type="date" required defaultValue={match.match_date} className="input" /></div>
              <div><label className="label" htmlFor="new_kickoff">Hora</label><input id="new_kickoff" name="new_kickoff" type="time" step={300} defaultValue={hhmm(match.kickoff) ?? ""} className="input" /></div>
            </div>
          )}
          {(mode === "postponed" || mode === "cancelled") && (
            <div><label className="label" htmlFor="reason">Motivo (sale en el aviso)</label><input id="reason" name="reason" maxLength={140} placeholder="Ej.: campo impracticable por la lluvia" className="input" /></div>
          )}
          {mode === "scheduled" && match.status === "played" && <p className="text-sm text-negro/70">Se quitará el resultado.</p>}
          {mode !== "scheduled" && <Notify label="Avisar al equipo" />}
          <SubmitButton className="btn-dark w-full">Confirmar</SubmitButton>
        </div>
      )}
      <FormMessage state={state} />
    </form>
  );
}

/** Botón de eliminar con confirmación. */
export function DeleteButton({ action, label, confirmText }: { action: () => Promise<MatchState>; label: string; confirmText: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<MatchState>();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-ghost text-rojo"
        onClick={() => { if (confirm(confirmText)) start(async () => setState(await action())); }}>
        <Trash2 size={16} /> {pending ? "Eliminando…" : label}
      </button>
      <FormMessage state={state} />
    </div>
  );
}

/** Alta y edición de un rival. */
export function RivalForm({ action, rival, onDone }: { action: A; rival?: Rival; onDone?: () => void }) {
  const [state, formAction] = useActionState(async (s: MatchState, f: FormData) => {
    const r = await action(s, f);
    if (r?.ok && onDone) onDone();
    return r;
  }, undefined);
  const [color, setColor] = useState(rival?.color ?? "#1D4ED8");
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState(rival?.name ?? "");
  const [short, setShort] = useState(rival?.short_name ?? "");
  return (
    <form action={formAction} className="space-y-4" key={rival?.id ?? "new"}>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-[57px] w-12 object-contain" />
          ) : (
            <Crest rival={{ name: name || "Rival", short_name: short || null, color, crest_url: rival?.crest_url ?? null }} size={48} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`crest-${rival?.id ?? "new"}`}>Escudo (PNG, JPG o WebP, máx. 1 MB)</label>
          <input id={`crest-${rival?.id ?? "new"}`} name="crest" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-negro file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
            onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
          {rival?.crest_url && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="remove_crest" /> Quitar el escudo</label>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_5rem]">
        <div><label className="label" htmlFor={`name-${rival?.id ?? "new"}`}>Nombre *</label><input id={`name-${rival?.id ?? "new"}`} name="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="input" /></div>
        <div><label className="label" htmlFor={`short-${rival?.id ?? "new"}`}>Siglas</label><input id={`short-${rival?.id ?? "new"}`} name="short_name" maxLength={4} value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} placeholder="SBL" className="input uppercase" /></div>
        <div><label className="label" htmlFor={`color-${rival?.id ?? "new"}`}>Color</label><input id={`color-${rival?.id ?? "new"}`} name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="input h-[42px] p-1" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`venue-${rival?.id ?? "new"}`}>Su campo</label><input id={`venue-${rival?.id ?? "new"}`} name="home_venue" maxLength={120} defaultValue={rival?.home_venue ?? ""} className="input" /></div>
        <div><label className="label" htmlFor={`maps-${rival?.id ?? "new"}`}>Enlace de Google Maps</label><input id={`maps-${rival?.id ?? "new"}`} name="home_maps_url" type="url" defaultValue={rival?.home_maps_url ?? ""} placeholder="https://maps.app.goo.gl/…" className="input" /></div>
      </div>
      <div><label className="label" htmlFor={`notes-${rival?.id ?? "new"}`}>Notas</label><input id={`notes-${rival?.id ?? "new"}`} name="notes" maxLength={1000} defaultValue={rival?.notes ?? ""} placeholder="Cómo juegan, vestuarios, aparcamiento…" className="input" /></div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary">{rival ? "Guardar rival" : "Añadir rival"}</SubmitButton>
    </form>
  );
}
