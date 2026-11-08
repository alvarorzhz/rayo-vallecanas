import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, Vote } from "lucide-react";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { NoticeCatalog, NoticeHistory, type LogRow } from "@/components/notice-panels";
import { NoticeForm } from "@/components/notice-form";
import { PollForm } from "@/components/polls/poll-forms";
import { createPoll } from "@/app/(app)/votaciones/actions";
import { areaOf, type NoticeArea } from "@/lib/notifications";
import { sendNotice } from "./actions";

export const metadata = { title: "Avisos" };


export default async function NoticesPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const s = await getSession();
  if (!s.can("users", "update") && !s.can("lottery_admin", "update")) redirect("/?error=permiso");
  const isPoll = tipo === "votacion";
  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data: subs }, { count: people }, { data: log }, { count: openPolls }] = await Promise.all([
    admin.from("push_subscriptions").select("user_id"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("push_log").select("*").order("created_at", { ascending: false }).limit(60).returns<LogRow[]>(),
    supabase.from("polls").select("id", { count: "exact", head: true }).gt("closes_at", new Date().toISOString()),
  ]);
  const withPush = new Set((subs ?? []).map((r) => r.user_id)).size;

  // Cada uno ve en el historial solo los avisos de lo que puede ver (los de ventas o patrocinios llevan importes)
  const sees: Record<NoticeArea, boolean> = {
    manual: true, polls: true, matches: s.can("matches"), league: s.can("matches"), lottery: s.can("lottery_admin"), sponsors: s.can("sponsors"),
  };
  const recent = (log ?? []).filter((r) => sees[areaOf(r.url, r.tag)]).slice(0, 25);

  const tab = (on: boolean) => `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition sm:flex-none ${on ? "bg-negro text-white shadow" : "text-negro/70 hover:text-rojo"}`;

  return (
    <>
      <PageHeader title="Avisos" subtitle="Manda una notificación o lanza una votación al móvil de los miembros del equipo."
        actions={<Link href="/votaciones" prefetch className="btn-ghost px-3 py-1.5 text-sm"><Vote size={15} className="text-rojo" /> Ver votaciones{openPolls ? ` (${openPolls} abierta${openPolls > 1 ? "s" : ""})` : ""}</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="card space-y-4">
          <div role="tablist" className="flex gap-1 rounded-xl bg-gris p-1">
            <Link href="/admin/avisos" replace scroll={false} role="tab" aria-selected={!isPoll} className={tab(!isPoll)}><BellRing size={15} /> Aviso</Link>
            <Link href="/admin/avisos?tipo=votacion" replace scroll={false} role="tab" aria-selected={isPoll} className={tab(isPoll)}><Vote size={15} /> Votación sí/no</Link>
          </div>
          {isPoll ? <PollForm action={createPoll} /> : <NoticeForm action={sendNotice} />}
        </section>
        <aside className="card space-y-2 text-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-negro/65">Avisos activados</div>
          <div className="text-3xl font-black">{withPush} <span className="text-base font-semibold text-negro/65">de {people ?? 0} personas</span></div>
          <p className="text-negro/60">A cada persona le pregunta la app al entrar. También se activan en <b>Mi perfil</b>.</p>
          <p className="text-negro/60">Abajo tienes los avisos que manda la app sola y los últimos que han salido.</p>
        </aside>
      </div>

      <NoticeHistory rows={recent} />
      <NoticeCatalog />
    </>
  );
}
