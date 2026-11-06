"use client";
import { useActionState, useState, useTransition } from "react";
import { ArrowRightLeft, Ban } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/app/(app)/finanzas/actions";

type Act = (s: ActionState, f: FormData) => Promise<ActionState>;

export function VoidMovementForm({ action }: { action: Act }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);
  if (!open)
    return (
      <button type="button" className="btn-ghost text-rojo" onClick={() => setOpen(true)}>
        <Ban size={16} /> Anular movimiento
      </button>
    );
  return (
    <form action={formAction} className="card space-y-3 ring-2 ring-rojo/30">
      <p className="text-sm text-negro/70">
        El movimiento no se borra: queda marcado como anulado, deja de contar en el saldo y se guarda quién lo anuló y por qué.
      </p>
      <div>
        <label className="label" htmlFor="reason">Motivo</label>
        <input id="reason" name="reason" required className="input" placeholder="Ej.: apuntado dos veces" />
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
        <SubmitButton className="btn-primary" pendingText="Anulando…">Anular</SubmitButton>
      </div>
    </form>
  );
}

export function OpeningForm({ action, cents, date }: { action: Act; cents: number; date: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="opening">Dinero en caja (€)</label>
        <input id="opening" name="opening" inputMode="decimal" className="input tabular-nums"
          defaultValue={(cents / 100).toFixed(2).replace(".", ",")} />
      </div>
      <div>
        <label className="label" htmlFor="opening_date">A fecha de</label>
        <input id="opening_date" name="opening_date" type="date" required className="input" defaultValue={date} />
      </div>
      <SubmitButton className="btn-primary">Guardar</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function AddCategoryForm({ action, kind }: { action: Act; kind: "ingreso" | "gasto" }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <input name="name" required maxLength={60} className="input" placeholder={`Nueva categoría de ${kind}`} aria-label={`Nueva categoría de ${kind}`} />
        <SubmitButton className="btn-dark shrink-0" pendingText="…">Añadir</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function CategoryRow({
  name,
  active,
  rename,
  toggle,
}: {
  name: string;
  active: boolean;
  rename: Act;
  toggle: () => Promise<void>;
}) {
  const [state, formAction] = useActionState(rename, undefined);
  const [pending, start] = useTransition();
  return (
    <li className={`py-2 ${active ? "" : "opacity-50"}`}>
      <form action={formAction} className="flex items-center gap-2">
        <input name="name" defaultValue={name} maxLength={60} className="input py-1.5" aria-label="Nombre de la categoría" />
        <SubmitButton className="btn-ghost shrink-0 px-3 py-1.5 text-xs" pendingText="…">Guardar</SubmitButton>
        <button type="button" disabled={pending} onClick={() => start(toggle)}
          className="btn-ghost shrink-0 px-3 py-1.5 text-xs">{active ? "Ocultar" : "Recuperar"}</button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-rojo">{state.error}</p>}
    </li>
  );
}

export function ImportCampaignButton({ action, label }: { action: (s: ActionState) => Promise<ActionState>; label: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton className="btn-dark w-full sm:w-auto" pendingText="Apuntando…">
        <ArrowRightLeft size={16} /> {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
