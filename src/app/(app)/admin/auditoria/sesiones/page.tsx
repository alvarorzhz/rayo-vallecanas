import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fecha, ROLE_LABEL, ultimaConexion } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { AuditTabs } from "@/components/audit/audit-tabs";
import { DeviceLabel } from "@/components/audit/device-label";
import { CloseSessionButton } from "@/components/audit/close-session-button";

export const metadata = { title: "Auditoría · Sesiones" };

type Row = { id: string; user_id: string; full_name: string | null; role: string | null; created_at: string; last_seen: string | null; not_after: string | null; ip: string | null; user_agent: string | null };

export default async function SessionsPage() {
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const supabase = await createClient();
  const [{ data, error }, { data: claims }] = await Promise.all([supabase.rpc("admin_sessions"), supabase.auth.getClaims()]);
  const mine = (claims?.claims?.session_id as string | undefined) ?? null;
  // La más reciente primero (la base de datos ya las da así; por si acaso)
  const rows = ((data ?? []) as Row[]).sort((a, b) => (b.last_seen ? Date.parse(b.last_seen) : 0) - (a.last_seen ? Date.parse(a.last_seen) : 0));
  const people = new Set(rows.map((r) => r.user_id)).size;

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Dispositivos con la sesión abierta ahora mismo. Si alguien pierde el móvil, ciérrala desde aquí." />
      <AuditTabs current="/admin/auditoria/sesiones" />
      {error ? (
        <div className="card text-sm text-negro/70">
          Las sesiones todavía no están activadas en la base de datos. Hay que ejecutar el SQL de la versión 3.21.0.
        </div>
      ) : (
        <div className="card">
          <p className="mb-2 text-sm text-negro/65">
            {rows.length} {rows.length === 1 ? "sesión abierta" : "sesiones abiertas"} de {people} {people === 1 ? "persona" : "personas"}.
          </p>
          {!rows.length ? (
            <Empty>No hay sesiones abiertas.</Empty>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div>
                      <b>{r.full_name ?? "Usuario borrado"}</b>
                      {r.role && <span className="text-negro/60"> · {ROLE_LABEL[r.role] ?? r.role}</span>}
                      {r.id === mine && <span className="badge ml-2 bg-dorado/30 text-negro">Esta sesión</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-negro/65">
                      <DeviceLabel ua={r.user_agent} />
                      {r.ip && <span>IP {r.ip}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-negro/55">
                      Última conexión: {ultimaConexion(r.last_seen)} · entró el {fecha(r.created_at, true)}
                    </div>
                  </div>
                  {r.id !== mine && <CloseSessionButton id={r.id} who={r.full_name ?? "esta persona"} />}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-negro/55">
            El dispositivo y la IP salen de las entradas hechas desde la versión 3.21.0. En las sesiones abiertas antes sale «Dispositivo desconocido».
          </p>
        </div>
      )}
    </>
  );
}
