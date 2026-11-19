"use client";
import { useActionState, useState, useTransition } from "react";
import { Lock, Pencil, Send, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { MAX_BODY, MAX_MESSAGES, QUESTIONS, type CapsuleMessage, type CapsulePrediction } from "@/lib/capsule";
import { deleteCapsule, deleteMessage, saveCapsule, saveMessage, savePredictions, type CapsuleFormState } from "@/app/(app)/partidos/capsula/actions";

export type Pick = { id: string; name: string; number: number | null; me?: boolean };

/** Mis predicciones: una por pregunta (jugador o número). Se pueden cambiar hasta que se cierra. */
export function PredictionsForm({ season, players, mine }: { season: string; players: Pick[]; mine: CapsulePrediction[] }) {
  const [state, action] = useActionState<CapsuleFormState, FormData>(savePredictions, undefined);
  // Campos controlados: React vacía los no controlados al enviar el formulario y parecería que no se ha guardado
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(QUESTIONS.map((q) => {
      const p = mine.find((x) => x.question === q.key);
      return [q.key, p ? String(p.player_id ?? p.number ?? "") : ""];
    })));
  const field = (k: string) => ({ value: vals[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setVals((v) => ({ ...v, [k]: e.target.value })) });
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="season" value={season} />
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {QUESTIONS.map((q, i) => (
          <li key={q.key} className="anim-rise rounded-2xl bg-white p-3 ring-1 ring-black/10" style={{ animationDelay: `${i * 40}ms` }}>
            <label htmlFor={`q-${q.key}`} className="flex items-start gap-2 text-sm font-bold leading-snug">
              <span aria-hidden className="text-lg leading-none">{q.emoji}</span> {q.ask}
            </label>
            {q.kind === "player" ? (
              <select id={`q-${q.key}`} name={q.key} {...field(q.key)} className="input mt-2">
                <option value="">— Sin decidir —</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.number != null ? `${p.number} · ` : ""}{p.name}{p.me ? " (tú)" : ""}</option>)}
              </select>
            ) : (
              <input id={`q-${q.key}`} name={q.key} {...field(q.key)} inputMode="numeric" pattern="\d{1,3}"
                placeholder={q.key === "position" ? "Ej.: 3" : "Ej.: 40"} className="input mt-2 sport text-lg font-black tabular-nums" />
            )}
          </li>
        ))}
      </ol>
      <FormMessage state={state} />
      <SubmitButton pendingText="Guardando bajo llave…"><Lock size={17} /> Guardar mis predicciones</SubmitButton>
      <p className="text-center text-xs text-negro/60">3 puntos por acertar y 1 si te quedas cerca en los números. Nadie las ve hasta la gala.</p>
    </form>
  );
}

