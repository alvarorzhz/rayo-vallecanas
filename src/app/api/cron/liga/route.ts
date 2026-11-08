import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLeagueHealth } from "@/lib/league-sync";
import { alertLeagueProblem, recordLeagueHealth } from "@/lib/league-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisión semanal de la web de la liga (la lanza Vercel Cron los lunes por la mañana).
 * Solo lee: comprueba que el calendario, la clasificación, la plantilla y las fichas se
 * siguen entendiendo. Si la liga ha cambiado su web, avisa a los gestores antes de que
 * nadie pulse «Sincronizar» y se encuentre el problema.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("competition, team").eq("id", 1).maybeSingle();
  if (!cfg) return NextResponse.json({ status: "sin-liga" });
  const health = await checkLeagueHealth(cfg.competition, cfg.team);
  await recordLeagueHealth(health);
  const sent = health.status === "ok" ? 0 : await alertLeagueProblem({ status: health.status, issues: health.issues, source: "health" });
  return NextResponse.json({ ...health, sent });
}
