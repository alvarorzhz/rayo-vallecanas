import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { alertText, nextLeagueText, problemSignature, type LeagueAlertSource, type LeagueStatus, type NextLeague } from "@/lib/league-status";

export type { LeagueStatus } from "@/lib/league-status";

/**
 * Avisos cuando la sincronización con la liga falla o se queda a medias.
 * Llegan al móvil de quienes gestionan los partidos (permiso «Partidos · editar»,
 * que incluye al superadministrador) y se quedan a la vista en Partidos → Liga.
 *
 * Para no dar la lata, el mismo problema se avisa como mucho una vez al día:
 * si cambia (otro fallo, otras incidencias) se vuelve a avisar en el momento.
 */

type AlertMark = { sig: string; at: string };

const DAY = 24 * 3600 * 1000;

/** Gestores que reciben el aviso. */
async function leagueAlertRecipients(except?: string) {
  const admin = createAdminClient();
  const { data } = await admin.rpc("users_with_perm", { p_module: "matches", p_action: "update" });
  return ((data ?? []) as string[]).filter((id) => id !== except);
}

/** Avisa del problema si es nuevo o si hace más de un día del último aviso. Nunca lanza error. */
export async function alertLeagueProblem(p: { status: LeagueStatus; issues: string[]; source: LeagueAlertSource; except?: string }) {
  if (p.status === "ok") return 0;
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("league_sync").select("last_summary").eq("id", 1).maybeSingle();
    const summary = (row?.last_summary ?? {}) as Record<string, unknown>;
    const prev = summary.alert as AlertMark | undefined;
    const sig = problemSignature(p.status, p.issues);
    if (prev?.sig === sig && Date.now() - new Date(prev.at).getTime() < DAY) return 0;
    const ids = await leagueAlertRecipients(p.except);
    const { title, body } = alertText(p.status, p.issues, p.source);
    const sent = await sendPush(ids, { title, body, url: "/partidos/liga", tag: "liga-sincronizacion" });
    await admin.from("league_sync").update({ last_summary: { ...summary, alert: { sig, at: new Date().toISOString() } satisfies AlertMark } }).eq("id", 1);
    return sent;
  } catch (e) {
    console.error("No se ha podido avisar del problema con la liga:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Apunta un intento fallido sin borrar lo de la última sincronización buena. */
export async function recordLeagueFailure(error: string) {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("league_sync").select("last_summary").eq("id", 1).maybeSingle();
    const summary = (row?.last_summary ?? {}) as Record<string, unknown>;
    await admin.from("league_sync").update({ last_summary: { ...summary, status: "failed", issues: [error], failedAt: new Date().toISOString() } }).eq("id", 1);
  } catch {
    /* el aviso sale igual */
  }
}

/** Guarda el resultado de la revisión semanal. */
export async function recordLeagueHealth(health: { status: LeagueStatus; issues: string[]; at: string; checked: string[]; finished?: boolean }) {
  const admin = createAdminClient();
  const { data: row } = await admin.from("league_sync").select("last_summary").eq("id", 1).maybeSingle();
  const summary = (row?.last_summary ?? {}) as Record<string, unknown>;
  await admin.from("league_sync").update({ last_summary: { ...summary, health } }).eq("id", 1);
}

/**
 * Apunta la competición siguiente que se ha encontrado y avisa a los gestores.
 * Solo avisa la primera vez que aparece cada competición. Devuelve a cuántos móviles llegó.
 */
export async function announceNextLeague(found: { competition: string; name: string; matches: number }) {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin.from("league_sync").select("last_summary").eq("id", 1).maybeSingle();
    const summary = (row?.last_summary ?? {}) as Record<string, unknown>;
    if ((summary.next as NextLeague | undefined)?.competition === found.competition) return 0;
    const next: NextLeague = { competition: found.competition, name: found.name, matches: found.matches, at: new Date().toISOString() };
    await admin.from("league_sync").update({ last_summary: { ...summary, next } }).eq("id", 1);
    return await sendPush(await leagueAlertRecipients(), { ...nextLeagueText(found.name), url: "/partidos/liga", tag: "liga-nueva" });
  } catch (e) {
    console.error("No se ha podido avisar de la liga nueva:", e instanceof Error ? e.message : e);
    return 0;
  }
}
