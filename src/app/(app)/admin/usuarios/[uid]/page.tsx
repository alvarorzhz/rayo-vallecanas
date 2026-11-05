import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { UserEditForm } from "@/components/admin-forms";
import { setUserAccess, updateUser } from "../actions";
import { Lock, LockOpen } from "lucide-react";

export const metadata = { title: "Usuario" };
const MODULES = ["lottery_admin", "lottery_sell", "users", "finances", "squad", "matches"];

export default async function UserPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const s = await requirePerm("users", "read");
  const supabase = await createClient();
  const [{ data: profile }, { data: rolePerms }, { data: userPerms }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase.from("role_permissions").select("*"),
    supabase.from("user_permissions").select("*").eq("user_id", uid),
  ]);
  if (!profile) notFound();
  const isSuper = s.profile.role === "superadmin";
  const canEdit = s.can("users", "update") && (isSuper || profile.role !== "superadmin");
  const roles = ["player", "admin", ...(isSuper || profile.role === "superadmin" ? ["superadmin"] : [])];

  return (
    <>
      <PageHeader title={profile.full_name} subtitle={profile.email} back={{ href: "/admin/usuarios", label: "Usuarios" }} />
      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-4 ${profile.active ? "" : "ring-2 ring-rojo/40"}`}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2">
            {profile.active ? <LockOpen size={18} className="text-green-700" /> : <Lock size={18} className="text-rojo" />}
            Acceso a la app: {profile.active ? "habilitado" : "deshabilitado"}
          </h2>
          <p className="mt-1 text-sm text-negro/60">
            {profile.active
              ? "Si lo deshabilitas, no podrá entrar en la app hasta que lo vuelvas a habilitar. No se borra nada: sus ventas y datos se conservan."
              : "No puede entrar en la app. Sus ventas y datos se conservan. Habilítalo cuando quieras que vuelva a tener acceso."}
          </p>
        </div>
        {canEdit && uid !== s.user.id && (
          <form action={setUserAccess.bind(null, uid, !profile.active)}>
            <button className={profile.active ? "btn-dark" : "btn-primary"}>
              {profile.active ? <><Lock size={16} /> Deshabilitar acceso</> : <><LockOpen size={16} /> Habilitar acceso</>}
            </button>
          </form>
        )}
        {uid === s.user.id && <p className="text-xs text-negro/50">Es tu propio usuario: no puedes deshabilitarlo.</p>}
      </section>
      <UserEditForm
        action={updateUser.bind(null, uid)}
        profile={profile}
        roles={roles}
        modules={MODULES}
        rolePerms={rolePerms ?? []}
        userPerms={userPerms ?? []}
        canEdit={canEdit}
      />
    </>
  );
}
