"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

type A = (s: ActionState, f: FormData) => Promise<ActionState>;

export function ShareStatusForm({ action }: { action: A }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input name="numbers" required className="input font-mono" placeholder="Números: 1-10, 25, 30-32" />
      <select name="status" className="input" defaultValue="reserved">
        <option value="reserved">Reservar</option>
        <option value="available">Liberar (disponible)</option>
        <option value="voided">Anular (extraviada / rota)</option>
      </select>
      <SubmitButton className="btn-dark">Aplicar</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function BookletForm({ action, sellers }: { action: A; sellers: { id: string; full_name: string }[] }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-5">
      <select name="seller_id" required className="input sm:col-span-2" defaultValue="">
        <option value="" disabled>Vendedor…</option>
        {sellers.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
      <input name="from_number" type="number" min={1} required className="input" placeholder="Desde" />
      <input name="to_number" type="number" min={1} required className="input" placeholder="Hasta" />
      <input name="label" className="input" placeholder="Talonario (opc.)" />
      <div className="sm:col-span-5 flex flex-wrap items-center justify-between gap-3">
        <FormMessage state={state} />
        <SubmitButton className="btn-dark">Asignar talonario</SubmitButton>
      </div>
    </form>
  );
}
