import Link from "next/link";
import { Check, Eye, Lock, Pencil, Plus, Wrench } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { bandOf } from "@/components/admin-office";
import { MENU_BY_MODULE, MODULE_GUIDE, ROLE_INFO } from "@/lib/role-guide";
import { ACTS, allows, fetchProfileDefs, profileKey } from "@/lib/roles";

export const metadata = { title: "Perfiles y permisos" };

export default async function ProfilesGuide({ searchParams }: { searchParams: Promise<{ guardado?: string; borrado?: string }> }) {
  const s = await requirePerm("users", "read");
  const sp = await searchParams;
  const isSuper = s.profile.role === "superadmin";
  const supabase = await createClient();
  const [defs, { data: people }, { data: custom }] = await Promise.all([
    fetchProfileDefs(supabase),
    supabase.from("profiles").select("role, custom_role_id, active"),
    supabase.from("user_permissions").select("user_id"),
  ]);
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const can = (key: string, module: string, act: (typeof ACTS)[number]) => { const d = byKey.get(key); return d ? allows(d, module, act) : false; };
  const count = (key: string) => (people ?? []).filter((p) => profileKey(p) === key && p.active).length;
  const customUsers = new Set((custom ?? []).map((c) => c.user_id)).size;

  return (
    <>
      <PageHeader
        title="Perfiles y permisos"
        subtitle="Qué hace y qué ve cada perfil en la app. Se lee directamente de los permisos configurados, así que siempre está al día."
        actions={isSuper && <Link href="/admin/perfiles/nuevo" prefetch className="btn-primary"><Plus size={18} /> Nuevo perfil</Link>}
      />
      {sp.guardado && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Perfil guardado. Los cambios ya se aplican a todas sus personas.</p>}
      {sp.borrado && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Perfil eliminado. Sus personas han vuelto a su perfil base.</p>}

      <div className="mb-6 rounded-2xl bg-dorado/15 p-4 text-sm text-negro/80">
        Cada persona tiene un <b>perfil</b> que decide lo que puede hacer. {isSuper
          ? <>Puedes cambiar lo que permite cada perfil con <b>Editar</b>, o crear perfiles nuevos (Entrenador, Delegado, Tesorero…) con <b>Nuevo perfil</b>. </>
          : <>Solo el superadministrador puede cambiar los perfiles o crear otros nuevos. </>}
        Si una persona concreta necesita algo distinto, en su ficha de Usuarios puedes <b>personalizar</b> sus permisos sin cambiarle el perfil.
        {customUsers > 0 && <> Ahora mismo hay <b>{customUsers}</b> {customUsers === 1 ? "persona" : "personas"} con permisos personalizados.</>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {defs.map(({ key: role, name, description, base, custom: isCustom }) => {
          const info = isCustom
            ? { who: description || "Perfil creado a medida.", summary: `Perfil a medida basado en ${ROLE_LABEL[base]}.${base === "player" ? " Como jugador, nunca ve Finanzas, los patrocinios ni los datos personales de otros." : ""}` }
            : ROLE_INFO[role];
          const modules = Object.entries(MODULE_GUIDE).filter(([m, g]) => !g.soon && ACTS.some((a) => can(role, m, a)));
          const soon = Object.entries(MODULE_GUIDE).filter(([m, g]) => g.soon && ACTS.some((a) => can(role, m, a)));
          const menu = MENU_BY_MODULE.filter((x) => can(role, x.module, x.act)).map((x) => x.label);
          const menuUnique = menu.includes("Sorteos (todas las campañas)") ? menu.filter((l) => l !== "Sorteos (sus campañas)") : menu;
          return (
            <section key={role} className={`card overflow-hidden ${role === "superadmin" ? "ring-2 ring-rojo/30" : ""}`}>
              {/* Acreditación: banda del color del perfil con la ranura del cordón */}
              <div aria-hidden className={`-mx-4 -mt-4 mb-4 flex flex-col items-center gap-1.5 pb-2 pt-2.5 sm:-mx-5 sm:-mt-5 ${bandOf(base)}`}>
                <span className="credential-slot" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Acreditación · {ROLE_LABEL[base] ?? base}</span>
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl">{name}</h2>
                <div className="flex items-center gap-2">
                  {isCustom && <span className="badge bg-dorado/25">A medida</span>}
                  <span className="badge bg-negro text-white">{count(role)} {count(role) === 1 ? "persona" : "personas"}</span>
                  {isSuper && role !== "superadmin" && (
                    <Link href={`/admin/perfiles/${role}`} prefetch className="btn-ghost px-3 py-1.5 text-sm" aria-label={`Editar el perfil ${name}`}><Pencil size={15} /> Editar</Link>
                  )}
                </div>
              </div>
              <p className="text-sm text-negro/60">{info.who}</p>
              <p className="mt-2 text-sm font-medium">{info.summary}</p>

              <div className="mt-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">Ve en el menú</h3>
                <div className="flex flex-wrap gap-1.5">
                  <span className="badge bg-gris">Inicio</span>
                  {menuUnique.map((l) => <span key={l} className="badge bg-gris">{l}</span>)}
                  <span className="badge bg-gris">Novedades</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {modules.map(([m, g]) => (
                  <div key={m} className="rounded-xl bg-gris/70 p-3">
                    <div className="mb-1.5 font-bold">{g.title}</div>
                    <ul className="space-y-1.5 text-sm">
                      {ACTS.filter((a) => g.acts[a] && can(role, m, a)).map((a) => (
                        <li key={a} className="flex gap-2">
                          {a === "read" ? <Eye size={16} className="mt-0.5 shrink-0 text-negro/65" /> : <Wrench size={16} className="mt-0.5 shrink-0 text-rojo" />}
                          <span>{g.acts[a]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {role === "superadmin" && (
                  <div className="rounded-xl bg-rojo/5 p-3 text-sm">
                    <div className="mb-1.5 font-bold">Solo superadministrador</div>
                    <ul className="space-y-1.5">
                      {["Archivar, recuperar y eliminar campañas.", "Nombrar a otros superadministradores y modificarlos.", "Ver y hacer todo lo demás, aunque no esté marcado."].map((t) => (
                        <li key={t} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-rojo" /> {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {soon.length > 0 && (
                  <p className="text-xs text-negro/65">Cuando lleguen: {soon.map(([, g]) => g.title).join(", ")}.</p>
                )}
                {role !== "superadmin" && (
                  <p className="flex items-start gap-1.5 text-xs text-negro/65">
                    <Lock size={14} className="mt-0.5 shrink-0" />
                    {base === "admin"
                      ? "No puede archivar ni eliminar campañas, ni ver la auditoría, ni tocar a los superadministradores."
                      : "Nunca ve Finanzas, los patrocinios, los datos personales de otros ni la auditoría."}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card mt-6 min-w-0">
        <h2 className="mb-3">Tabla resumen</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de permisos (desliza para ver más)">
          <table className="table">
            <thead>
              <tr><th>Sección</th>{defs.map((d) => <th key={d.key} className="text-center">{d.name}</th>)}</tr>
            </thead>
            <tbody>
              {Object.entries(MODULE_GUIDE).filter(([, g]) => !g.soon).map(([m, g]) => (
                <tr key={m}>
                  <td className="min-w-40 font-semibold [overflow-wrap:normal]">{g.title}</td>
                  {defs.map(({ key: r }) => {
                    const acts = ACTS.filter((a) => can(r, m, a));
                    const label = acts.length === 0 ? "—" : acts.length === 1 && acts[0] === "read" ? "Ver" : acts.includes("read") ? "Ver y gestionar" : "Gestionar";
                    return <td key={r} className={`whitespace-nowrap text-center text-sm ${acts.length ? "font-semibold" : "text-negro/30"}`}>{label}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-negro/65">
          Para cambiar lo que puede hacer una persona concreta, ve a <Link href="/admin/usuarios" className="font-semibold text-rojo">Usuarios</Link>, pulsa en ella y personaliza sus permisos.
        </p>
      </section>
    </>
  );
}
