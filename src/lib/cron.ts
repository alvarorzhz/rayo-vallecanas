/**
 * Las tareas programadas las lanza Vercel Cron con la clave CRON_SECRET en la cabecera
 * `Authorization: Bearer …`.
 *
 * Desde 4.32.1 falla cerrado: si CRON_SECRET no está puesta (o está vacía o solo con espacios),
 * ninguna tarea se ejecuta, ni siquiera llamándola a mano. Antes, sin clave, cualquiera podía
 * lanzar las convocatorias, la sincronización de la liga o la copia de seguridad desde Internet.
 */
export type CronCheck = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Comparación que tarda lo mismo acierte o falle, para no dar pistas de la clave por el tiempo. */
function sameText(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Decide si una petición puede lanzar una tarea. Pura, para poder probarla sin servidor. */
export function checkCron(secret: string | undefined, authorization: string | null): CronCheck {
  const key = (secret ?? "").trim();
  if (!key) {
    return { ok: false, status: 503, error: "Tareas automáticas apagadas: falta CRON_SECRET en el servidor" };
  }
  if (!authorization || !sameText(authorization, `Bearer ${key}`)) {
    return { ok: false, status: 401, error: "No autorizado" };
  }
  return { ok: true };
}

/** Devuelve la respuesta de rechazo (Response normal, sin next/server, para poder probarla con node:test) si la petición no puede seguir, o null si puede. */
export function cronDenied(req: Request): Response | null {
  const r = checkCron(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (r.ok) return null;
  if (r.status === 503) console.error(`[cron] ${new URL(req.url).pathname} rechazada: falta CRON_SECRET`);
  return Response.json({ error: r.error }, { status: r.status });
}
