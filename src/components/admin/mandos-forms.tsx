"use client";
import { useActionState, useState, useTransition } from "react";
import { Construction, Eye, LogOut, Megaphone, RefreshCw, ToggleRight, TriangleAlert } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { APP_MODULES, type BannerTone } from "@/lib/app-settings";
import {
  closeAllSessions, forceUpdate, saveBanner, saveMaintenance, saveModules, startViewAs, type MandoState,
} from "@/app/(app)/admin/mandos/actions";

const Pill = ({ on, yes, no }: { on: boolean; yes: string; no: string }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${on ? "bg-amber-400 text-negro" : "bg-gris text-negro/60"}`}>{on ? yes : no}</span>
);

function Head({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-bold"><span className="text-rojo">{icon}</span> {title}</h2>
      {children}
    </div>
  );
}

/** 1 · Modo mantenimiento. */
export function MaintenanceForm({ on, message, until, closePublic }: { on: boolean; message: string; until: string; closePublic: boolean }) {
  const [state, action] = useActionState<MandoState, FormData>(saveMaintenance, undefined);
  return (
    <form action={action} className={`card space-y-3 ${on ? "ring-2 ring-amber-400" : ""}`} data-testid="mandos-mantenimiento">
      <Head icon={<Construction size={18} />} title="Modo mantenimiento"><Pill on={on} yes="Puesto" no="Quitado" /></Head>
      <p className="text-sm text-negro/65">Mientras está puesto, todo el mundo menos tú ve «Estamos de obras». Tú sigues entrando normal para revisarlo.</p>
      <div>
        <label className="label" htmlFor="m-msg">Mensaje para el equipo</label>
        <textarea id="m-msg" name="message" maxLength={400} rows={2} defaultValue={message} className="input"
          placeholder="Estamos mejorando la app del Rayo. En un rato vuelve a estar disponible." />
      </div>
      <div>
        <label className="label" htmlFor="m-until">Volvemos hacia (opcional)</label>
        <input id="m-until" name="until" type="datetime-local" defaultValue={until} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="public" value="1" defaultChecked={closePublic} className="mt-0.5 h-4 w-4 accent-rojo" />
        <span>Cerrar también las páginas públicas (la rifa y las noticias)</span>
      </label>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <SubmitButton name="on" value="0" className="btn-primary" pendingText="Guardando…">Quitar mantenimiento</SubmitButton>
            <SubmitButton name="on" value="1" className="btn-ghost" pendingText="Guardando…">Guardar cambios</SubmitButton>
          </>
        ) : (
          <SubmitButton name="on" value="1" className="btn-dark" pendingText="Poniendo…"><Construction size={16} /> Poner en mantenimiento</SubmitButton>
        )}
      </div>
    </form>
  );
}

/** 2 · Mensaje fijo arriba en todas las pantallas. */
export function BannerForm({ text, tone, until, expired }: { text: string; tone: BannerTone; until: string; expired: boolean }) {
  const [state, action] = useActionState<MandoState, FormData>(saveBanner, undefined);
  const [draft, setDraft] = useState(text);
  const [t, setT] = useState<BannerTone>(tone);
  const live = !!text && !expired;
  return (
    <form action={action} className="card space-y-3" data-testid="mandos-mensaje">
      <Head icon={<Megaphone size={18} />} title="Mensaje fijo para todos"><Pill on={live} yes="Visible" no={expired ? "Caducado" : "Sin mensaje"} /></Head>
      <p className="text-sm text-negro/65">Sale arriba en todas las pantallas, a todo el mundo, hasta que lo quites o llegue la fecha.</p>
      <div>
        <label className="label" htmlFor="b-text">Mensaje</label>
        <textarea id="b-text" name="text" maxLength={200} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className="input"
          placeholder="Ej.: Pagad la cuota antes del viernes" />
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label">Tipo</legend>
        {([["info", "Información"], ["urgent", "Urgente"]] as const).map(([v, l]) => (
          <label key={v} className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-bold ring-1 ${t === v ? (v === "urgent" ? "bg-rojo text-white ring-rojo" : "bg-dorado/30 ring-dorado") : "bg-white ring-black/10"}`}>
            <input type="radio" name="tone" value={v} checked={t === v} onChange={() => setT(v)} className="sr-only" /> {l}
          </label>
        ))}
      </fieldset>
      <div>
        <label className="label" htmlFor="b-until">Quitarlo solo el (opcional)</label>
        <input id="b-until" name="until" type="datetime-local" defaultValue={until} className="input" />
      </div>
      {draft.trim() && (
        <div aria-hidden className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${t === "urgent" ? "bg-rojo text-white" : "bg-dorado/25 ring-1 ring-dorado/40"}`}>
          {t === "urgent" ? <TriangleAlert size={16} className="mt-0.5 shrink-0" /> : <Megaphone size={16} className="mt-0.5 shrink-0 text-rojo" />}
          <span className="min-w-0 break-words">{draft.replace(/\s+/g, " ").trim()}</span>
        </div>
      )}
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn-primary" pendingText="Guardando…" disabled={!draft.trim()}>{text ? "Guardar mensaje" : "Poner mensaje"}</SubmitButton>
        {text && <SubmitButton name="clear" value="1" className="btn-ghost" pendingText="Quitando…" onClick={() => setDraft("")}>Quitar</SubmitButton>}
      </div>
    </form>
  );
}

/** 5 · Apartados encendidos o apagados para todos. */
export function ModulesForm({ off }: { off: string[] }) {
  const [state, action] = useActionState<MandoState, FormData>(saveModules, undefined);
  return (
    <form action={action} className="card space-y-3" data-testid="mandos-apartados">
      <Head icon={<ToggleRight size={18} />} title="Apartados"><Pill on={off.length > 0} yes={`${off.length} apagado${off.length > 1 ? "s" : ""}`} no="Todos encendidos" /></Head>
      <p className="text-sm text-negro/65">Quita la marca para esconder un apartado a todo el mundo. Tú lo sigues viendo, con su aviso.</p>
      <ul className="divide-y divide-black/5">
        {APP_MODULES.map((m) => (
          <li key={m.key}>
            <label className="flex cursor-pointer items-start gap-3 py-2">
              <input type="checkbox" name="on" value={m.key} defaultChecked={!off.includes(m.key)} className="mt-1 h-4 w-4 accent-rojo" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{m.label}</span>
                <span className="block text-xs text-negro/60">{m.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary" pendingText="Guardando…">Guardar</SubmitButton>
    </form>
  );
}

/** Botón con un segundo toque para confirmar (sin ventanas del navegador). */
function ConfirmButton({ label, confirm, icon, run, testId }: { label: string; confirm: string; icon: React.ReactNode; run: () => Promise<MandoState>; testId: string }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<MandoState>();
  return (
    <div className="space-y-2" data-testid={testId}>
      {ask ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rojo/5 p-2 ring-1 ring-rojo/15">
          <span className="min-w-0 flex-1 text-sm font-semibold">{confirm}</span>
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled={pending}
            onClick={() => start(async () => { setState(await run()); setAsk(false); })}>
            {pending ? "Un momento…" : "Sí, hazlo"}
          </button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled={pending} onClick={() => setAsk(false)}>No</button>
        </div>
      ) : (
        <button type="button" className="btn-dark" onClick={() => { setState(undefined); setAsk(true); }}>{icon} {label}</button>
      )}
      <FormMessage state={state} />
    </div>
  );
}

/** 3 y 4 · Cerrar sesión a todos y forzar actualización. */
export function SessionsAndVersion({ openOthers, openSessions, lastReload }: { openOthers: number; openSessions: number; lastReload: string | null }) {
  return (
    <section className="card space-y-4">
      <div className="space-y-2">
        <Head icon={<LogOut size={18} />} title="Cerrar sesión a todos" />
        <p className="text-sm text-negro/65">
          Saca a todo el mundo menos a ti y les pide entrar otra vez con su contraseña. Ahora hay{" "}
          <b>{openSessions} {openSessions === 1 ? "sesión abierta" : "sesiones abiertas"}</b> de {openOthers} {openOthers === 1 ? "persona" : "personas"}.
        </p>
        <ConfirmButton testId="mandos-sesiones" label="Cerrar sesión a todos" icon={<LogOut size={16} />} confirm="¿Sacar a todos? Tendrán que volver a entrar." run={closeAllSessions} />
      </div>
      <div className="space-y-2 border-t border-black/5 pt-4">
        <Head icon={<RefreshCw size={18} />} title="Forzar actualización" />
        <p className="text-sm text-negro/65">
          Tras un arreglo, cada móvil carga la última versión en cuanto abre la app o cambia de pantalla, sin cerrar nada ni borrar datos.
          {lastReload && <> Última vez: <b>{lastReload}</b>.</>}
        </p>
        <ConfirmButton testId="mandos-actualizar" label="Forzar actualización" icon={<RefreshCw size={16} />} confirm="¿Recargar la app en todos los móviles?" run={forceUpdate} />
      </div>
    </section>
  );
}

/** 7 · Ver la app como otro perfil. */
export function ViewAsForm({ profiles }: { profiles: { key: string; name: string; custom: boolean }[] }) {
  const [state, action] = useActionState<MandoState, FormData>(startViewAs, undefined);
  return (
    <form action={action} className="card space-y-3 lg:col-span-2" data-testid="mandos-ver-como">
      <Head icon={<Eye size={18} />} title="Ver como otro perfil" />
      <p className="text-sm text-negro/65">
        Mira la app con los menús y apartados que tiene ese perfil, para comprobar qué le aparece. Es una vista aproximada: no entras con la
        cuenta de nadie y los datos personales que salen son los tuyos. Arriba tendrás siempre el botón para volver.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="key" className="input sm:max-w-xs" defaultValue={profiles.find((p) => p.key === "player")?.key ?? profiles[0]?.key} aria-label="Perfil">
          {profiles.map((p) => <option key={p.key} value={p.key}>{p.name}{p.custom ? " (a medida)" : ""}</option>)}
        </select>
        <SubmitButton className="btn-dark" pendingText="Cambiando…"><Eye size={16} /> Ver la app así</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
