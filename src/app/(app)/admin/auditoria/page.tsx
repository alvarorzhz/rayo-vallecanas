import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuditLogView, type AuditSP } from "@/components/audit/audit-log-view";

export const metadata = { title: "Auditoría · Funcional" };

/** Auditoría funcional: el día a día del club (partidos, cuotas, rifa, patrocinadores, material…). */
export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditSP> }) {
  const sp = await searchParams;
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  return <AuditLogView kind="funcional" sp={sp} base="/admin/auditoria" />;
}
