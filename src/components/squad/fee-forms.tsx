"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_METHOD_LABEL } from "@/lib/format";
import type { FeeOverride, FeePlan } from "@/lib/squad";
import type { ActionState } from "@/app/(app)/plantilla/actions";

type A = (s: ActionState, f: FormData) => Promise<ActionState>;
const eurosInput = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",").replace(",00", "") : "");

/** Apuntar un pago de cuota (se guarda como ingreso en Finanzas). */
export function FeePaymentForm({ action, suggested, today, compact = false }: { action: A; suggested: number | null; today: string; compact?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={compact ? "space-y-2" : "space-y-3"}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className="label">Importe (€)</label>
          <input name="amount" aria-label="Importe en euros" inputMode="decimal" required defaultValue={eurosInput(suggested)} placeholder="0" className="input sport text-lg font-black" />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input name="op_date" aria-label="Fecha del pago" type="date" defaultValue={today} className="input" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Forma de pago</label>
          <select name="method" aria-label="Forma de pago" defaultValue="bizum" className="input">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Apuntando…">Apuntar pago</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Cuota especial de un jugador (descuento, exento…). */
export function FeeOverrideForm({ action, current, general }: { action: A; current: FeeOverride | null; general: number | null }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <div>
          <label className="label">Cuota (€)</label>
          <input name="amount" aria-label="Cuota especial en euros" inputMode="decimal" defaultValue={current ? eurosInput(current.amount_cents) || "0" : ""}
            placeholder={general != null ? eurosInput(general) || "0" : "—"} className="input" />
        </div>
        <div>
          <label className="label">Motivo</label>
          <input name="reason" aria-label="Motivo" maxLength={120} defaultValue={current?.reason ?? ""} placeholder="Hermanos, exento, media temporada…" className="input" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn-dark flex-1" pendingText="Guardando…">Guardar cuota especial</SubmitButton>
        {current && <button name="reset" value="1" className="btn-ghost">Usar la general</button>}
      </div>
      <p className="text-xs text-negro/65">Pon 0 si está exento. Vacío = la cuota general de la temporada.</p>
      <FormMessage state={state} />
    </form>
  );
}

/** Cuota general de la temporada. */
export function FeePlanForm({ action, plan }: { action: A; plan: FeePlan | null }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[9rem_11rem_minmax(0,1fr)_auto] sm:items-end">
      <div>
        <label className="label">Cuota (€)</label>
        <input name="amount" aria-label="Cuota general en euros" inputMode="decimal" required defaultValue={eurosInput(plan?.amount_cents)} placeholder="0" className="input sport text-xl font-black" />
      </div>
      <div>
        <label className="label">Pagar antes del</label>
        <input name="due_on" aria-label="Pagar antes del" type="date" defaultValue={plan?.due_on ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Nota</label>
        <input name="notes" aria-label="Nota" maxLength={300} defaultValue={plan?.notes ?? ""} placeholder="Se puede pagar en dos plazos…" className="input" />
      </div>
      <SubmitButton className="btn-primary" pendingText="Guardando…">Guardar</SubmitButton>
      <div className="sm:col-span-4"><FormMessage state={state} /></div>
    </form>
  );
}
