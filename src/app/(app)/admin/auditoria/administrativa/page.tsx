import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuditLogView, type AuditSP } from "@/components/audit/audit-log-view";

export const metadata = { title: "Auditoría · Administrativa" };

/** Auditoría administrativa (4.32.0): usuarios, permisos, mandos de la app, exportaciones y copias. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<AuditSP> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  return <AuditLogView kind="administrativa" sp={sp} base="/admin/auditoria/administrativa" />;
}
