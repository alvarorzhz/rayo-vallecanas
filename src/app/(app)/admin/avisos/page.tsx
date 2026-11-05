import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { NoticeForm } from "@/components/notice-form";
import { sendNotice } from "./actions";

export const metadata = { title: "Avisos" };

export default async function NoticesPage() {
  const s = await getSession();
  if (!s.can("users", "update") && !s.can("lottery_admin", "update")) redirect("/?error=permiso");
  const admin = createAdminClient();
  const [{ data: subs }, { count: people }] = await Promise.all([
    admin.from("push_subscriptions").select("user_id"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  const withPush = new Set((subs ?? []).map((r) => r.user_id)).size;
  return (
    <>
      <PageHeader title="Avisos" subtitle="Manda una notificación al móvil de los miembros del equipo." />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="card"><NoticeForm action={sendNotice} /></section>
        <aside className="card space-y-2 text-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-negro/50">Avisos activados</div>
          <div className="text-3xl font-black">{withPush} <span className="text-base font-semibold text-negro/50">de {people ?? 0} personas</span></div>
          <p className="text-negro/60">A cada persona le pregunta la app al entrar. También se activan en <b>Mi perfil</b>.</p>
          <p className="text-negro/60">La app avisa sola cuando se abre un sorteo (a sus vendedores), con cada venta (a los gestores) y cuando sale el número ganador.</p>
        </aside>
      </div>
    </>
  );
}
