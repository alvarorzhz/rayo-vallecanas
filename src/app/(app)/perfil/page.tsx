import { getSession } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { AvatarUpload } from "@/components/avatar-upload";
import { PushSettings } from "@/components/push-settings";
import { removeAvatar, uploadAvatar } from "./actions";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const s = await getSession();
  const p = s.profile;
  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tu foto aparece en el menú y en la lista de usuarios." />
      <div className="mx-auto max-w-md space-y-6">
        <section className="card">
          <AvatarUpload name={p.full_name} url={p.avatar_url} upload={uploadAvatar} remove={removeAvatar} />
        </section>
        <section className="card">
          <h2 className="mb-3 font-bold">Avisos (notificaciones)</h2>
          <PushSettings isManager={s.can("lottery_admin", "update")} notifySales={p.notify_sales} />
        </section>
        <section className="card">
          <dl className="divide-y divide-black/5 text-sm">
            {[
              ["Nombre", p.full_name],
              ["Perfil", ROLE_LABEL[p.role] ?? p.role],
              ["Email", p.email ?? "—"],
              ["Teléfono", p.phone ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-negro/60">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-negro/50">Para cambiar tu nombre o teléfono, pídeselo a un gestor.</p>
        </section>
      </div>
    </>
  );
}
