"use client";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { bomboFlag } from "@/components/lottery/bombo";

type A = (s: ActionState, f: FormData) => Promise<ActionState>;

export function ShareStatusForm({ action }: { action: A }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input name="numbers" required className="input font-mono" placeholder="Números: 1-10, 25, 30-32" />
      <select name="status" className="input" defaultValue="reserved" aria-label="Estado de los números">
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
      <select name="seller_id" required className="input sm:col-span-2" defaultValue="" aria-label="Vendedor">
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

export function RaffleDrawForm({ action, total, campaignId, unpaid = [] }: { action: A; total: number; campaignId: string; unpaid?: number[] }) {
  const [state, formAction] = useActionState(action, undefined);
  // 4.30.6 · Si hay números vendidos sin cobrar, hay que decir que sí entran antes de sortear.
  const [unpaidOk, setUnpaidOk] = useState(false);
  const blocked = unpaid.length > 0 && !unpaidOk;
  const shown = unpaid.slice(0, 12).join(", ") + (unpaid.length > 12 ? ` y ${unpaid.length - 12} más` : "");
  return (
    <form action={formAction} className="space-y-3">
      {unpaid.length > 0 && (
        <div className="rounded-xl bg-dorado/20 p-3 text-sm ring-1 ring-dorado/50">
          <p>
            <b>Ojo: {unpaid.length === 1 ? "hay 1 número vendido que aún no está pagado" : `hay ${unpaid.length} números vendidos que aún no están pagados`}</b> ({shown}).
            {" "}Entran en el sorteo igual. Si quieres, cóbralos o anula esas ventas antes de sortear.
          </p>
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" name="unpaid_ok" value="1" checked={unpaidOk} onChange={(e) => setUnpaidOk(e.target.checked)} className="h-5 w-5 accent-rojo" />
            Sí, sorteamos con {unpaid.length === 1 ? "ese número dentro" : "esos números dentro"}
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="number">Número ganador (si ya lo sabes)</label>
          <input id="number" name="number" type="number" min={1} max={total} className="input w-40 font-mono" placeholder={`1 – ${total}`} />
        </div>
        <SubmitButton className="btn-dark" name="mode" value="manual" pendingText="Registrando…" disabled={blocked}>Registrar número</SubmitButton>
        <span className="pb-2 text-sm text-negro/65">o</span>
        <SubmitButton className="btn-primary" name="mode" value="random" pendingText="Sorteando…" disabled={blocked}
          formNoValidate onClick={(e) => { if (!confirm("¿Sortear ahora al azar entre los números vendidos? No se puede repetir.")) e.preventDefault();
            else try { sessionStorage.setItem(bomboFlag(campaignId), "1"); } catch {} }}>
          Sortear al azar
        </SubmitButton>
      </div>
      <p className="text-xs text-negro/65">El sorteo al azar elige uno de los números vendidos. Una vez registrado el ganador no se puede cambiar.</p>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteCampaignForm({ action, name, sales }: { action: A; name: string; sales: number }) {
  const [state, formAction] = useActionState(action, undefined);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-rojo ring-rojo/30">
        <Trash2 size={16} /> Eliminar campaña
      </button>
    );
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-rojo/5 p-4 ring-1 ring-rojo/20">
      <p className="text-sm">
        <b>Esto no se puede deshacer.</b> Se borrarán la campaña{sales > 0 ? `, sus ${sales} ventas y todos sus cobros` : ""} y sus números.
        {sales > 0 && " Si solo quieres quitarla de la lista, mejor archívala."} Queda una copia del resumen en Auditoría.
      </p>
      <div>
        <label className="label" htmlFor="confirm_name">Para confirmar, escribe el nombre: <b>{name}</b></label>
        <input id="confirm_name" name="confirm_name" value={typed} onChange={(e) => setTyped(e.target.value)} className="input" autoComplete="off" />
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setOpen(false); setTyped(""); }} className="btn-ghost">Cancelar</button>
        <SubmitButton className="btn-primary" pendingText="Eliminando…" disabled={typed.trim() !== name.trim()}>
          <Trash2 size={16} /> Eliminar definitivamente
        </SubmitButton>
      </div>
    </form>
  );
}

/** 4.20.0 · Apuntar lo que un vendedor entrega al club (se abre debajo de su fila). */
export function HandoverForm({ action, owed, name }: { action: A; owed: number; name: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary min-h-11 flex-1">Apuntar entrega</button>
    );
  return (
    <form action={formAction} className="w-full space-y-2 rounded-xl bg-gris p-3">
      <p className="text-sm font-bold">¿Cuánto entrega {name}?</p>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`amount-${name}`}>Cantidad en euros</label>
        <input id={`amount-${name}`} name="amount" inputMode="decimal" required defaultValue={owed > 0 ? (owed / 100).toFixed(2).replace(".", ",") : ""}
          className="input w-32 font-mono" placeholder="0,00 €" autoFocus />
        <label className="sr-only" htmlFor={`method-${name}`}>Cómo</label>
        <select id={`method-${name}`} name="method" className="input w-auto" defaultValue="cash">
          <option value="cash">Efectivo</option>
          <option value="bizum">Bizum</option>
          <option value="transfer">Transferencia</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <label className="sr-only" htmlFor={`notes-${name}`}>Nota</label>
      <input id={`notes-${name}`} name="notes" maxLength={300} className="input" placeholder="Nota (opcional)" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
          <SubmitButton className="btn-dark" pendingText="Guardando…">Guardar</SubmitButton>
        </div>
      </div>
    </form>
  );
}
