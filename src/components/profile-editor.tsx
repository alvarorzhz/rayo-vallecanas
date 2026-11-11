"use client";
import { useActionState, useState, useTransition } from "react";
import { Lock, Trash2 } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { MODULE_GUIDE, type Act } from "@/lib/role-guide";
import { ACTS, EDITABLE_MODULES, blocked, type Base, type PermSet, type ProfileDef } from "@/lib/roles";
import type { ProfileState } from "@/app/(app)/admin/perfiles/actions";

const ACT_LABEL: Record<Act, string> = { read: "Ver", create: "Crear", update: "Modificar", delete: "Eliminar" };

/** Grupos para que la lista se lea de un vistazo. */
const GROUPS: { title: string; modules: string[] }[] = [
  { title: "Partidos", modules: ["matches"] },
  { title: "Plantilla", modules: ["squad", "squad_private"] },
  { title: "Sorteos", modules: ["lottery_sell", "lottery_admin"] },
  { title: "Finanzas", modules: ["finances"] },
  { title: "Patrocinadores", modules: ["sponsors"] },
  { title: "La Voz del Rayo", modules: ["news"] },
  { title: "Gestión", modules: ["users"] },
];

const flat = (p: PermSet) =>
  Object.fromEntries(EDITABLE_MODULES.flatMap((m) => ACTS.map((a) => [`${m}.${a}`, Boolean(p[m]?.[a])])));

export function ProfileEditor({ action, deleteAction, def, templates, count }: {
  action: (s: ProfileState, f: FormData) => Promise<ProfileState>;
  deleteAction?: () => Promise<ProfileState>;
  def: ProfileDef | null;
  templates: Record<string, PermSet>;
  count: number;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const isNew = !def;
  const showName = isNew || def.custom;
  const [base, setBase] = useState<Base>(def?.base ?? "player");
  const [on, setOn] = useState<Record<string, boolean>>(flat(def?.perms ?? templates.player ?? {}));
  const [pending, start] = useTransition();
  const [delState, setDelState] = useState<ProfileState>();

  const pickBase = (b: Base) => { setBase(b); setOn(flat(templates[b] ?? {})); };
  const toggle = (m: string, a: Act, value: boolean) =>
    setOn((o) => {
      const next = { ...o, [`${m}.${a}`]: value };
      // Para crear, modificar o eliminar hace falta poder verlo; sin verlo, no se puede hacer nada más
      if (value && a !== "read") next[`${m}.read`] = true;
      if (!value && a === "read") for (const x of ACTS) next[`${m}.${x}`] = false;
      return next;
    });

  return (
    <form action={formAction} className="space-y-6">
      {showName && (
        <fieldset className="card grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Datos del perfil</legend>
          <div>
            <label className="label" htmlFor="name">Nombre del perfil</label>
            <input id="name" name="name" required minLength={2} maxLength={40} defaultValue={def?.name ?? ""} className="input" placeholder="Ej.: Entrenador" />
          </div>
          <div>
            <label className="label" htmlFor="description">¿Para quién es?</label>
            <input id="description" name="description" maxLength={300} defaultValue={def?.description ?? ""} className="input" placeholder="Ej.: Quien hace las convocatorias y las actas" />
          </div>
          <div className="sm:col-span-2">
            <span className="label">Parte de</span>
            {isNew ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["player", "Jugador", "Para gente del equipo. Nunca podrá ver Finanzas ni los datos personales de otros."],
                  ["admin", "Gestor", "Para gente de la directiva. Puede tener acceso a todo menos a la auditoría."],
                ] as const).map(([v, t, h]) => (
                  <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${base === v ? "border-rojo bg-rojo/5" : "border-negro/10"}`}>
                    <input type="radio" name="base" value={v} checked={base === v} onChange={() => pickBase(v)} className="mt-1 accent-rojo" />
                    <span><span className="block font-bold">{t}</span><span className="block text-sm text-negro/60">{h}</span></span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-negro/70">
                <b>{base === "admin" ? "Gestor" : "Jugador"}</b>.{" "}
                {base === "player" ? "Nunca podrá ver Finanzas ni los datos personales de otros." : "Puede tener acceso a todo menos a la auditoría."}{" "}
                La base no se puede cambiar: si necesitas otra, crea un perfil nuevo.
              </p>
            )}
          </div>
        </fieldset>
      )}

      <div className="space-y-4">
        {GROUPS.map((g) => (
          <section key={g.title} className="card">
            <h2 className="mb-3">{g.title}</h2>
            <div className="space-y-3">
              {g.modules.map((m) => {
                const guide = MODULE_GUIDE[m];
                const acts = ACTS.filter((a) => guide?.acts[a]);
                const isBlocked = blocked(base, m);
                return (
                  <fieldset key={m} disabled={isBlocked} className="rounded-xl bg-gris/70 p-3">
                    <legend className="sr-only">{guide?.title ?? m}</legend>
                    <div className="mb-2 font-bold">{(guide?.title ?? m).replace(/ \(nunca para jugadores\)/, "")}</div>
                    {isBlocked ? (
                      <p className="flex items-start gap-1.5 text-sm text-negro/65"><Lock size={15} className="mt-0.5 shrink-0" /> Nunca para jugadores (regla del club).</p>
                    ) : (
                      <ul className="space-y-2">
                        {acts.map((a) => (
                          <li key={a}>
                            <label className="flex cursor-pointer items-start gap-3">
                              <input type="checkbox" name={`${m}.${a}`} checked={on[`${m}.${a}`] ?? false}
                                onChange={(e) => toggle(m, a, e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-rojo" />
                              <span className="text-sm">
                                <b>{ACT_LABEL[a]}</b> <span className="text-negro/70">· {guide.acts[a]}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </fieldset>
                );
              })}
            </div>
          </section>
        ))}
        <p className="flex items-start gap-1.5 text-xs text-negro/65">
          <Lock size={14} className="mt-0.5 shrink-0" /> La auditoría y la copia de seguridad son siempre y solo del superadministrador.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {deleteAction ? (
          <div className="space-y-2">
            <button type="button" disabled={pending} className="btn-ghost text-rojo"
              onClick={() => {
                const who = count === 0 ? "Nadie tiene este perfil." : `${count === 1 ? "La persona que lo tiene vuelve" : `Las ${count} personas que lo tienen vuelven`} a ${base === "admin" ? "Gestor" : "Jugador"}.`;
                if (confirm(`¿Eliminar el perfil «${def?.name}»? ${who}`)) start(async () => setDelState(await deleteAction()));
              }}>
              <Trash2 size={16} /> {pending ? "Eliminando…" : "Eliminar perfil"}
            </button>
            <FormMessage state={delState} />
          </div>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-3">
          <FormMessage state={state} />
          <SubmitButton className="btn-primary">{isNew ? "Crear perfil" : "Guardar"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