/** Escribir un mensaje (al equipo, a un compañero o a ti mismo) o cambiar uno que ya escribiste. */
export function MessageForm({ season, players, msg, onDone, count }: { season: string; players: Pick[]; msg?: CapsuleMessage; onDone?: () => void; count?: number }) {
  const [text, setText] = useState(msg?.body ?? "");
  const [state, action] = useActionState<CapsuleFormState, FormData>(async (prev, fd) => {
    const r = await saveMessage(prev, fd);
    if (r?.ok) { setText(""); onDone?.(); }
    return r;
  }, undefined);
  const full = !msg && (count ?? 0) >= MAX_MESSAGES;
  if (full) return <p className="rounded-xl bg-black/5 px-3 py-2 text-sm text-negro/70">Ya has guardado {MAX_MESSAGES} mensajes: es el máximo. Puedes cambiar o borrar alguno.</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="season" value={season} />
      {msg && <input type="hidden" name="id" value={msg.id} />}
      <label className="label" htmlFor={`to-${msg?.id ?? "new"}`}>Para</label>
      <select id={`to-${msg?.id ?? "new"}`} name="to" defaultValue={msg?.to_player_id ?? "team"} className="input">
        <option value="team">Todo el equipo</option>
        {players.map((p) => <option key={p.id} value={p.id}>{p.me ? `Para mí (${p.name}) del futuro` : p.name}</option>)}
      </select>
      <label className="label" htmlFor={`body-${msg?.id ?? "new"}`}>Mensaje</label>
      <textarea id={`body-${msg?.id ?? "new"}`} name="body" required rows={4} maxLength={MAX_BODY} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="«Este año subimos. Y si no, que alguien me recuerde que lo dije en noviembre…»" className="input resize-y leading-relaxed" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-negro/55">{text.length}/{MAX_BODY}</span>
        <div className="flex gap-2">
          {onDone && msg && <button type="button" onClick={onDone} className="rounded-xl px-3 py-2 text-sm font-bold text-negro/65 hover:text-negro">Cancelar</button>}
          <SubmitButton className="btn-primary" pendingText="Guardando…"><Send size={16} /> {msg ? "Guardar cambios" : "Meter en la cápsula"}</SubmitButton>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** Uno de mis mensajes, que solo veo yo hasta la gala. */
export function MyMessage({ season, players, msg, to, editable }: { season: string; players: Pick[]; msg: CapsuleMessage; to: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (editing) return <li className="rounded-2xl bg-white p-3 ring-1 ring-dorado"><MessageForm season={season} players={players} msg={msg} onDone={() => setEditing(false)} /></li>;
  return (
    <li className="capsule-note relative rounded-2xl p-3 pr-20 ring-1 ring-black/10">
      <p className="text-[11px] font-black uppercase tracking-wider text-rojo">Para {to}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
      {editable && (
        <div className="absolute right-2 top-2 flex gap-1">
          <button type="button" onClick={() => setEditing(true)} aria-label="Cambiar el mensaje" className="rounded-lg p-2 text-negro/55 hover:bg-black/5 hover:text-negro"><Pencil size={15} /></button>
          <button type="button" disabled={pending} aria-label="Borrar el mensaje" className="rounded-lg p-2 text-negro/55 hover:bg-rojo/10 hover:text-rojo"
            onClick={() => { if (window.confirm("¿Borrar este mensaje de la cápsula?")) start(async () => { const r = await deleteMessage(msg.id); setErr(r?.error ?? null); }); }}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-1 text-xs font-bold text-rojo">{err}</p>}
    </li>
  );
}

/** Crear la cápsula de una temporada o cambiar sus fechas (gestores). */
export function CapsuleSettingsForm({ season, seasons, writeUntil, opensOn, finalPosition, isNew, open, empty }: {
  season: string; seasons?: string[]; writeUntil: string; opensOn: string; finalPosition?: number | null; isNew: boolean; open?: boolean; empty?: boolean;
}) {
  const [state, action] = useActionState<CapsuleFormState, FormData>(saveCapsule, undefined);
  const [pending, start] = useTransition();
  const [delErr, setDelErr] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-3">
      {isNew && <input type="hidden" name="new" value="1" />}
      {isNew && seasons && seasons.length > 1 ? (
        <div>
          <label className="label" htmlFor="cap-season">Temporada</label>
          <select id="cap-season" name="season" defaultValue={season} className="input">
            {seasons.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      ) : <input type="hidden" name="season" value={season} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cap-until">Se puede escribir hasta el</label>
          <input id="cap-until" type="date" name="write_until" required defaultValue={writeUntil} disabled={open} className="input" />
          <p className="mt-1 text-[11px] text-negro/55">Hasta las 23:59 de ese día. Lo normal: el primer partido.</p>
        </div>
        <div>
          <label className="label" htmlFor="cap-opens">Día de la gala</label>
          <input id="cap-opens" type="date" name="opens_on" required defaultValue={opensOn} disabled={open} className="input" />
          <p className="mt-1 text-[11px] text-negro/55">Nunca se abre antes de que acabe el último partido de la temporada que haya en el calendario.</p>
        </div>
      </div>
      {open && (
        <>
          <input type="hidden" name="write_until" value={writeUntil} />
          <input type="hidden" name="opens_on" value={opensOn} />
          <div>
            <label className="label" htmlFor="cap-pos">Puesto final en la liga</label>
            <input id="cap-pos" name="final_position" inputMode="numeric" pattern="\d{1,2}" defaultValue={finalPosition ?? ""} placeholder="Se apunta solo con la clasificación" className="input max-w-40" />
            <p className="mt-1 text-[11px] text-negro/55">Para corregir el puesto con el que se comparan las predicciones.</p>
          </div>
        </>
      )}
      {isNew && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-rojo" /> Avisar al equipo para que escriba
        </label>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton className="btn-primary" pendingText={isNew ? "Creando…" : "Guardando…"}>{isNew ? <><Lock size={16} /> Crear la cápsula</> : "Guardar"}</SubmitButton>
        {!isNew && empty && (
          <button type="button" disabled={pending} className="rounded-xl px-3 py-2 text-sm font-bold text-rojo hover:bg-rojo/10"
            onClick={() => { if (window.confirm("¿Borrar la cápsula? Aún no hay nada escrito.")) start(async () => { const r = await deleteCapsule(season); setDelErr(r?.error ?? null); }); }}>
            Borrar la cápsula
          </button>
        )}
      </div>
      {delErr && <p role="alert" className="text-sm font-bold text-rojo">{delErr}</p>}
    </form>
  );
}
