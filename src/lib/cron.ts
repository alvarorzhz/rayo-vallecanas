import { NextResponse } from "next/server";

/**
 * Las tareas programadas las lanza Vercel Cron con la clave CRON_SECRET en la cabecera.
 * Devuelve la respuesta 401 si la petición no la trae, o null si puede seguir.
 */
export function cronDenied(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
