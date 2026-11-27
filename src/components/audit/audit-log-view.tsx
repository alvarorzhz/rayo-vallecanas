import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fecha } from "@/lib/format";
import { ACTION_LABEL, ACTION_TONE, ADMIN_ACTIONS, ADMIN_TABLES, SECURITY_TABLES, TABLE_LABEL, changedFields, collectIds, madridDayRange, pgList, recordSummary, snapshotFields, tableGroupsFor, type AuditRow } from "@/lib/audit";
import { namesFor } from "@/lib/audit-names";
import { Empty, PageHeader } from "@/components/ui";
import { Pager } from "@/components/pager";
import { AuditTabs } from "@/components/audit/audit-tabs";

const PAGE = 40;

export type AuditSP = { p?: string; t?: string; a?: string; u?: string; r?: string; desde?: string; hasta?: string };

/** Acciones del filtro en cada auditoría. */
const ACTIONS: Record<"funcional" | "administrativa", [string, string][]> = {
  funcional: [["UPDATE", "Modificaciones"], ["INSERT", "Altas"], ["DELETE", "Borrados"], ["other", "Acciones (anulaciones, avisos, sorteos…)"]],
  administrativa: [["UPDATE", "Modificaciones"], ["INSERT", "Altas"], ["DELETE", "Borrados"], ["REMOVE_MEMBER", "Bajas"], ["EXPORT", "Exportaciones"], ["BACKUP", "Copias de seguridad"], ["PURGE", "Limpiezas de la auditoría"]],
};

/**
 * 4.32.0 · Lista de audit_log de una auditoría (funcional o administrativa), con filtros, historial por registro y páginas.
 * La de seguridad tiene sus propias pantallas (accesos y sesiones).
 */
