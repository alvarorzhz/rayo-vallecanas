import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { checkNewcomers } from "@/lib/league-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Jugadores nuevos en la liga (v4.17.0). La lanza Vercel Cron cada mañana (vercel.json).
 * Mira la plantilla del Rayo en futormes y, si aparece alguien que no está en la de la app,
 * lo apunta en Plantilla → «Nuevos en la liga» y avisa a quien puede fichar. No añade a nadie.
 * Si la web de la liga falla no avisa: de eso ya se encarga la revisión de los lunes.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await checkNewcomers());
  } catch (e) {
    return NextResponse.json({ status: "error", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
