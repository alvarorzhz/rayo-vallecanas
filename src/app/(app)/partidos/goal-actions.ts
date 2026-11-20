"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { GOAL_KINDS, type GoalKind } from "@/lib/season-goals";
import { checkSeasonGoals } from "@/lib/season-goals-server";
import { seasonOf } from "@/lib/finance";

export type GoalState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/partidos/estadisticas");
  revalidatePath("/partidos/objetivos");
}

/** 4.20.0 · Añade un objetivo a la temporada. */
export async function addSeasonGoal(season: string, _: GoalState, f: FormData): Promise<GoalState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para cambiar los objetivos" };
  const kind = String(f.get("kind") ?? "") as GoalKind;
  const def = GOAL_KINDS.find((k) => k.kind === kind);
  if (!def) return { error: "Elige qué objetivo" };
  const target = def.needsTarget ? Number(f.get("target")) : 1;
  if (!Number.isInteger(target) || target < 1 || target > 999) return { error: "Pon un número entre 1 y 999" };
  const supabase = await createClient();
  const { count } = await supabase.from("season_goals").select("id", { count: "exact", head: true }).eq("season", season);
  if ((count ?? 0) >= 8) return { error: "Como mucho 8 objetivos por temporada" };
  // 4.28.0 · El objetivo de puesto es de la liga que se juega ahora (Apertura, Clausura…)
  const { data: league } = kind === "position" && season === seasonOf() ? await supabase.from("league_sync").select("competition").eq("id", 1).maybeSingle<{ competition: string | null }>() : { data: null };
  const { error } = await supabase.from("season_goals").insert({ season, kind, target, sort: ((count ?? 0) + 1) * 10, ...(league?.competition ? { league_competition: league.competition } : {}) });
  if (error) return { error: /season_goals_season_kind_target|season_goals_unique|duplicate/.test(error.message) ? (kind === "position" ? "Ese objetivo ya está puesto para esta liga" : "Ese objetivo ya está puesto") : error.message };
  // Si ya estaba cumplido, se marca sin avisar a nadie
  await checkSeasonGoals({ notify: false });
  refresh();
  return { ok: "Objetivo añadido" };
}

export async function removeSeasonGoal(id: string): Promise<void> {
  const s = await getSession();
  if (!s.can("matches", "update")) return;
  const supabase = await createClient();
  await supabase.from("season_goals").delete().eq("id", id);
  refresh();
}
