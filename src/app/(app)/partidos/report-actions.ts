"use server";
import { teamKey } from "@/lib/league-plan";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { fetchSheet } from "@/lib/league-sync";
import { CLUB_NAME, type MatchRow } from "@/lib/matches";
import { shirtName, type Player } from "@/lib/squad";
import { activeUsers, announceMvpOpen } from "@/lib/mvp-server";
import { mvpClosesAt, untilLabel } from "@/lib/mvp";
import { emptyApp, type DraftApp, type ReportDraft } from "@/lib/reports";

export type ReportState = { error?: string; ok?: string } | undefined;
export type PrefillResult = { error?: string; ok?: string; draft?: ReportDraft };

const UUID = /^[0-9a-f-]{36}$/i;
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  return m;
};

/** Comprueba y limpia lo que manda el formulario del acta. */
function cleanDraft(raw: unknown, goalsFor: number): ReportDraft {
  const d = raw as ReportDraft;
  if (!d || typeof d !== "object" || typeof d.apps !== "object" || !Array.isArray(d.goals)) throw new Error("Acta no válida");
  const apps: Record<string, DraftApp> = {};
  for (const [id, a] of Object.entries(d.apps)) {
    if (!UUID.test(id) || !a) continue;
    const gk = !!a.goalkeeper;
    apps[id] = {
      started: !!a.started,
      goalkeeper: gk,
      conceded: gk ? Math.max(0, Math.min(99, Math.trunc(Number(a.conceded) || 0))) : 0,
      yellows: Math.max(0, Math.min(2, Math.trunc(Number(a.yellows) || 0))),
      red: !!a.red,
    };
  }
  if (Object.keys(apps).length > 30) throw new Error("Demasiados jugadores en el acta");
  if (d.goals.length > goalsFor) throw new Error(`Hay más goles apuntados que los ${goalsFor} del marcador`);
  const goals = d.goals.map((g) => {
    const scorer = g?.scorer === "own" ? "own" : UUID.test(g?.scorer ?? "") ? g.scorer : "";
    const assist = UUID.test(g?.assist ?? "") ? g.assist : "";
    if (scorer && scorer !== "own" && !apps[scorer]) throw new Error("Un goleador no está marcado como que jugó");
    if (assist && !apps[assist]) throw new Error("Un asistente no está marcado como que jugó");
    if (assist && assist === scorer) throw new Error("Un jugador no puede darse la asistencia a sí mismo");
    return { scorer, assist };
  });
  return { apps, goals };
}

/** Guarda el acta (sustituye la anterior). */
export async function saveReport(matchId: string, _: ReportState, f: FormData): Promise<ReportState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  if (!UUID.test(matchId)) return { error: "Partido no encontrado" };
  const supabase = await createClient();
  let m: MatchRow | null = null;
  let draft: ReportDraft;
  try {
    const { data } = await supabase.from("matches").select("*, rival:rivals!inner(*)").eq("id", matchId).maybeSingle<MatchRow>();
    if (!data) throw new Error("Partido no encontrado");
    if (data.status !== "played") throw new Error("Primero pon el resultado del partido");
    m = data;
    draft = cleanDraft(JSON.parse(String(f.get("payload") ?? "{}")), data.goals_for ?? 0);

    const del1 = await supabase.from("match_goals").delete().eq("match_id", matchId);
    if (del1.error) throw del1.error;
    const del2 = await supabase.from("match_appearances").delete().eq("match_id", matchId);
    if (del2.error) throw del2.error;
    const appRows = Object.entries(draft.apps).map(([player_id, a]) => ({ match_id: matchId, player_id, ...a }));
    if (appRows.length) {
      const { error } = await supabase.from("match_appearances").insert(appRows);
      if (error) throw error;
    }
    const goalRows = draft.goals
      .map((g, i) => ({ match_id: matchId, scorer_id: g.scorer && g.scorer !== "own" ? g.scorer : null, assist_id: g.assist || null, own_goal: g.scorer === "own", sort: i }))
      .filter((g) => g.scorer_id || g.assist_id || g.own_goal);
    if (goalRows.length) {
      const { error } = await supabase.from("match_goals").insert(goalRows);
      if (error) throw error;
    }
    const { error } = await supabase.from("matches")
      .update({ report_saved_at: new Date().toISOString(), report_by: s.user.id }).eq("id", matchId);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }

  // Se abre la votación del MVP (o, si ya estaba abierta, se ponen al día los candidatos)
  const closes = mvpClosesAt();
  const { data: opened } = await supabase.rpc("mvp_open", { p_match: matchId, p_candidates: Object.keys(draft.apps), p_closes: closes.toISOString() });
  const notify = !!m && !m.report_saved_at && f.get("notify") === "on";
  if (m && (opened || notify)) {
    const ids = [...new Set(draft.goals.map((g) => g.scorer).filter((x) => x && x !== "own"))];
    const { data: ps } = ids.length ? await supabase.from("players").select("*").in("id", ids).returns<Player[]>() : { data: [] as Player[] };
    const name = (id: string) => { const p = ps?.find((x) => x.id === id); return p ? shirtName(p) : "?"; };
    const count = new Map<string, number>();
    for (const g of draft.goals) if (g.scorer && g.scorer !== "own") count.set(g.scorer, (count.get(g.scorer) ?? 0) + 1);
    const scorers = [...count].map(([id, n]) => `${name(id)}${n > 1 ? ` (${n})` : ""}`).join(", ");
    if (opened) {
      // Un solo aviso: la votación (con el resumen del acta si se dejó marcado «Avisar»)
      await announceMvpOpen(m, untilLabel(closes), { except: s.user.id, scorers: notify ? scorers : undefined });
    } else {
      const score = m.is_home ? `${CLUB_NAME} ${m.goals_for}-${m.goals_against} ${m.rival.name}` : `${m.rival.name} ${m.goals_against}-${m.goals_for} ${CLUB_NAME}`;
      await sendPush(await activeUsers(s.user.id), {
        title: "📋 Acta del partido",
        body: [score, scorers && `⚽ ${scorers}`].filter(Boolean).join(" · "),
        url: `/partidos/${matchId}`,
        tag: `acta-${matchId}`,
      });
    }
  }

  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/plantilla", "layout");
  revalidatePath("/");
  redirect(`/partidos/${matchId}?acta=1#acta`);
}

