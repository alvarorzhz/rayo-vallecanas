import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { capsuleTick } from "@/lib/capsule-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cápsula del tiempo (v4.24.0). La lanza Vercel Cron cada noche (vercel.json), después de los partidos:
 * avisa al equipo cuando se abre una cápsula y, tres días antes de cerrarse, recuerda escribir
 * a quien aún no lo ha hecho. Nunca lee lo que hay dentro.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  return NextResponse.json(await capsuleTick());
}
