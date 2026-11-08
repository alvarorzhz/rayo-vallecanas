"use client";
import { useActionState, useState, useTransition } from "react";
import { BellRing, Lock, Square, Trash2 } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { DURATIONS } from "@/lib/polls";

type S = { error?: string; ok?: string } | undefined;

/** Botones grandes «Sí» / «No». Se puede cambiar el voto mientras esté abierta. */
export function VoteButtons({ action, mine, dark = false }: { action: (vote: boolean) => Promise<S>; mine: boolean | null; dark?: boolean }) {
  const [choice, setChoice] = useState<boolean | null>(mine);
  const [state, setState] = useState<S>();
  const [pending, start] = useTransition();
  function send(v: boolean) {
    const before = choice;
    setChoice(v);
    start(async () => {
      const r = await action(v);
      if (r?.error) setChoice(before);
      setState(r);
    });
  }
  const opts = [
    { v: true, label: "Sí", emoji: "✅", on: "bg-emerald-500 text-white ring-emerald-300" },
    { v: false, label: "No", emoji: "❌", on: "bg-rojo text-white ring-red-300" },
  ];
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Tu voto" className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const on = choice === o.v;
          return (
            <button key={o.label} type="button" disabled={pending} aria-pressed={on} onClick={() => send(o.v)}
              className={`sport flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-2xl font-black ring-2 transition active:scale-95 ${
                on ? `${o.on} scale-[1.03] shadow-lg` : dark ? "bg-white/10 text-white ring-white/20 hover:bg-white/20" : "bg-white text-negro ring-black/10 hover:ring-negro/30"
              }`}>
              <span aria-hidden className="text-xl leading-none">{o.emoji}</span>{o.label}
            </button>
          );
        })}
      </div>
      {pending ? (
        <p className={`text-sm ${dark ? "text-white/80" : "text-negro/65"}`}>Guardando…</p>
      ) : state?.error ? (
        <FormMessage state={state} />
      ) : choice !== null ? (
        <p className={`text-sm ${dark ? "text-white/80" : "text-negro/65"}`}>Has votado <b>{choice ? "SÍ" : "NO"}</b>. Puedes cambiarlo hasta el cierre.</p>
      ) : null}
    </div>
  );
}

/** Recordar, cerrar ya y borrar (quien gestiona los avisos). */
export function PollAdminActions({ remind, close, remove, open, missing }: {
  remind: () => Promise<S>; close: () => Promise<S>; remove: () => Promise<S>; open: boolean; missing: number;
}) {
  const [state, setState] = useState<S>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<S>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    start(async () => setState(await fn()));
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {open && (
          <button type="button" disabled={pending || missing === 0} className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run(remind)}>
            <BellRing size={15} className="text-rojo" /> Recordar a los que faltan{missing ? ` (${missing})` : ""}
          </button>
        )}
        {open && (
          <button type="button" disabled={pending} className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run(close, "¿Cerrar la votación ahora? Ya no se podrá votar.")}>
            <Square size={14} /> Cerrar ya
          </button>
        )}
        <button type="button" disabled={pending} className="btn-ghost px-3 py-1.5 text-sm text-rojo" onClick={() => run(remove, "¿Borrar la votación y todos sus votos? No se puede deshacer.")}>
          <Trash2 size={15} /> Borrar
        </button>
      </div>
      {pending ? <p className="text-sm text-negro/65">Un momento…</p> : <FormMessage state={state} />}
    </div>
  );
}

/** Formulario para lanzar una votación sí/no. */
export function PollForm({ action }: { action: (s: S, f: FormData) => Promise<S> }) {
  const [state, formAction] = useActionState(action, undefined);
  const [duration, setDuration] = useState("24");
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="poll-question">Pregunta (se contesta con sí o no)</label>
        <input id="poll-question" name="question" required minLength={3} maxLength={140} className="input" placeholder="Ej.: ¿Hacemos cena de Navidad el viernes 19?" />
      </div>
      <div>
        <label className="label" htmlFor="poll-details">Detalles <span className="font-normal text-negro/60">(opcional)</span></label>
        <textarea id="poll-details" name="details" maxLength={500} rows={2} className="input" placeholder="Ej.: Sería en el Bar El Barrio a las 21:30, unos 20 € por cabeza." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="poll-audience">¿Quién vota?</label>
          <select id="poll-audience" name="audience" className="input" defaultValue="all">
            <option value="all">Todo el equipo</option>
            <option value="player">Solo los jugadores</option>
            <option value="admin">Solo los gestores</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="poll-duration">¿Cuánto dura?</label>
          <select id="poll-duration" name="duration" className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            <option value="custom">Hasta un día y hora…</option>
          </select>
        </div>
      </div>
      {duration === "custom" && (
        <div>
          <label className="label" htmlFor="poll-until">Se cierra el</label>
          <input id="poll-until" name="until" type="datetime-local" required className="input" />
        </div>
      )}
      <label className="flex items-start gap-3 rounded-xl bg-gris p-3 text-sm">
        <input type="checkbox" name="anonymous" className="mt-0.5 size-4 accent-rojo" />
        <span><b className="flex items-center gap-1"><Lock size={14} /> Voto secreto</b>
          <span className="text-negro/65">Nadie ve quién ha votado qué, ni los gestores: solo el recuento. Si no lo marcas, se ve el voto de cada uno.</span></span>
      </label>
      <label className="flex items-start gap-3 rounded-xl bg-gris p-3 text-sm">
        <input type="checkbox" name="notify" defaultChecked className="mt-0.5 size-4 accent-rojo" />
        <span><b>Avisar al móvil</b> <span className="text-negro/65">con los botones «Sí» y «No» para votar desde el propio aviso.</span></span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Lanzando…">Lanzar votación</SubmitButton>
    </form>
  );
}
