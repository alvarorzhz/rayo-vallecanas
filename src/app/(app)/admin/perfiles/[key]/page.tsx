import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ProfileEditor } from "@/components/profile-editor";
import { fetchProfileDefs, profileKey } from "@/lib/roles";
import { deleteProfile, saveProfile } from "../actions";

export const metadata = { title: "Editar perfil" };

export default async function ProfileEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const s = await requirePerm("users", "read");
  if (s.profile.role !== "superadmin") redirect("/admin/perfiles");
  if (key === "superadmin") redirect("/admin/perfiles");
  const supabase = await createClient();
  const [defs, { data: people }] = await Promise.all([
    fetchProfileDefs(supabase),
    supabase.from("profiles").select("role, custom_role_id, active"),
  ]);
  const isNew = key === "nuevo";
  const def = isNew ? null : defs.find((d) => d.key === key);
  if (!isNew && !def) notFound();
  const count = (people ?? []).filter((p) => p.active && profileKey(p) === key).length;
  const templates = Object.fromEntries(defs.filter((d) => d.key === "admin" || d.key === "player").map((d) => [d.key, d.perms]));

  return (
    <>
      <PageHeader
        title={isNew ? "Nuevo perfil" : `Perfil: ${def!.name}`}
        subtitle={isNew
          ? "Crea un perfil con nombre propio (Entrenador, Delegado, Tesorero…) y marca lo que puede hacer."
          : `${count} ${count === 1 ? "persona tiene" : "personas tienen"} este perfil. Lo que cambies se les aplica al momento.`}
        back={{ href: "/admin/perfiles", label: "Perfiles" }}
      />
      <ProfileEditor
        action={saveProfile.bind(null, key)}
        deleteAction={def?.custom ? deleteProfile.bind(null, key) : undefined}
        def={def ?? null}
        templates={templates}
        count={count}
      />
    </>
  );
}
