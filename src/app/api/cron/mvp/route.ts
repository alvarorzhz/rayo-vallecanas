import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { finishMvp } from "@/lib/mvp-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Cierre de las votaciones del MVP (lo lanza Vercel Cron pasada la medianoche de Madrid).
 * Hace el recuento de las que ya han pasado su hora y avisa del ganador. Si alguien abre
 * antes la página del partido o Inicio, el recuento ya se habrá hecho allí: nunca sale dos veces.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  const admin = createAdminClient();
  const { data } = await admin.from("mvp_polls").select("match_id").is("closed_at", null).lte("closes_at", new Date().toISOString());
  let closed = 0;
  for (const p of data ?? []) {
    const r = await finishMvp(admin, p.match_id as string);
    if (r.just_closed) closed++;
  }
  return NextResponse.json({ ok: true, pending: data?.length ?? 0, closed });
}
