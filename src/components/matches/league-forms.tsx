"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { RefreshCw, Search } from "lucide-react";
import { shortDay } from "@/lib/matches";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { LeagueState } from "@/app/(app)/partidos/actions";

/** Botón «Sincronizar con la liga». */
export function SyncButton({ action, className = "btn-dark", label = "Sincronizar con la liga" }: { action: () => Promise<LeagueState>; className?: string; label?: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<LeagueState>();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className={className} onClick={() => start(async () => setState(await action()))}>
        <RefreshCw size={16} className={pending ? "animate-spin" : ""} /> {pending ? "Sincronizando…" : label}
      </button>
      <div aria-live="polite"><FormMessage state={state} /></div>
    </div>
  );
}

const urlOf = (competition: string) => `https://www.futormes.com/mod/soccer/situation.aspx?itm=${competition}`;

/**
 * Competición de futormes. Va en dos pasos: «Comprobar» lee la competición y enseña lo que se
 * va a traer; «Usar esta liga» la guarda. «Buscar al Rayo» encuentra la liga nueva sin pegar nada.
 */
export function LeagueForm({ action, find, url, suggest }: {
  action: (s: LeagueState, f: FormData) => Promise<LeagueState>;
  find: () => Promise<LeagueState>;
  url: string;
  /** Competición que la app ha encontrado sola: se propone ya escrita */
  suggest?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [value, setValue] = useState(suggest ? urlOf(suggest) : url);
  const [search, setSearch] = useState<LeagueState>();
  const [searching, startSearch] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [auto, setAuto] = useState(0);
  // Al elegir una competición encontrada se comprueba sola
  useEffect(() => { if (auto) form.current?.requestSubmit(); }, [auto]);

  const pv = state?.preview;
  // La vista previa solo vale para la dirección que se comprobó
  const confirmed = pv && value.trim().endsWith(`itm=${pv.competition}`) ? pv : undefined;

  return (
    <form ref={form} action={formAction} className="space-y-3">
      <div>
        <label className="label" htmlFor="league-url">Dirección de la competición en futormes</label>
        <input id="league-url" name="url" required value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="https://www.futormes.com/mod/soccer/situation.aspx?itm=…" className="input" inputMode="url" />
        <p className="mt-1 text-xs text-negro/65">En futormes, entra en vuestra competición y copia la dirección de la página «Situación». O deja que la app la busque.</p>
      </div>
      {state?.teams && (
        <div>
          <label className="label" htmlFor="league-team">Nuestro equipo</label>
          <select id="league-team" name="team" className="input" defaultValue="">
            <option value="" disabled>Elige el equipo…</option>
            {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {confirmed && (
        <div className="rounded-xl bg-gris p-3 ring-1 ring-black/5" data-testid="league-preview">
          <input type="hidden" name="confirm" value={confirmed.competition} />
          <input type="hidden" name="team" value={confirmed.team} />
          <p className="text-xs font-bold uppercase tracking-wide text-negro/60">{confirmed.change ? "Vas a cambiar a esta liga" : "Esto es lo que se trae"}</p>
          <p className="sport mt-1 text-lg font-black leading-tight">{confirmed.name ?? "Competición sin nombre"}</p>
          <ul className="mt-2 space-y-1 text-sm text-negro/80">
            <li><b>{confirmed.teamName}</b> entre {confirmed.teams} equipos</li>
            <li><b>{confirmed.matches}</b> {confirmed.matches === 1 ? "partido nuestro" : "partidos nuestros"}, {confirmed.played} ya {confirmed.played === 1 ? "jugado" : "jugados"}</li>
            {confirmed.from && confirmed.to && <li>Del {shortDay(confirmed.from)} al {shortDay(confirmed.to)}</li>}
            {confirmed.finished && <li className="font-semibold text-amber-800">Esta competición ya ha terminado.</li>}
          </ul>
          {confirmed.change && <p className="mt-2 text-xs text-negro/65">Los partidos y las estadísticas de la liga anterior no se borran: quedan en el histórico.</p>}
        </div>
      )}
      <FormMessage state={state?.error || state?.ok ? state : undefined} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn-primary" pendingText="Leyendo la liga…">{confirmed ? (confirmed.change ? "Usar esta liga" : "Guardar liga") : "Comprobar"}</SubmitButton>
        <button type="button" className="btn-ghost" disabled={searching} onClick={() => startSearch(async () => setSearch(await find()))}>
          <Search size={16} className={searching ? "animate-pulse" : ""} /> {searching ? "Buscando al Rayo…" : "Buscar al Rayo en futormes"}
        </button>
      </div>
      <div aria-live="polite" className="space-y-2">
        <FormMessage state={search?.error || search?.ok ? search : undefined} />
        {search?.found && (
          <ul className="space-y-2">
            {search.found.map((f) => (
              <li key={f.competition}>
                <button type="button" className="lift flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-black/10"
                  onClick={() => { setValue(urlOf(f.competition)); setAuto((n) => n + 1); }}>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{f.name}</span>
                    <span className="block text-xs text-negro/65">
                      {f.matches} {f.matches === 1 ? "partido" : "partidos"}{f.from ? ` desde el ${shortDay(f.from)}` : ""}{f.finished ? " · ya terminada" : f.played ? " · en juego" : " · por empezar"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-rojo">Ver →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
