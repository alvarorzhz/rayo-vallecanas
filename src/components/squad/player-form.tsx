"use client";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { LINE_TONE, POSITIONS, POSITION_LABEL, STATUSES, lineOf, type Membership, type Player, type PlayerPrivate } from "@/lib/squad";
import type { ActionState } from "@/app/(app)/plantilla/actions";

/** Situación de cada posición en el campo (en %, atacando hacia arriba). */
const SPOTS: Record<string, [number, number]> = {
  POR: [50, 89], LI: [15, 69], DFC: [50, 73], LD: [85, 69], MCD: [50, 58],
  MI: [17, 45], MC: [50, 46], MD: [83, 45], MCO: [50, 33], EI: [17, 19], DC: [50, 13], ED: [83, 19],
};

/** Campo para elegir la posición tocando su sitio. */
export function PositionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-[#1f7a3a] ring-4 ring-negro">
        <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.07)_0_28px,transparent_28px_56px)]" />
        <div aria-hidden className="absolute inset-2 rounded border-2 border-white/50" />
        <div aria-hidden className="absolute inset-x-2 top-1/2 border-t-2 border-white/50" />
        <div aria-hidden className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50" />
        <div aria-hidden className="absolute bottom-2 left-1/2 h-12 w-1/2 -translate-x-1/2 border-2 border-b-0 border-white/50" />
        <div aria-hidden className="absolute left-1/2 top-2 h-12 w-1/2 -translate-x-1/2 border-2 border-t-0 border-white/50" />
        {POSITIONS.map((p) => {
          const [x, y] = SPOTS[p.code];
          const on = value === p.code;
          return (
            <button key={p.code} type="button" onClick={() => onChange(p.code)} title={p.label} aria-pressed={on}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`sport absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-black shadow-lg ring-2 transition ${
                on ? `${LINE_TONE[p.line].chip} scale-125 ring-white` : "bg-white/90 text-negro ring-black/20 hover:scale-110"
              }`}>
              {p.code}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-sm font-semibold">
        {value ? <>{POSITION_LABEL[value]} <span className="text-negro/50">· {{ GK: "portería", DEF: "defensa", MID: "centro del campo", FWD: "ataque" }[lineOf(value)]}</span></> : <span className="text-negro/50">Toca su posición en el campo</span>}
      </p>
    </div>
  );
}

export function PlayerForm({
  action,
  season,
  player,
  member,
  priv,
  usedNumbers,
  canCreate = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  season: string;
  player?: Player;
  member?: Membership | null;
  priv?: PlayerPrivate | null;
  usedNumbers: { number: number; name: string }[];
  canCreate?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [position, setPosition] = useState(member?.position ?? "");
  const [number, setNumber] = useState(member?.number?.toString() ?? "");
  const taken = usedNumbers.find((u) => String(u.number) === number);
  const isNew = !player;

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="season" value={season} />
      <input type="hidden" name="position" value={position} />
      <div className="space-y-6">
        <section className="card space-y-4">
          <h2>Jugador</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="first_name">Nombre *</label><input id="first_name" name="first_name" required maxLength={60} defaultValue={player?.first_name} className="input" autoComplete="off" /></div>
            <div><label className="label" htmlFor="last_name">Apellidos</label><input id="last_name" name="last_name" maxLength={80} defaultValue={player?.last_name} className="input" autoComplete="off" /></div>
            <div>
              <label className="label" htmlFor="nickname">Nombre en la camiseta</label>
              <input id="nickname" name="nickname" maxLength={24} defaultValue={player?.nickname ?? ""} placeholder="Si no, el primer apellido" className="input" />
            </div>
            <div><label className="label" htmlFor="birth_date">Fecha de nacimiento</label><input id="birth_date" name="birth_date" type="date" defaultValue={priv?.birth_date ?? ""} className="input" /></div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2>Temporada {season}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="number">Dorsal</label>
              <input id="number" name="number" type="number" min={1} max={99} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} className="input sport text-2xl font-black" />
              {taken && <p className="mt-1 text-xs font-semibold text-rojo">El {taken.number} ya es de {taken.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="status">Estado</label>
              <select id="status" name="status" defaultValue={member?.status ?? "active"} className="input">
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="armband">Brazalete</label>
              <select id="armband" name="armband" defaultValue={member?.armband ?? ""} className="input">
                <option value="">Ninguno</option>
                <option value="captain">Capitán</option>
                <option value="vice">Segundo capitán</option>
              </select>
            </div>
          </div>
          {usedNumbers.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-negro/50">Dorsales ocupados esta temporada</p>
              <div className="flex flex-wrap gap-1">
                {usedNumbers.map((u) => (
                  <span key={u.number} title={u.name} className="sport flex h-7 min-w-7 items-center justify-center rounded-md bg-negro px-1 text-sm font-black text-white">{u.number}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card space-y-4">
          <h2>Contacto</h2>
          <p className="text-xs text-negro/50">Solo lo ven los gestores y el propio jugador.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="phone">Teléfono</label><input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={priv?.phone ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={priv?.email ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="emergency_name">Contacto de emergencia</label><input id="emergency_name" name="emergency_name" placeholder="Nombre y parentesco" defaultValue={priv?.emergency_name ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="emergency_phone">Teléfono de emergencia</label><input id="emergency_phone" name="emergency_phone" type="tel" inputMode="tel" defaultValue={priv?.emergency_phone ?? ""} className="input" /></div>
          </div>
        </section>

        <section className="card space-y-4">
          <h2>Observaciones</h2>
          <p className="text-xs text-negro/50">Solo para gestores: el jugador no las ve.</p>
          <div><label className="label" htmlFor="sport_notes">Deportivas</label><textarea id="sport_notes" name="sport_notes" rows={3} maxLength={2000} defaultValue={priv?.sport_notes ?? ""} placeholder="Puntos fuertes, lesiones anteriores, preferencias…" className="input" /></div>
          <div><label className="label" htmlFor="internal_notes">Internas</label><textarea id="internal_notes" name="internal_notes" rows={3} maxLength={2000} defaultValue={priv?.internal_notes ?? ""} className="input" /></div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card space-y-4">
          <h2>Posición *</h2>
          <PositionPicker value={position} onChange={setPosition} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="foot">Pierna buena</label>
              <select id="foot" name="foot" defaultValue={player?.foot ?? ""} className="input">
                <option value="">—</option><option value="right">Diestro</option><option value="left">Zurdo</option><option value="both">Ambidiestro</option>
              </select>
            </div>
            <div><label className="label" htmlFor="height_cm">Altura (cm)</label><input id="height_cm" name="height_cm" type="number" min={120} max={230} inputMode="numeric" defaultValue={player?.height_cm ?? ""} className="input" /></div>
          </div>
          <div><label className="label" htmlFor="joined_club_on">En el club desde</label><input id="joined_club_on" name="joined_club_on" type="date" defaultValue={player?.joined_club_on ?? ""} className="input" /></div>
        </section>

        <div className="space-y-2 lg:sticky lg:top-6">
          <FormMessage state={state} />
          {!position && <p className="text-center text-xs text-negro/50">Elige su posición en el campo para poder guardar.</p>}
          <SubmitButton disabled={!position || Boolean(taken)} className="btn-primary w-full py-3 text-lg">{isNew ? "Fichar jugador" : "Guardar cambios"}</SubmitButton>
          {isNew && canCreate && (
            <SubmitButton name="again" value="1" disabled={!position || Boolean(taken)} className="btn-ghost w-full">Guardar y fichar otro</SubmitButton>
          )}
        </div>
      </div>
    </form>
  );
}
