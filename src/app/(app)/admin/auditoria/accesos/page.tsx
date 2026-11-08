import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fecha } from "@/lib/format";
import { ACCESS_EVENT_LABEL, ACCESS_EVENT_TONE, madridDayRange } from "@/lib/audit";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { Pager } from "@/components/pager";
import { AuditTabs } from "@/components/audit/audit-tabs";
import { DeviceLabel } from "@/components/audit/device-label";

export const metadata = { title: "Auditoría · Accesos" };
const PAGE = 50;

type SP = { p?: string; e?: string; u?: string; desde?: string; hasta?: string };
type Access = { id: number; user_id: string | null; email: string | null; event: string; ip: string | null; user_agent: string | null; detail: string | null; created_at: string };

export default async function AccessPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.p) || 1);

  let q = supabase.from("access_log").select("id, user_id, email, event, ip, user_agent, detail, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.e === "in") q = q.in("event", ["login", "link"]);
  else if (sp.e) q = q.eq("event", sp.e);
  if (sp.u) q = q.eq("user_id", sp.u);
  const from = madridDayRange(sp.desde, "start");
  const to = madridDayRange(sp.hasta, "end");
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data, count, error }, { data: people }, logins7, failed7] = await Promise.all([
    q,
    supabase.from("member_directory").select("id, full_name, active").order("full_name"),
    supabase.from("access_log").select("id", { count: "exact", head: true }).in("event", ["login", "link"]).gte("created_at", week),
    supabase.from("access_log").select("id", { count: "exact", head: true }).eq("event", "login_failed").gte("created_at", week),
  ]);
  const rows = (data ?? []) as Access[];
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  // Último acceso de cada persona (lo guarda Supabase Auth, también de antes de esta versión)
  let lastSeen: { id: string; name: string; at: string | null }[] = [];
  try {
    const { data: users } = await createAdminClient().auth.admin.listUsers({ perPage: 500 });
    const at = new Map((users?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
    lastSeen = (people ?? []).filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.full_name, at: at.get(p.id) ?? null }))
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  } catch {
    lastSeen = [];
  }

  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "p" && v) as [string, string][]);
  const href = (p: number) => `?${new URLSearchParams([...params, ["p", String(p)]])}`;
  const filtered = params.size > 0;

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Entradas, salidas e intentos fallidos, con el dispositivo y la IP." />
      <AuditTabs current="/admin/auditoria/accesos" />

      {error ? (
        <div className="card text-sm text-negro/70">
          El historial de accesos todavía no está activado en la base de datos. Hay que ejecutar el SQL de la versión 3.21.0.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat label="Entradas · 7 días" value={logins7.count ?? 0} />
            <Stat label="Intentos fallidos · 7 días" value={failed7.count ?? 0} />
          </div>

          {lastSeen.length > 0 && (
            <details className="card mb-4">
              <summary className="cursor-pointer select-none font-bold">Último acceso de cada persona</summary>
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {lastSeen.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <Link href={`?u=${p.id}`} className="min-w-0 truncate font-semibold hover:text-rojo">{p.name}</Link>
                    <span className="shrink-0 text-xs text-negro/65">{p.at ? fecha(p.at, true) : "Nunca ha entrado"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="label">Qué</span>
              <select name="e" defaultValue={sp.e ?? ""} className="input">
                <option value="">Todo</option>
                <option value="in">Entradas</option>
                <option value="login_failed">Intentos fallidos</option>
                <option value="logout">Salidas</option>
                <option value="password">Cambios de contraseña</option>
                <option value="revoked">Sesiones cerradas a distancia</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Persona</span>
              <select name="u" defaultValue={sp.u ?? ""} className="input">
                <option value="">Todas</option>
                {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Desde</span>
              <input type="date" name="desde" defaultValue={sp.desde ?? ""} className="input" />
            </label>
            <label className="block">
              <span className="label">Hasta</span>
              <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="input" />
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button className="btn-dark">Filtrar</button>
              {filtered && <Link href="/admin/auditoria/accesos" className="btn-ghost">Quitar filtros</Link>}
            </div>
          </form>

          <div className="card">
            {!rows.length ? (
              <Empty>{filtered ? "No hay accesos con esos filtros." : "Todavía no hay accesos apuntados. Se empiezan a guardar desde la versión 3.21.0."}</Empty>
            ) : (
              <ul className="divide-y divide-black/5 text-sm">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0">
                      <span className={`badge mr-2 ${ACCESS_EVENT_TONE[r.event] ?? "bg-negro text-white"}`}>{ACCESS_EVENT_LABEL[r.event] ?? r.event}</span>
                      <b>{r.user_id ? names.get(r.user_id) ?? r.email ?? "Usuario borrado" : r.email ?? "—"}</b>
                      {r.detail && <span className="text-negro/65"> · {r.detail}</span>}
                      {(r.user_agent || r.ip) && (
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-negro/60">
                          {r.user_agent && <DeviceLabel ua={r.user_agent} />}
                          {r.ip && <span>IP {r.ip}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-negro/65">{fecha(r.created_at, true)}</div>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={page} pageSize={PAGE} total={count ?? 0} href={href} />
          </div>
        </>
      )}
    </>
  );
}
