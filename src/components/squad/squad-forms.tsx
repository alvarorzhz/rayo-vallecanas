"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { AccessResult } from "@/components/admin-forms";
import type { ActionState } from "@/app/(app)/plantilla/actions";

type A = (s: ActionState, f: FormData) => Promise<ActionState>;

/** El propio jugador corrige sus datos de contacto. */
export function MyContactForm({ action, data }: {
  action: A;
  data: { birth_date: string | null; phone: string | null; email: string | null; emergency_name: string | null; emergency_phone: string | null };
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="my-phone">Teléfono</label><input id="my-phone" name="phone" type="tel" inputMode="tel" defaultValue={data.phone ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="my-email">Email</label><input id="my-email" name="email" type="email" defaultValue={data.email ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="my-en">Contacto de emergencia</label><input id="my-en" name="emergency_name" placeholder="Nombre y parentesco" defaultValue={data.emergency_name ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="my-ep">Teléfono de emergencia</label><input id="my-ep" name="emergency_phone" type="tel" inputMode="tel" defaultValue={data.emergency_phone ?? ""} className="input" /></div>
        <div><label className="label" htmlFor="my-bd">Fecha de nacimiento</label><input id="my-bd" name="birth_date" type="date" defaultValue={data.birth_date ?? ""} className="input" /></div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary">Guardar mis datos</SubmitButton>
    </form>
  );
}

/** Vincular la ficha con un usuario que ya existe. */
export function LinkUserForm({ action, users }: { action: A; users: { id: string; full_name: string; email: string | null }[] }) {
  const [state, formAction] = useActionState(action, undefined);
  if (!users.length) return <p className="text-sm text-negro/50">No hay usuarios sin ficha para vincular.</p>;
  return (
    <form action={formAction} className="space-y-2">
      <label className="label" htmlFor="user_id">Ya tiene usuario en la app</label>
      <div className="flex flex-wrap gap-2">
        <select id="user_id" name="user_id" className="input flex-1" defaultValue="">
          <option value="" disabled>Elige su usuario…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}{u.email ? ` · ${u.email}` : ""}</option>)}
        </select>
        <SubmitButton className="btn-dark" pendingText="Vinculando…">Vincular</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** Crear su usuario con contraseña provisional para mandársela por WhatsApp. */
export function CreateAccessForm({ action, email }: { action: A; email: string | null }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.password) return <AccessResult state={state} again="Cerrar" />;
  return (
    <form action={formAction} className="space-y-2">
      <label className="label" htmlFor="access-email">Darle acceso a la app</label>
      <div className="flex flex-wrap gap-2">
        <input id="access-email" name="email" type="email" required defaultValue={email ?? ""} placeholder="Su email (será su usuario)" className="input flex-1" />
        <SubmitButton className="btn-primary" pendingText="Creando…">Crear acceso</SubmitButton>
      </div>
      <p className="text-xs text-negro/50">Se crea con una contraseña provisional que le mandas por WhatsApp. Entrará con perfil Jugador.</p>
      <FormMessage state={state} />
    </form>
  );
}

/** Botón de eliminar ficha con confirmación. */
export function DeletePlayerForm({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("¿Eliminar esta ficha y toda su historia? No se puede deshacer.")) e.preventDefault(); }}>
      <SubmitButton className="btn-ghost text-rojo" pendingText="Eliminando…">Eliminar ficha</SubmitButton>
    </form>
  );
}

/** Dar de baja definitiva (con fecha) o reincorporar. */
export function RetireForm({ retire, rejoin, left, today }: { retire: A; rejoin: () => Promise<ActionState>; left: boolean; today: string }) {
  const [state, retireAction] = useActionState(retire, undefined);
  const [state2, rejoinAction] = useActionState(rejoin, undefined);
  if (left)
    return (
      <form action={rejoinAction} className="space-y-2">
        <SubmitButton className="btn-ghost" pendingText="Guardando…">Reincorporar al equipo</SubmitButton>
        <FormMessage state={state2} />
      </form>
    );
  return (
    <form action={retireAction} className="space-y-2"
      onSubmit={(e) => { if (!confirm("¿Dar de baja definitiva a este jugador? Su historia y estadísticas se conservan.")) e.preventDefault(); }}>
      <label className="label" htmlFor="left_on">Dar de baja definitiva</label>
      <div className="flex flex-wrap gap-2">
        <input id="left_on" name="left_on" type="date" defaultValue={today} className="input w-auto flex-1" />
        <SubmitButton className="btn-dark" pendingText="Guardando…">Dar de baja</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
