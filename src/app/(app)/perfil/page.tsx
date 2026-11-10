import { getSession } from "@/lib/session";
import { Hero, PageHeader } from "@/components/ui";
import { AvatarUpload } from "@/components/avatar-upload";
import { PushSettings } from "@/components/push-settings";
import { TourButton } from "@/components/tour";
import Link from "next/link";
import { Shirt, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { removeAvatar, uploadAvatar } from "./actions";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const s = await getSession();
  const p = s.profile;
  const supabase = await createClient();
  const { data: player } = s.can("squad") ? await supabase.from("players").select("id").eq("user_id", s.user.id).maybeSingle() : { data: null };
  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tu foto aparece en el menú, en la lista de usuarios y en tu ficha de jugador." />
      <div className="mx-auto max-w-md space-y-6">
        <Hero>
          <div className="px-5 pb-5 pt-6 text-center">
            <AvatarUpload name={p.full_name} url={p.avatar_url} upload={uploadAvatar} remove={removeAvatar} dark />
            <div className="sport mt-4 text-3xl leading-none font-black">{p.full_name}</div>
            <div className="mt-2 inline-flex -skew-x-[10deg] rounded bg-dorado px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-negro">{p.role_label}</div>
          </div>
        </Hero>
        {player && (
          <Link href={`/plantilla/${player.id}`} prefetch className="card group flex items-center gap-3 hover:ring-rojo/40">
            <Shirt size={22} className="text-rojo" />
            <span className="flex-1">
              <span className="block font-bold">Mi ficha de jugador</span>
              <span className="block text-xs text-negro/65">Tu dorsal, tu posición y tus datos de contacto</span>
            </span>
            <span className="text-rojo transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        )}
        <Link href="/votaciones" prefetch className="card group flex items-center gap-3 hover:ring-rojo/40">
          <Vote size={22} className="text-rojo" />
          <span className="flex-1">
            <span className="block font-bold">Votaciones</span>
            <span className="block text-xs text-negro/65">Las que están abiertas y los resultados de las anteriores</span>
          </span>
          <span className="text-rojo transition-transform duration-200 group-hover:translate-x-1">→</span>
        </Link>
        <section className="card">
          <h2 className="mb-3 font-bold">Avisos (notificaciones)</h2>
          <PushSettings isManager={s.can("lottery_admin", "update")} notifySales={p.notify_sales} />
        </section>
        <section className="card">
          <dl className="divide-y divide-black/5 text-sm">
            {[
              ["Nombre", p.full_name],
              ["Perfil", p.role_label],
              ["Email", p.email ?? "—"],
              ["Teléfono", p.phone ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-negro/60">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-negro/65">Para cambiar tu nombre o teléfono, pídeselo a un gestor.</p>
        </section>
        <section className="card">
          <h2 className="mb-1 font-bold">Tutorial</h2>
          <p className="mb-3 text-sm text-negro/65">Un recorrido rápido por todas las secciones de la app.</p>
          <TourButton />
        </section>
      </div>
    </>
  );
}
