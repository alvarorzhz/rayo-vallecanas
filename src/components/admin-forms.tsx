"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { MODULE_LABEL, phoneE164 } from "@/lib/format";

/** Perfil que se puede elegir para una persona (los de siempre y los creados a medida). */
export type ProfileOption = { key: string; name: string; base: string; perms: Record<string, Partial<Record<"read" | "create" | "update" | "delete", boolean>>> };

function ProfileOptions({ profiles }: { profiles: ProfileOption[] }) {
  const fixed = profiles.filter((p) => p.key === p.base);
  const custom = profiles.filter((p) => p.key !== p.base);
  return (
    <>
      {fixed.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
      {custom.length > 0 && (
        <optgroup label="Perfiles a medida">
          {custom.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
        </optgroup>
      )}
    </>
  );
}

type ActionState = { error?: string; ok?: string; password?: string; name?: string; phone?: string | null; email?: string } | undefined;
type A = (s: ActionState, f: FormData) => Promise<ActionState>;
type PermRow = { module: string; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean };
const ACTIONS = [["read", "Consultar"], ["create", "Crear"], ["update", "Modificar"], ["delete", "Eliminar"]] as const;

function accessMessage(s: NonNullable<ActionState>, url: string) {
  const first = (s.name ?? "").split(" ")[0];
  return `¡Hola, ${first}! 👋 Ya tienes acceso a la app del *Rayo Vallecañas* ⚡\n\n` +
    `Entra en ${url}\n📧 Usuario: ${s.email}\n🔑 Contraseña provisional: ${s.password}\n\n` +
    `Al entrar te pedirá que elijas tu propia contraseña. Te recomendamos instalar la app en la pantalla de inicio del móvil.`;
}

/** Datos de acceso recién creados, con botón para mandarlos por WhatsApp. */
export function AccessResult({ state, again }: { state: NonNullable<ActionState>; again: string }) {
  const [copied, setCopied] = useState(false);
  const text = accessMessage(state, window.location.origin);
  const phone = phoneE164(state.phone);
  return (
    <div className="space-y-3 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
      <p className="font-bold">✅ {state.ok}</p>
      <p>Pásale estos datos para que entre. Solo se muestran ahora; si se pierden, genera otra contraseña desde su ficha.</p>
      <div className="rounded-xl bg-white p-3 font-mono text-negro ring-1 ring-black/10">
        <div>Usuario: <b>{state.email}</b></div>
        <div>Contraseña: <b>{state.password}</b></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary" target="_blank" rel="noopener"
          href={`https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`}>
          Enviar por WhatsApp
        </a>
        <button type="button" className="btn-ghost"
          onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => {})}>
          {copied ? "¡Copiado!" : "Copiar mensaje"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>{again}</button>
      </div>
    </div>
  );
}

export function ResetPasswordForm({ action }: { action: A }) {
  const [state, formAction] = useActionState(action, undefined);
  if (state?.password) return <AccessResult state={state} again="Cerrar" />;
  return (
    <form action={formAction} className="space-y-2"
      onSubmit={(e) => { if (!confirm("¿Crear una contraseña provisional nueva? La actual dejará de funcionar.")) e.preventDefault(); }}>
      <SubmitButton className="btn-ghost" pendingText="Creando…">Nueva contraseña provisional</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function InviteForm({ action, profiles }: { action: A; profiles: ProfileOption[] }) {
  const [state, formAction] = useActionState(action, undefined);
  const [mode, setMode] = useState<"password" | "email">("password");
  if (state?.password) return <AccessResult state={state} again="Dar de alta a otro" />;
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <fieldset className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
        <legend className="label">¿Cómo le damos acceso?</legend>
        {([
          ["password", "Contraseña provisional", "Recomendado. La app crea una contraseña y se la mandas por WhatsApp."],
          ["email", "Invitación por email", "Le llega un correo para crear su contraseña (puede tardar o no llegar)."],
        ] as const).map(([v, t, h]) => (
          <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${mode === v ? "border-rojo bg-rojo/5" : "border-negro/10"}`}>
            <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="mt-1 accent-rojo" />
            <span><span className="block font-bold">{t}</span><span className="block text-sm text-negro/60">{h}</span></span>
          </label>
        ))}
      </fieldset>
      <input name="full_name" required className="input" placeholder="Nombre y apellidos" />
      <input name="email" type="email" required className="input" placeholder="Email" />
      <input name="phone" type="tel" className="input" placeholder="Teléfono (opcional)" />
      <select name="profile" className="input" defaultValue="player" aria-label="Perfil">
        <ProfileOptions profiles={profiles} />
      </select>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <FormMessage state={state} />
        <SubmitButton className="btn-primary" pendingText="Creando…">{mode === "email" ? "Enviar invitación" : "Dar de alta"}</SubmitButton>
      </div>
    </form>
  );
}

export function UserEditForm({
  action,
  profile,
  profiles,
  modules,
  userPerms,
  canEdit,
}: {
  action: A;
  profile: { full_name: string; email: string | null; phone: string | null; role: string; custom_role_id: string | null; active: boolean };
  profiles: ProfileOption[];
  modules: string[];
  userPerms: PermRow[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [key, setKey] = useState(profile.custom_role_id ?? profile.role);
  const selected = profiles.find((p) => p.key === key);
  const role = selected?.base ?? profile.role;
  const [custom, setCustom] = useState<Record<string, boolean>>(Object.fromEntries(userPerms.map((p) => [p.module, true])));
  const base = (m: string): PermRow | undefined => {
    const p = selected?.perms[m];
    return p && { module: m, can_read: !!p.read, can_create: !!p.create, can_update: !!p.update, can_delete: !!p.delete };
  };

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
          <label className="label" htmlFor="profile">Perfil</label>
          <select id="profile" name="profile" value={key} onChange={(e) => setKey(e.target.value)} className="input">
            <ProfileOptions profiles={profiles} />
          </select>
        </div>
      </fieldset>

      <fieldset disabled={!canEdit} className="card">
        <h2 className="mb-1 font-bold">Permisos</h2>
        <p className="mb-4 text-sm text-negro/65">
          Por defecto se aplican los de su perfil{selected && selected.key !== selected.base ? ` (${selected.name})` : ""}. Marca “Personalizar” para fijar permisos concretos en un módulo solo para esta persona.{" "}
          <Link href="/admin/perfiles" className="font-semibold text-rojo">¿Qué hace cada perfil?</Link>
        </p>
        {role === "player" && (
          <p className="mb-2 text-xs text-negro/65">Los jugadores no pueden acceder a Finanzas ni a los datos personales de otros en ningún caso.</p>
        )}
        {role === "superadmin" ? (
          <p className="rounded-xl bg-gris p-3 text-sm">El superadministrador tiene acceso completo a todo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Módulo</th><th>Personalizar</th>{ACTIONS.map(([, l]) => <th key={l} className="text-center">{l}</th>)}</tr>
              </thead>
              <tbody>
                {modules.filter((m) => !((m === "finances" || m === "squad_private") && role === "player")).map((m) => {
                  const isCustom = Boolean(custom[m]);
                  const src = isCustom ? userPerms.find((p) => p.module === m) : base(m);
                  return (
                    <tr key={m}>
                      <td className="font-medium">{MODULE_LABEL[m] ?? m}</td>
                      <td>
                        <input type="checkbox" name={`${m}.custom`} checked={isCustom} aria-label={`${MODULE_LABEL[m] ?? m}: personalizar`}
                          onChange={(e) => setCustom((c) => ({ ...c, [m]: e.target.checked }))} className="h-4 w-4 accent-rojo" />
                      </td>
                      {ACTIONS.map(([a]) => (
                        <td key={a} className="text-center">
                          <input
                            key={`${m}.${a}.${isCustom}.${key}`}
                            type="checkbox"
                            name={`${m}.${a}`}
                            aria-label={`${MODULE_LABEL[m] ?? m}: ${ACTIONS.find(([x]) => x === a)?.[1] ?? a}`}
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
