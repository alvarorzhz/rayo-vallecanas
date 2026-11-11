import { NextResponse } from "next/server";
import { cronDenied } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLeague } from "@/lib/league-sync";
import { awaitingResult, madridNow, type WatchMatch } from "@/lib/result-watch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vigilancia del resultado (v3.19.0). La lanza Vercel Cron varias veces al día (vercel.json).
 * Si hay un partido de liga de hoy (ya acabado) o de ayer sin resultado, sincroniza con la web
 * de la liga. Si el resultado ya está, la sincronización lo guarda y avisa a todo el equipo.
 * Los demás días no hace nada: no se toca la web de la liga.
 */
export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("id").eq("id", 1).maybeSingle();
  if (!cfg) return NextResponse.json({ status: "sin-liga" });

  const now = madridNow();
  const { data: matches } = await admin.from("matches").select("id, match_date, kickoff, status, competition, ext_id")
    .eq("status", "scheduled").eq("competition", "league").lte("match_date", now.slice(0, 10)).order("match_date", { ascending: false }).limit(5)
    .returns<WatchMatch[]>();
  const waiting = awaitingResult(matches ?? [], now);
  if (!waiting.length) return NextResponse.json({ status: "nada-que-mirar", now });

  try {
    const summary = await syncLeague();
    return NextResponse.json({ status: "sincronizado", now, waiting: waiting.length, results: summary.results, sync: summary.status });
  } catch (e) {
    // syncLeague ya ha avisado a los gestores del problema
    return NextResponse.json({ status: "error", now, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
