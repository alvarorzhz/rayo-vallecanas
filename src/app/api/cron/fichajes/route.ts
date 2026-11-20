import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkNewcomers, discoverLeagues } from "@/lib/league-sync";
import { announceNextLeague } from "@/lib/league-alerts";
import { storedLeagueDone } from "@/lib/league-plan";
import { madridDay } from "@/lib/dates";
import type { StoredSummary } from "@/lib/league-status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisión de cada mañana (la lanza Vercel Cron, ver vercel.json):
 * - Jugadores nuevos en la liga (v4.17.0): mira la plantilla del Rayo en futormes y, si aparece
 *   alguien que no está en la de la app, lo apunta en Plantilla → «Nuevos en la liga» y avisa a
 *   quien puede fichar. No añade a nadie. Si la web falla no avisa: de eso se encarga la de los lunes.
 * - Liga siguiente (v4.28.0): si la competición actual ya no tiene partidos pendientes, la da por
 *   terminada y busca al Rayo en las demás de futormes (antes solo los lunes). Avisa una sola vez
 *   por competición nueva. Nunca cambia de liga sola.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  let newcomers: unknown;
  try {
    newcomers = await checkNewcomers();
  } catch (e) {
    newcomers = { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
  let next: unknown = null;
  try {
    next = await lookForNextLeague();
  } catch (e) {
    next = { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({ newcomers, next });
}

async function lookForNextLeague() {
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("competition, team_name, last_summary").eq("id", 1).maybeSingle();
  if (!cfg?.competition) return { status: "sin-liga" };
  if ((cfg.last_summary as StoredSummary)?.next) return { status: "ya-avisada" };
  const { data: ms } = await admin.from("matches").select("status, match_date").eq("league_competition", cfg.competition);
  if (!storedLeagueDone(ms ?? [], madridDay())) return { status: "en-juego" };
  await admin.from("league_competitions").update({ finished: true }).eq("competition", cfg.competition).eq("finished", false);
  const found = (await discoverLeagues({ current: cfg.competition, teamName: cfg.team_name })).find((f) => !f.finished);
  if (!found) return { status: "sin-liga-nueva" };
  return { status: "encontrada", competition: found.competition, name: found.name, announced: await announceNextLeague(found) };
}
