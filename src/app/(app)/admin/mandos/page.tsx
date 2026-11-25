import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileDefs } from "@/lib/roles";
import { fecha } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { BannerForm, MaintenanceForm, ModulesForm, SessionsAndVersion, ViewAsForm } from "@/components/admin/mandos-forms";
import { isoToMadridLocal } from "@/lib/app-settings";

export const metadata = { title: "Mandos de la app" };

/**
 * 4.31.0 · Gestión → Control → Mandos (solo superadministrador): mantenimiento, mensaje fijo para todos,
 * apartados apagados, cerrar sesión a todos, forzar actualización y ver la app como otro perfil.
 */
export default async function ControlsPage() {
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const supabase = await createClient();
  const [{ data: sessions }, defs] = await Promise.all([
    supabase.rpc("admin_sessions"),
    fetchProfileDefs(supabase),
  ]);
  const others = ((sessions ?? []) as { user_id: string }[]).filter((x) => x.user_id !== s.user.id);
  const st = s.settings;
  return (
    <>
      <PageHeader title="Mandos de la app" subtitle="Lo que afecta a la app entera y a todo el mundo. Cada cambio queda en la auditoría." />
      <div className="grid gap-5 lg:grid-cols-2">
        <MaintenanceForm on={st.maintenance} message={st.maintenance_message ?? ""} until={isoToMadridLocal(st.maintenance_until)} closePublic={st.maintenance_public} />
        <BannerForm text={st.banner_text ?? ""} tone={st.banner_tone} until={isoToMadridLocal(st.banner_until)}
          expired={!!st.banner_text && !!st.banner_until && new Date(st.banner_until).getTime() <= Date.now()} />
        <ModulesForm off={st.modules_off} />
        <SessionsAndVersion openOthers={new Set(others.map((x) => x.user_id)).size} openSessions={others.length}
          lastReload={st.reload_at ? fecha(st.reload_at, true) : null} />
        <ViewAsForm profiles={defs.filter((d) => d.base !== "superadmin").map((d) => ({ key: d.key, name: d.name, custom: d.custom }))} />
      </div>
    </>
  );
}