/** Borra el acta. */
export async function deleteReport(matchId: string): Promise<ReportState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const a = await supabase.from("match_goals").delete().eq("match_id", matchId);
  const b = await supabase.from("match_appearances").delete().eq("match_id", matchId);
  // El MVP votado se queda aunque se borre el acta
  const { data: poll } = await supabase.from("mvp_polls").select("match_id").eq("match_id", matchId).maybeSingle();
  const c = await supabase.from("matches").update({ ...(poll ? {} : { mvp_player_id: null }), report_saved_at: null, report_by: null }).eq("id", matchId);
  const err = a.error ?? b.error ?? c.error;
  if (err) return { error: errMsg(err) };
  revalidatePath(`/partidos/${matchId}`);
  revalidatePath("/plantilla", "layout");
  redirect(`/partidos/${matchId}`);
}

/** Trae de la web de la liga quién jugó, los goles, los encajados y las tarjetas (no guarda: rellena el formulario). */
export async function leaguePrefill(matchId: string): Promise<PrefillResult> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const [{ data: m }, { data: cfg }] = await Promise.all([
    supabase.from("matches").select("id, ext_id, is_home, goals_for, league_competition").eq("id", matchId).maybeSingle(),
    supabase.from("league_sync").select("competition").eq("id", 1).maybeSingle(),
  ]);
  const ext = typeof m?.ext_id === "string" && m.ext_id.startsWith("futormes:") ? m.ext_id.slice(9) : null;
  if (!m || !ext) return { error: "Este partido no viene de la liga" };
  // El partido puede ser de una competición anterior a la configurada ahora
  const competition = (m.league_competition as string | null) ?? cfg?.competition;
  if (!competition) return { error: "Primero configura la liga en Partidos → Liga" };
  try {
    const rows = await fetchSheet(competition, ext, m.is_home);
    if (!rows.length) return { error: "La liga todavía no ha publicado quién jugó este partido" };
    const { data: players } = await supabase.from("players").select("id, ext_id").in("ext_id", rows.map((r) => `futormes:${r.extId}`));
    const idOf = new Map((players ?? []).map((p) => [String(p.ext_id).slice(9), p.id as string]));
    // En un partido de otra competición la liga puede dar otro número al jugador: se le busca por el nombre
    if (rows.some((r) => !idOf.has(r.extId))) {
      const words = (n: string) => teamKey(n).split(" ").sort().join(" ");
      const { data: all } = await supabase.from("players").select("id, first_name, last_name");
      const byName = new Map((all ?? []).map((p) => [words(`${p.first_name} ${p.last_name}`), p.id as string]));
      for (const r of rows) {
        const id = !idOf.has(r.extId) && byName.get(words(r.name));
        if (id) idOf.set(r.extId, id);
      }
    }
    const apps: Record<string, DraftApp> = {};
    const goals: { scorer: string; assist: string }[] = [];
    const unknown: string[] = [];
    for (const r of rows) {
      const id = idOf.get(r.extId);
      if (!id) { unknown.push(r.name); continue; }
      apps[id] = { ...emptyApp(), goalkeeper: r.conceded != null, conceded: r.conceded ?? 0, yellows: r.yellows, red: r.red };
      for (let i = 0; i < r.goals; i++) goals.push({ scorer: id, assist: "" });
    }
    const total = m.goals_for ?? 0;
    while (goals.length < total) goals.push({ scorer: "", assist: "" });
    const withScorer = rows.reduce((n, r) => n + r.goals, 0);
    return {
      draft: { apps, goals: goals.slice(0, total) },
      ok: `Traídos ${Object.keys(apps).length} jugadores de la liga${withScorer ? `, ${withScorer} goles con autor` : " (la liga no apunta los goleadores de este partido)"}${unknown.length ? `. No están en la plantilla: ${unknown.join(", ")}` : ""}. Revisa y guarda.`,
    };
  } catch (e) {
    return { error: `No se pudo leer la web de la liga: ${errMsg(e)}` };
  }
}
