"use client";
import { useActionState, useState } from "react";
import { GOAL_KINDS, type GoalKind } from "@/lib/season-goals";
import type { GoalState } from "@/app/(app)/partidos/goal-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** 4.20.0 · Añadir un objetivo de temporada: se elige de la lista y, si hace falta, el número. */
export function GoalForm({ action }: { action: (s: GoalState, f: FormData) => Promise<GoalState> }) {
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState<GoalKind>("position");
  const def = GOAL_KINDS.find((k) => k.kind === kind)!;
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="label" htmlFor="goal-kind">Objetivo</label>
        <select id="goal-kind" name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as GoalKind)}>
          {GOAL_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
      </div>
      {def.needsTarget && (
        <div>
          <label className="label" htmlFor="goal-target">{def.ask}</label>
          <input key={kind} id="goal-target" name="target" type="number" min={1} max={999} required defaultValue={def.default} className="input w-32" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormMessage state={state} />
        <SubmitButton className="btn-primary" pendingText="Añadiendo…">Añadir objetivo</SubmitButton>
      </div>
    </form>
  );
}
