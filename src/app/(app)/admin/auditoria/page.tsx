import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fecha } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { Pager } from "@/components/pager";

export const metadata = { title: "Auditoría" };
const PAGE = 50;

const TABLE_LABEL: Record<string, string> = {
  lottery_sales: "Venta",
  lottery_payments: "Cobro",
  lottery_campaigns: "Campaña",
  lottery_booklets: "Talonario",
  lottery_campaign_sellers: "Vendedor asignado",
  lottery_shares: "Participación",
  buyers: "Comprador",
  notifications: "Justificante",
  finance_movements: "Movimiento económico",
  finance_categories: "Categoría económica",
  finance_settings: "Saldo inicial",
  profiles: "Usuario",
  user_permissions: "Permisos",
};
const ACTION_LABEL: Record<string, string> = { INSERT: "Alta", UPDATE: "Modificación", DELETE: "Borrado", CANCEL_SALE: "Anulación", EXPORT: "Exportación", BACKUP: "Copia de seguridad", NOTICE: "Aviso enviado", DELETE_CAMPAIGN: "Eliminación de campaña" };

function diff(oldD: Record<string, unknown> | null, newD: Record<string, unknown> | null) {
  if (!oldD || !newD) return null;
  return Object.keys(newD)
    .filter((k) => k !== "updated_at" && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
    .map((k) => `${k}: ${JSON.stringify(oldD[k])} → ${JSON.stringify(newD[k])}`);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ p?: string; t?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.p) || 1);
  let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.t) q = q.eq("table_name", sp.t);
  const { data: rows, count } = await q;
  const ids = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))];
  const { data: people } = ids.length ? await supabase.from("member_directory").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Registro de operaciones importantes. No se puede modificar." />
      <form className="mb-4 flex gap-2">
        <select name="t" defaultValue={sp.t ?? ""} className="input max-w-xs" aria-label="Tabla">
          <option value="">Todo</option>
          {Object.entries(TABLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-dark">Filtrar</button>
      </form>
      <div className="card">
        {!rows?.length ? (
          <Empty>Sin registros.</Empty>
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {rows.map((r) => {
              const changes = r.action === "UPDATE" ? diff(r.old_data, r.new_data) : null;
              const d = (r.new_data ?? r.old_data ?? {}) as Record<string, unknown>;
              const what = (d.reference ?? d.name ?? d.full_name ?? (d.amount_cents !== undefined ? `${Number(d.amount_cents) / 100} €` : "")) as string;
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="badge mr-2 bg-negro text-white">{ACTION_LABEL[r.action] ?? r.action}</span>
                      <b>{TABLE_LABEL[r.table_name] ?? r.table_name}</b> {what && <span className="text-negro/70">· {what}</span>}
                    </div>
                    <div className="text-xs text-negro/65">{r.user_id ? names.get(r.user_id) ?? "—" : "Sistema"} · {fecha(r.created_at, true)}</div>
                  </div>
                  {changes?.length ? (
                    <div className="mt-1 break-all font-mono text-[11px] text-negro/60">{changes.join(" · ")}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} pageSize={PAGE} total={count ?? 0} href={(p) => `?p=${p}${sp.t ? `&t=${sp.t}` : ""}`} />
      </div>
    </>
  );
}
