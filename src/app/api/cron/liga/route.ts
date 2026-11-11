import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLeagueHealth, discoverLeagues } from "@/lib/league-sync";
import { alertLeagueProblem, announceNextLeague, recordLeagueHealth } from "@/lib/league-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisión semanal de la web de la liga (la lanza Vercel Cron los lunes por la mañana).
 * Solo lee: comprueba que el calendario, la clasificación, la plantilla y las fichas se
 * siguen entendiendo. Si la liga ha cambiado su web, avisa a los gestores antes de que
 * nadie pulse «Sincronizar» y se encuentre el problema.
 *
 * Si además la competición ya ha terminado para nosotros, busca al equipo en las demás
 * competiciones de la liga y, cuando aparece en una nueva, avisa para que la cambien.
 * Nunca cambia de liga sola.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("competition, team, team_name").eq("id", 1).maybeSingle();
  if (!cfg) return NextResponse.json({ status: "sin-liga" });
  const health = await checkLeagueHealth(cfg.competition, cfg.team);
  await recordLeagueHealth(health);
  const sent = health.status === "ok" ? 0 : await alertLeagueProblem({ status: health.status, issues: health.issues, source: "health" });

  let next: { competition: string; name: string } | null = null;
  let announced = 0;
  if (health.finished) {
    try {
      const found = (await discoverLeagues({ current: cfg.competition, teamName: cfg.team_name })).find((f) => !f.finished);
      if (found) {
        next = { competition: found.competition, name: found.name };
        announced = await announceNextLeague(found);
      }
    } catch (e) {
      console.error("No se ha podido buscar la liga siguiente:", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ ...health, sent, next, announced });
}
