import Link from "next/link";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { InviteForm } from "@/components/admin-forms";
import { inviteUser } from "./actions";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const s = await requirePerm("users", "read");
  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("id, full_name, email, phone, role, active").order("full_name");
  const roles = ["player", "coach", "admin", ...(s.profile.role === "superadmin" ? ["superadmin"] : [])];

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Directiva y jugadores con acceso a la aplicación" />
      {s.can("users", "create") && (
        <section className="card mb-6">
          <h2 className="mb-1 font-bold">Dar de alta</h2>
          <p className="mb-4 text-sm text-negro/50">Recibirá un email para crear su contraseña.</p>
          <InviteForm action={inviteUser} roles={roles} />
        </section>
      )}
      <section className="card">
        <ul className="divide-y divide-black/5">
          {(users ?? []).map((u) => (
            <li key={u.id}>
              <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-3 py-3 hover:text-rojo">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-negro text-sm font-bold text-white">
                  {u.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{u.full_name}{!u.active && <span className="ml-2 badge bg-black/10">Inactivo</span>}</div>
                  <div className="truncate text-xs text-negro/50">{u.email}</div>
                </div>
                <span className={`badge ${u.role === "player" ? "bg-gris" : "bg-dorado/25"}`}>{ROLE_LABEL[u.role]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
