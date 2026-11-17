import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStandings } from "@/lib/league-table";
import { goalState } from "@/lib/league-outlook";
import { goalProgress, goalTitle, type GoalFacts, type GoalProgress, type SeasonGoal } from "@/lib/season-goals";
import { seasonOf } from "@/lib/finance";
import { sendPush } from "@/lib/push";

type DB = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
export type GoalCard = SeasonGoal & GoalProgress & { title: string };

/** Lo que hace falta para medir los objetivos: partidos, plantilla y (si hay objetivo de puesto) la clasificación. */
async function goalFacts(supabase: DB, season: string, withLeague: boolean, leagueMs: number): Promise<GoalFacts> {
  const [{ data: ms }, { data: squad }, standings] = await Promise.all([
    supabase.from("matches").select("goals_for, goals_against, match_date, kickoff").eq("season", season).eq("status", "played")
      .order("match_date").order("kickoff", { nullsFirst: true }),
    supabase.from("squad_members_full").select("status, apps").eq("season", season),
    withLeague && season === seasonOf() ? getStandings(supabase as Awaited<ReturnType<typeof createClient>>, leagueMs).catch(() => null) : Promise.resolve(null),
  ]);
  const members = (squad ?? []).filter((r) => r.status !== "left");
  let league: GoalFacts["league"] = null;
  if (standings) {
    const rows = standings.table.rows;
    const me = rows.find((r) => r.teamId === standings.us);
    if (me) {
      const mine = { points: me.points, left: me.left ?? 0 };
      const others = rows.filter((r) => r.teamId !== standings.us).map((r) => ({ points: r.points, left: r.left ?? 0 }));
      const known = !!standings.table.withCalendar;
      league = {
        pos: me.pos, total: rows.length, finished: known && mine.left === 0,
        // Sin calendario no se sabe lo que queda: solo cuenta como hecho al terminar la liga
        secured: (top) => known && goalState(mine, others, top).state === "hecho",
      };
    }
  }
  return {
    matches: (ms ?? []).map((m) => ({ gf: m.goals_for as number | null, ga: m.goals_against as number | null })),
    squad: members.length,
    squadPlayed: members.filter((r) => (r.apps ?? 0) > 0).length,
    league,
  };
}

/** Objetivos de una temporada con cómo va cada uno. */
export async function fetchGoalsBoard(supabase: DB, season: string, leagueMs = 2500): Promise<GoalCard[] | null> {
  const { data, error } = await supabase.from("season_goals").select("id, season, kind, target, sort, achieved_at").eq("season", season)
    .order("sort").order("created_at").returns<SeasonGoal[]>();
  if (error) return null; // tabla aún sin crear (falta el SQL de la 4.20.0)
  if (!data.length) return [];
  const facts = await goalFacts(supabase, season, data.some((g) => g.kind === "position"), leagueMs);
  return data.map((g) => {
    const p = goalProgress(g.kind, g.target, facts);
    // Lo que ya se cumplió se queda cumplido (una racha que se corta no lo deshace)
    return { ...g, ...p, done: p.done || !!g.achieved_at, pct: p.done || g.achieved_at ? 100 : p.pct, title: goalTitle(g.kind, g.target) };
  });
}

/**
 * Apunta los objetivos que se acaban de cumplir y avisa al equipo (una sola vez por objetivo:
 * solo avisa quien consigue poner la fecha). Se llama tras guardar un acta y al abrir Inicio.
 * Al poner un objetivo que ya está cumplido, se marca sin avisar (notify: false).
 */
export async function checkSeasonGoals({ notify = true }: { notify?: boolean } = {}): Promise<number> {
  try {
    const admin = createAdminClient();
    const season = seasonOf();
    const { data: open } = await admin.from("season_goals").select("id").eq("season", season).is("achieved_at", null).limit(1);
    if (!open?.length) return 0;
    const board = await fetchGoalsBoard(admin, season, 4000);
    const fresh = (board ?? []).filter((g) => g.done && !g.achieved_at);
    let n = 0;
    for (const g of fresh) {
      const { data: won } = await admin.from("season_goals").update({ achieved_at: new Date().toISOString() }).eq("id", g.id).is("achieved_at", null).select("id");
      if (!won?.length) continue;
      n++;
      if (!notify) continue;
      const { data: people } = await admin.from("profiles").select("id").eq("active", true);
      await sendPush((people ?? []).map((p) => p.id as string), {
        title: "🎯 ¡Objetivo cumplido!", body: `${g.title}. Uno menos de los objetivos de la temporada.`, url: "/partidos/estadisticas#objetivos", tag: `objetivo-${g.id}`,
      });
    }
    return n;
  } catch (e) {
    console.error("No se han podido revisar los objetivos:", e instanceof Error ? e.message : e);
    return 0;
  }
}
