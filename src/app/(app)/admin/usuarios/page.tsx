import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileDefs, profileKey } from "@/lib/roles";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/ui";
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
  const nameOf = new Map(defs.map((d) => [d.key, d.name]));
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
      <section className="card">
        <ul className="divide-y divide-black/5">
          {(users ?? []).map((u) => (
            <li key={u.id}>
              <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3 py-3 hover:text-rojo">
                <Avatar name={u.full_name} url={u.avatar_url} size={40} className={u.active ? "" : "opacity-40 grayscale"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{u.full_name}{!u.active && <span className="ml-2 badge bg-rojo text-white">Sin acceso</span>}</div>
                  <div className="truncate text-xs text-negro/65">{u.email}</div>
                </div>
                <span className={`badge ${u.role === "player" ? "bg-gris" : "bg-dorado/25"}`}>{nameOf.get(profileKey(u)) ?? u.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
