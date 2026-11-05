"use client";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { MODULE_LABEL, ROLE_LABEL } from "@/lib/format";

type ActionState = { error?: string; ok?: string } | undefined;
type A = (s: ActionState, f: FormData) => Promise<ActionState>;
type PermRow = { module: string; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean };
const ACTIONS = [["read", "Consultar"], ["create", "Crear"], ["update", "Modificar"], ["delete", "Eliminar"]] as const;

export function InviteForm({ action, roles }: { action: A; roles: string[] }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input name="full_name" required className="input" placeholder="Nombre y apellidos" />
      <input name="email" type="email" required className="input" placeholder="Email" />
      <input name="phone" type="tel" className="input" placeholder="Teléfono (opcional)" />
      <select name="role" className="input" defaultValue="player">
        {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <FormMessage state={state} />
        <SubmitButton className="btn-primary" pendingText="Enviando…">Enviar invitación</SubmitButton>
      </div>
    </form>
  );
}

export function UserEditForm({
  action,
  profile,
  roles,
  modules,
  rolePerms,
  userPerms,
  canEdit,
}: {
  action: A;
  profile: { full_name: string; email: string | null; phone: string | null; role: string; active: boolean };
  roles: string[];
  modules: string[];
  rolePerms: PermRow[];
  userPerms: PermRow[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [role, setRole] = useState(profile.role);
  const [custom, setCustom] = useState<Record<string, boolean>>(Object.fromEntries(userPerms.map((p) => [p.module, true])));
  const base = (m: string) => rolePerms.find((p) => p.module === m && (p as PermRow & { role: string }).role === role);

  return (
    <form action={formAction} className="space-y-6">
      <fieldset disabled={!canEdit} className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Datos</h2>
        <div>
          <label className="label" htmlFor="full_name">Nombre</label>
          <input id="full_name" name="full_name" defaultValue={profile.full_name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Teléfono</label>
          <input id="phone" name="phone" defaultValue={profile.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="role">Rol</label>
          <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit} className="card">
        <h2 className="mb-1 font-bold">Permisos</h2>
        <p className="mb-4 text-sm text-negro/50">
          Por defecto se aplican los del rol. Marca “Personalizar” para fijar permisos concretos en un módulo.{" "}
          <a href="/admin/perfiles" className="font-semibold text-rojo">¿Qué hace cada perfil?</a>
        </p>
        {role === "superadmin" ? (
          <p className="rounded-xl bg-gris p-3 text-sm">El superadministrador tiene acceso completo a todo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Módulo</th><th>Personalizar</th>{ACTIONS.map(([, l]) => <th key={l} className="text-center">{l}</th>)}</tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const isCustom = Boolean(custom[m]);
                  const src = isCustom ? userPerms.find((p) => p.module === m) : base(m);
                  return (
                    <tr key={m}>
                      <td className="font-medium">{MODULE_LABEL[m] ?? m}</td>
                      <td>
                        <input type="checkbox" name={`${m}.custom`} checked={isCustom}
                          onChange={(e) => setCustom((c) => ({ ...c, [m]: e.target.checked }))} className="h-4 w-4 accent-rojo" />
                      </td>
                      {ACTIONS.map(([a]) => (
                        <td key={a} className="text-center">
                          <input
                            key={`${m}.${a}.${isCustom}.${role}`}
                            type="checkbox"
                            name={`${m}.${a}`}
                            defaultChecked={Boolean(src?.[`can_${a}` as keyof PermRow])}
                            disabled={!isCustom}
                            className="h-4 w-4 accent-rojo"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormMessage state={state} />
          <SubmitButton className="btn-primary">Guardar</SubmitButton>
        </div>
      )}
    </form>
  );
}
