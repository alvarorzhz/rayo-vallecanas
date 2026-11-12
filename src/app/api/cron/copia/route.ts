import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { runBackup } from "@/lib/backup";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Copia de seguridad automática de los lunes (Vercel Cron). Si falla, avisa a los superadministradores. */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  try {
    const r = await runBackup();
    return NextResponse.json({ ok: true, ...r });
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