export async function AuditLogView({ kind, sp, base }: { kind: "funcional" | "administrativa"; sp: AuditSP; base: string }) {
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.p) || 1);

  let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (kind === "administrativa") q = q.or(`table_name.in.${pgList(ADMIN_TABLES)},action.in.${pgList(ADMIN_ACTIONS)}`);
  else q = q.not("table_name", "in", pgList([...ADMIN_TABLES, ...SECURITY_TABLES])).not("action", "in", pgList(ADMIN_ACTIONS));
  if (sp.t) q = q.eq("table_name", sp.t);
  if (sp.a === "change") q = q.in("action", ["INSERT", "UPDATE", "DELETE"]);
  else if (sp.a === "other") q = q.not("action", "in", "(INSERT,UPDATE,DELETE)");
  else if (sp.a) q = q.eq("action", sp.a);
  if (sp.u === "sistema") q = q.is("user_id", null);
  else if (sp.u) q = q.eq("user_id", sp.u);
  if (sp.r) q = q.eq("record_id", sp.r);
  const from = madridDayRange(sp.desde, "start");
  const to = madridDayRange(sp.hasta, "end");
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const [{ data, count }, { data: people }] = await Promise.all([
    q,
    supabase.from("member_directory").select("id, full_name").order("full_name"),
  ]);
  const rows = (data ?? []) as AuditRow[];
  const names = await namesFor(supabase, collectIds(rows));

  const params = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "p" && v) as [string, string][]);
  const href = (p: number) => `?${new URLSearchParams([...params, ["p", String(p)]])}`;
  const filtered = params.size > 0;
  const recordLabel = sp.r && rows[0] ? `${TABLE_LABEL[rows[0].table_name] ?? rows[0].table_name} · ${recordSummary(rows[0], names) || sp.r}` : null;

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Lo que pasa en la app, separado en tres: funcional, administrativa y de seguridad. No se puede modificar." />
      <AuditTabs current={kind} />

      {recordLabel ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-dorado/15 px-4 py-3 text-sm">
          <span>Historial completo de <b>{recordLabel}</b></span>
          <Link href={base} className="font-bold text-rojo">Ver todo</Link>
        </div>
      ) : (
        <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="label">Apartado</span>
            <select name="t" defaultValue={sp.t ?? ""} className="input">
              <option value="">Todo</option>
              {tableGroupsFor(kind).map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {Object.entries(g.tables).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Acción</span>
            <select name="a" defaultValue={sp.a ?? ""} className="input">
              <option value="">Todas</option>
              {ACTIONS[kind].map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Persona</span>
            <select name="u" defaultValue={sp.u ?? ""} className="input">
              <option value="">Todas</option>
              <option value="sistema">Sistema (automático)</option>
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
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <button className="btn-dark">Filtrar</button>
            {filtered && <Link href={base} className="btn-ghost">Quitar filtros</Link>}
          </div>
        </form>
      )}

      <div className="card ledger">
        {!rows.length ? (
          <Empty>{filtered ? "No hay registros con esos filtros." : "Todavía no hay nada apuntado aquí."}</Empty>
        ) : (
          <ul className="divide-y divide-black/5 text-sm">
            {rows.map((r) => {
              const changes = r.action === "UPDATE" ? changedFields(r, names) : [];
              const snapshot = r.action === "UPDATE" ? [] : snapshotFields(r.new_data ?? r.old_data, r.table_name, names);
              const what = recordSummary(r, names);
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0">
                      <span className={`badge mr-2 ${ACTION_TONE[r.action] ?? "bg-negro text-white"}`}>{ACTION_LABEL[r.action] ?? r.action}</span>
                      <b>{TABLE_LABEL[r.table_name] ?? r.table_name}</b>
                      {what && <span className="break-words text-negro/70"> · {what}</span>}
                    </div>
                    <div className="text-xs text-negro/65">
                      {r.user_id ? names.get(r.user_id) ?? "Usuario borrado" : "Sistema"} · {fecha(r.created_at, true)}
                    </div>
                  </div>

                  {changes.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-black/10">
                      <div className="hidden grid-cols-[minmax(8rem,12rem)_1fr_1fr] bg-black/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-negro/55 sm:grid">
                        <span>Campo</span><span>Antes</span><span>Ahora</span>
                      </div>
                      {changes.map((c) => (
                        <div key={c.key} className="grid gap-x-3 border-t border-black/5 px-3 py-1.5 first:border-t-0 sm:grid-cols-[minmax(8rem,12rem)_1fr_1fr] sm:[&:nth-child(2)]:border-t-0">
                          <span className="text-xs font-bold text-negro/70 sm:text-sm sm:font-semibold">{c.label}</span>
                          <div className="flex flex-wrap items-baseline gap-x-2 sm:contents">
                            <span className={`break-words text-negro/50 ${c.before !== "—" ? "line-through decoration-rojo/50" : ""}`}>{c.before}</span>
                            <span aria-hidden className="text-negro/40 sm:hidden">→</span>
                            <span className="break-words font-semibold text-negro">{c.after}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {snapshot.length > 0 && (
                    <details className="mt-1.5 group">
                      <summary className="cursor-pointer select-none text-xs font-bold text-negro/60 hover:text-rojo">
                        {r.action === "DELETE" ? "Ver lo que se borró" : r.action === "INSERT" ? "Ver los datos del alta" : "Ver detalles"} ({snapshot.length})
                      </summary>
                      <dl className="mt-2 grid gap-x-3 gap-y-1 rounded-lg bg-black/[0.03] px-3 py-2 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
                        {snapshot.map((f) => (
                          <div key={f.key} className="contents">
                            <dt className="text-xs font-bold text-negro/60 sm:text-sm sm:font-semibold">{f.label}</dt>
                            <dd className="mb-1 break-words sm:mb-0">{f.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}

                  {r.record_id && !sp.r && ["INSERT", "UPDATE", "DELETE"].includes(r.action) && (
                    <Link href={`?t=${r.table_name}&r=${encodeURIComponent(r.record_id)}`} className="mt-1.5 inline-block text-xs font-bold text-rojo/80 hover:text-rojo">
                      Historial de este registro →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} pageSize={PAGE} total={count ?? 0} href={href} />
      </div>
    </>
  );
}
