import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, CheckCircle2, ShieldCheck, Shirt, Users, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProfileDefs } from "@/lib/roles";
import { madridDay } from "@/lib/dates";
import { madridDayRange } from "@/lib/audit";
import { fecha } from "@/lib/format";
import { OfficePlaque } from "@/components/admin-office";
import { shortfall, tally, type MaterialLot } from "@/lib/material";

export const metadata = { title: "Gestión" };

type Folder = {
  href: string; title: string; icon: LucideIcon; tab: string;
  value: string | number; unit: string; detail?: string; alert?: string; parts?: string[];
};
type Todo = { href: string; text: string };

/**
 * Mesa del despacho. 4.30.0 · Cuatro cajones (Equipo, Avisos, Material, Control) y, arriba,
 * «Para hoy» con lo que pide atención. Los patrocinadores pasaron a Finanzas.
 */
export default async function OfficeDesk() {
  const s = await getSession();
  const isSuper = s.profile.role === "superadmin";
  const canUsers = s.can("users");
  const canNotices = s.can("users", "update") || s.can("lottery_admin", "update");
  const canMaterial = s.can("material");
  if (!canUsers && !canNotices && !canMaterial && !isSuper) redirect(s.can("sponsors") ? "/finanzas/patrocinadores" : "/?error=permiso");

  const supabase = await createClient();
  const admin = createAdminClient();
  const none = Promise.resolve(null);
  const [people, defs, custom, subs, lastNotice, openPolls, todayLog, lastBackup, usage7, material] = await Promise.all([
    canUsers ? supabase.from("profiles").select("active").is("removed_at", null) : none,
    canUsers ? fetchProfileDefs(supabase) : none,
    canUsers ? supabase.from("user_permissions").select("user_id") : none,
    canNotices ? admin.from("push_subscriptions").select("user_id") : none,
    canNotices ? supabase.from("push_log").select("title, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle() : none,
    canNotices ? supabase.from("polls").select("id", { count: "exact", head: true }).gt("closes_at", new Date().toISOString()) : none,
    isSuper ? supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", madridDayRange(madridDay(), "start")!) : none,
    isSuper ? supabase.from("audit_log").select("created_at").eq("action", "BACKUP").order("created_at", { ascending: false }).limit(1).maybeSingle() : none,
    isSuper ? supabase.from("usage_daily").select("user_id").gte("day", madridDay(new Date(Date.now() - 6 * 86400_000))) : none,
    canMaterial ? fetchMaterialDesk(supabase) : none,
  ]);

  const folders: Folder[] = [];
  const todo: Todo[] = [];
  if (canUsers) {
    const rows = people?.data ?? [];
    const off = rows.filter((p) => !p.active).length;
    const customized = new Set((custom?.data ?? []).map((c) => c.user_id)).size;
    folders.push({ href: "/admin/usuarios", title: "Equipo", icon: Users, tab: "var(--color-rojo)", value: rows.length - off, unit: rows.length - off === 1 ? "persona con acceso" : "personas con acceso",
      detail: [off ? `${off} sin acceso` : null, `${defs?.length ?? 0} perfiles`, customized ? `${customized} con permisos a medida` : null].filter(Boolean).join(" · "),
      parts: ["Altas y accesos", "Perfiles y permisos"] });
  }
  if (canNotices) {
    const withPush = new Set((subs?.data ?? []).map((r) => r.user_id)).size;
    const last = lastNotice?.data;
    const polls = openPolls?.count ?? 0;
    folders.push({ href: "/admin/avisos", title: "Avisos", icon: BellRing, tab: "var(--color-rojo)", value: withPush, unit: withPush === 1 ? "persona con avisos" : "personas con avisos activados",
      detail: last ? `Último: ${last.title}` : "Manda un aviso o lanza una votación", parts: ["Aviso", "Votación sí/no"] });
    if (polls) todo.push({ href: "/votaciones", text: `${polls} ${polls === 1 ? "votación abierta" : "votaciones abiertas"}` });
  }
  if (canMaterial && material) {
    folders.push({ href: "/admin/material", title: "Material", icon: Shirt, tab: "var(--color-dorado)", value: material.usable, unit: material.usable === 1 ? "pieza en buen estado" : "piezas en buen estado",
      detail: material.items ? `${material.items} ${material.items === 1 ? "artículo" : "artículos"} en el almacén` : "El almacén del club",
      alert: material.short ? `Falta material en ${material.short} ${material.short === 1 ? "artículo" : "artículos"}` : undefined });
    if (material.short) todo.push({ href: "/admin/material", text: `Falta material en ${material.short} ${material.short === 1 ? "artículo" : "artículos"} del almacén` });
  }
  if (isSuper) {
    const active7 = new Set((usage7?.data ?? []).map((r) => r.user_id)).size;
    const b = lastBackup?.data;
    folders.push({ href: "/admin/uso", title: "Control", icon: ShieldCheck, tab: "var(--color-negro)", value: active7, unit: active7 === 1 ? "persona esta semana" : "personas esta semana",
      detail: `${todayLog?.count ?? 0} ${todayLog?.count === 1 ? "cambio" : "cambios"} hoy · última copia ${b ? fecha(b.created_at) : "nunca"}`,
      parts: ["Uso", "Auditoría", "Copia"] });
    // La copia automática sale cada lunes: si pasan más de 8 días, algo ha fallado
    if (!b || Date.now() - new Date(b.created_at).getTime() > 8 * 86400_000)
      todo.push({ href: "/admin/copia", text: b ? `La última copia de seguridad es del ${fecha(b.created_at)}` : "Aún no hay ninguna copia de seguridad" });
  }

  return (
    <>
      <OfficePlaque />
      <section aria-label="Para hoy" className={`mb-5 rounded-2xl px-4 py-3 ring-1 ${todo.length ? "bg-dorado/15 ring-dorado/50" : "bg-white ring-black/5"}`}>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-negro/60">Para hoy</p>
        {todo.length ? (
          <ul className="mt-1 space-y-1">
            {todo.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} prefetch className="group flex items-center gap-2 text-sm font-semibold hover:text-rojo">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-rojo" />
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <span aria-hidden className="text-negro/30 transition group-hover:translate-x-0.5 group-hover:text-rojo">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-negro/70"><CheckCircle2 size={16} className="text-green-700" /> Todo en orden, nada pendiente.</p>
        )}
      </section>
      <ul className="stagger grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {folders.map((f) => (
          <li key={f.href}>
            <Link href={f.href} prefetch style={{ "--tab": f.tab } as React.CSSProperties}
              className="card desk-folder group flex h-full items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gris text-rojo ring-1 ring-black/5 transition group-hover:bg-rojo group-hover:text-white">
                <f.icon size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="sport text-xl font-black leading-tight group-hover:text-rojo">{f.title}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="sport text-3xl font-black leading-none tabular-nums">{f.value}</span>
                  <span className="text-xs font-semibold text-negro/60">{f.unit}</span>
                </p>
                {f.alert && <p className="mt-1.5 text-xs font-bold text-rojo">{f.alert}</p>}
                {f.detail && <p className="mt-1.5 truncate text-xs text-negro/65">{f.detail}</p>}
                {f.parts && (
                  <p className="mt-2 flex flex-wrap gap-1">
                    {f.parts.map((p) => <span key={p} className="rounded-full bg-gris px-2 py-0.5 text-[11px] font-bold text-negro/70">{p}</span>)}
                  </p>
                )}
              </div>
              <span aria-hidden className="self-center text-negro/30 transition group-hover:translate-x-0.5 group-hover:text-rojo">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Cajón de Material en la mesa: piezas útiles y cuántos artículos están por debajo del mínimo. */
async function fetchMaterialDesk(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: items }, { data: lots }] = await Promise.all([
    supabase.from("material_items").select("id, min_qty"),
    supabase.from("material_lots").select("item_id, qty, condition, holder_player_id"),
  ]);
  const all = (lots ?? []) as (Pick<MaterialLot, "item_id" | "qty" | "condition" | "holder_player_id">)[];
  const list = (items ?? []) as { id: string; min_qty: number | null }[];
  return {
    items: list.length,
    usable: tally(all).usable,
    short: list.filter((it) => shortfall(it, tally(all.filter((l) => l.item_id === it.id))) > 0).length,
  };
}
