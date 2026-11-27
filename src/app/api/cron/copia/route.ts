import { NextResponse } from "next/server";
import { AUDIT_RETENTION_MONTHS } from "@/lib/audit";
import { cronDenied } from "@/lib/cron";
import { runBackup } from "@/lib/backup";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Copia de seguridad automática de los lunes (Vercel Cron). Si falla, avisa a los superadministradores.
 * 4.32.2 · Después de una copia buena, borra la auditoría y los accesos de hace más de AUDIT_RETENTION_MONTHS
 * (lo que se borra ya está en esta copia y en las anteriores). Si la copia falla, no se borra nada.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  try {
    const r = await runBackup();
    const { data: purge, error } = await createAdminClient().rpc("purge_audit_log", { p_months: AUDIT_RETENTION_MONTHS });
    if (error) console.error("[copia] limpieza de la auditoría:", error.message);
    return NextResponse.json({ ok: true, ...r, purge: error ? { error: error.message } : purge });
  } catch (e) {
    const message = (e as Error).message;
    try {
      const { data } = await createAdminClient().from("profiles").select("id").eq("role", "superadmin").eq("active", true);
      await sendPush((data ?? []).map((p) => p.id as string), {
        title: "⚠️ La copia de seguridad ha fallado",
        body: `La copia automática de hoy no se ha podido hacer. Entra en Copia de seguridad y pulsa «Hacer copia ahora». (${message.slice(0, 120)})`,
        url: "/admin/copia",
        tag: "copia-fallo",
      });
    } catch {}
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
