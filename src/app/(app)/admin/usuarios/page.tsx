import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileDefs, profileKey } from "@/lib/roles";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/ui";
import { bandOf } from "@/components/admin-office";
import { InviteForm } from "@/components/admin-forms";
import { inviteUser } from "./actions";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const s = await requirePerm("users", "read");
  const supabase = await createClient();
  const [{ data: users }, defs] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, role, custom_role_id, active, avatar_url").order("full_name"),
    fetchProfileDefs(supabase),
  ]);
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const profiles = defs.filter((d) => d.key !== "superadmin" || s.profile.role === "superadmin")
    .map(({ key, name, base, perms }) => ({ key, name, base, perms }));

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestores y jugadores con acceso a la aplicación. Pulsa en una persona para cambiar su perfil, sus permisos o deshabilitar su acceso."
        actions={<Link href="/admin/perfiles" prefetch className="btn-ghost"><BookOpen size={16} /> Qué hace cada perfil</Link>}
      />
      {s.can("users", "create") && (
        <section className="card mb-6">
          <h2 className="mb-1 font-bold">Dar de alta</h2>
          <p className="mb-4 text-sm text-negro/65">Elige cómo le das acceso. Lo más sencillo es la contraseña provisional.</p>
          <InviteForm action={inviteUser} profiles={profiles} />
        </section>
      )}
      {/* Fichero de carnets del club: uno por persona */}
      <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(users ?? []).map((u, i) => {
          const def = byKey.get(profileKey(u));
          return (
            <li key={u.id}>
              <Link href={`/admin/usuarios/${u.id}`} prefetch className="card carnet group flex h-full items-stretch gap-0 overflow-hidden p-0 sm:p-0">
                <span aria-hidden className={`w-2 shrink-0 ${bandOf(def?.base ?? u.role).split(" ")[0]}`} />
                <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
                  <Avatar name={u.full_name} url={u.avatar_url} size={48} className={u.active ? "" : "opacity-40 grayscale"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold group-hover:text-rojo">{u.full_name}</div>
                    <div className="truncate text-xs text-negro/65">{u.email}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`badge ${bandOf(def?.base ?? u.role)}`}>{def?.name ?? u.role}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-negro/40">Ficha nº {String(i + 1).padStart(3, "0")}</span>
                    </div>
                  </div>
                  {!u.active && <span className="ink-stamp shrink-0 text-[11px] text-rojo">Sin acceso</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
