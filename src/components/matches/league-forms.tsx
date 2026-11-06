"use client";
import { useActionState, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
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

/** Dirección de la competición en futormes (y nuestro equipo si no se encuentra solo). */
export function LeagueForm({ action, url }: { action: (s: LeagueState, f: FormData) => Promise<LeagueState>; url: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="label" htmlFor="league-url">Dirección de la competición en futormes</label>
        <input id="league-url" name="url" required defaultValue={state?.competition ? `https://www.futormes.com/mod/soccer/situation.aspx?itm=${state.competition}` : url}
          placeholder="https://www.futormes.com/mod/soccer/situation.aspx?itm=…" className="input" inputMode="url" />
        <p className="mt-1 text-xs text-negro/65">En futormes, entra en vuestra competición y copia la dirección de la página «Situación».</p>
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
      <FormMessage state={state} />
      <SubmitButton className="btn-primary" pendingText="Comprobando…">Guardar liga</SubmitButton>
    </form>
  );
}
