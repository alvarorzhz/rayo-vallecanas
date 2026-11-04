import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { UserEditForm } from "@/components/admin-forms";
import { updateUser } from "../actions";

export const metadata = { title: "Usuario" };
const MODULES = ["lottery_admin", "lottery_sell", "users", "audit", "finances", "squad", "matches"];

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
  const roles = ["player", "coach", "admin", ...(isSuper || profile.role === "superadmin" ? ["superadmin"] : [])];

  return (
    <>
      <PageHeader title={profile.full_name} subtitle={profile.email} back={{ href: "/admin/usuarios", label: "Usuarios" }} />
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
