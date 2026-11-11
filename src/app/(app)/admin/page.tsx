import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, DatabaseBackup, Handshake, IdCard, ScrollText, Users, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProfileDefs } from "@/lib/roles";
import { madridDay } from "@/lib/dates";
import { madridDayRange } from "@/lib/audit";
import { seasonOf } from "@/lib/finance";
import { fecha } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Gestión" };

type Folder = {
  href: string; title: string; icon: LucideIcon; tab: string;
  value: string | number; unit: string; detail?: string;
};

/** Mesa del despacho: un cajón por cada sección de Gestión, con lo más importante a la vista. */
export default async function OfficeDesk() {
  const s = await getSession();
  const isSuper = s.profile.role === "superadmin";
  const canUsers = s.can("users");
  const canSponsors = s.can("sponsors");
  const canNotices = s.can("users", "update") || s.can("lottery_admin", "update");
  if (!canUsers && !canSponsors && !canNotices && !isSuper) redirect("/?error=permiso");

  const supabase = await createClient();
  const admin = createAdminClient();
  const season = seasonOf();
  const none = Promise.resolve(null);
  const [people, defs, custom, sponsors, deals, subs, lastNotice, openPolls, todayLog, lastBackup] = await Promise.all([
    canUsers ? supabase.from("profiles").select("active") : none,
    canUsers ? fetchProfileDefs(supabase) : none,
    canUsers ? supabase.from("user_permissions").select("user_id") : none,
    canSponsors ? supabase.from("sponsors").select("id", { count: "exact", head: true }).eq("active", true) : none,
    canSponsors ? supabase.from("sponsor_agreements").select("id", { count: "exact", head: true }).eq("season", season).eq("status", "signed") : none,
    canNotices ? admin.from("push_subscriptions").select("user_id") : none,
    canNotices ? supabase.from("push_log").select("title, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle() : none,
    canNotices ? supabase.from("polls").select("id", { count: "exact", head: true }).gt("closes_at", new Date().toISOString()) : none,
    isSuper ? supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", madridDayRange(madridDay(), "start")!) : none,
    isSuper ? supabase.from("audit_log").select("created_at").eq("action", "BACKUP").order("created_at", { ascending: false }).limit(1).maybeSingle() : none,
  ]);

  const folders: Folder[] = [];
  if (canUsers) {
    const rows = people?.data ?? [];
    const off = rows.filter((p) => !p.active).length;
    folders.push({ href: "/admin/usuarios", title: "Usuarios", icon: Users, tab: "var(--color-rojo)", value: rows.length - off, unit: rows.length - off === 1 ? "persona con acceso" : "personas con acceso",
      detail: off ? `${off} sin acceso` : "Fichero de carnets del club" });
    const customized = new Set((custom?.data ?? []).map((c) => c.user_id)).size;
    folders.push({ href: "/admin/perfiles", title: "Perfiles", icon: IdCard, tab: "var(--color-dorado)", value: defs?.length ?? 0, unit: "perfiles",
      detail: customized ? `${customized} ${customized === 1 ? "persona" : "personas"} con permisos a medida` : "Qué hace y qué ve cada uno" });
  }
  if (canSponsors) {
    folders.push({ href: "/admin/patrocinadores", title: "Patrocinadores", icon: Handshake, tab: "var(--color-negro)", value: sponsors?.count ?? 0, unit: "patrocinadores actuales",
      detail: `${deals?.count ?? 0} ${deals?.count === 1 ? "acuerdo firmado" : "acuerdos firmados"} en ${season}` });
  }
  if (canNotices) {
    const withPush = new Set((subs?.data ?? []).map((r) => r.user_id)).size;
    const last = lastNotice?.data;
    folders.push({ href: "/admin/avisos", title: "Avisos", icon: BellRing, tab: "var(--color-rojo)", value: withPush, unit: withPush === 1 ? "persona con avisos" : "personas con avisos",
      detail: openPolls?.count ? `${openPolls.count} ${openPolls.count === 1 ? "votación abierta" : "votaciones abiertas"}` : last ? `Último: ${last.title}` : "Tablón de anuncios del equipo" });
  }
  if (isSuper) {
    folders.push({ href: "/admin/auditoria", title: "Auditoría", icon: ScrollText, tab: "var(--color-dorado)", value: todayLog?.count ?? 0, unit: todayLog?.count === 1 ? "anotación hoy" : "anotaciones hoy",
      detail: "Libro de registro: quién cambió qué" });
    const b = lastBackup?.data;
    folders.push({ href: "/admin/copia", title: "Copia de seguridad", icon: DatabaseBackup, tab: "var(--color-negro)", value: b ? fecha(b.created_at) : "Nunca", unit: "última copia",
      detail: "Archivador con todos los datos" });
  }

  return (
    <>
      <PageHeader title="Mesa del despacho" subtitle="Todo lo que se lleva desde la directiva, a mano. Abre la carpeta que necesites." />
      <ul className="stagger grid gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {folders.map((f) => (
          <li key={f.href}>
            <Link href={f.href} prefetch style={{ "--tab": f.tab } as React.CSSProperties}
              className="card desk-folder group flex h-full items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gris text-rojo ring-1 ring-black/5 transition group-hover:bg-rojo group-hover:text-white">
                <f.icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="sport text-lg font-black leading-tight group-hover:text-rojo">{f.title}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="sport text-3xl font-black leading-none tabular-nums">{f.value}</span>
                  <span className="text-xs font-semibold text-negro/60">{f.unit}</span>
                </p>
                {f.detail && <p className="mt-1.5 truncate text-xs text-negro/65">{f.detail}</p>}
              </div>
              <span aria-hidden className="self-center text-negro/30 transition group-hover:translate-x-0.5 group-hover:text-rojo">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
