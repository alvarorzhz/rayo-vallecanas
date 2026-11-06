"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { COMPETITIONS, CLUB_NAME, hhmm, longDay, type MatchRow, type MatchStatus } from "@/lib/matches";

export type MatchState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string, max = 200) => str(f, k).slice(0, max) || null;
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/rivals_name_uniq/.test(m)) return "Ya hay un rival con ese nombre";
  if (/matches_rival_id_fkey/.test(m)) return "Ese rival tiene partidos: no se puede eliminar";
  if (/maps_url_check|home_maps_url_check/.test(m)) return "El enlace del mapa tiene que empezar por https://";
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  return m;
};
const url = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v && !/^https:\/\/\S+$/.test(v)) throw new Error("El enlace del mapa tiene que empezar por https://");
  return v.slice(0, 500) || null;
};

function refresh(id?: string) {
  revalidatePath("/partidos", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/partidos/${id}`);
}

/** Avisa a todo el equipo (menos a quien hace el cambio). */
async function notifyTeam(title: string, body: string, matchId: string) {
  const s = await getSession();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("active", true).neq("id", s.user.id);
  await sendPush((data ?? []).map((p) => p.id), { title, body, url: `/partidos/${matchId}`, tag: `partido-${matchId}` });
}

const vsText = (m: Pick<MatchRow, "is_home"> & { rival: { name: string } }) => (m.is_home ? `${CLUB_NAME} vs ${m.rival.name}` : `${m.rival.name} vs ${CLUB_NAME}`);
const whenText = (m: Pick<MatchRow, "match_date" | "kickoff">) => `${longDay(m.match_date)}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}`;

/** Rival elegido o uno nuevo escrito en el formulario del partido. */
async function rivalFrom(supabase: Awaited<ReturnType<typeof createClient>>, f: FormData) {
  const id = str(f, "rival_id");
  if (id && id !== "new") return id;
  const name = str(f, "new_rival").slice(0, 60);
  if (!name) throw new Error("Elige el rival o escribe su nombre");
  const { data: found } = await supabase.from("rivals").select("id").ilike("name", name.replace(/[%_]/g, "\\$&")).maybeSingle();
  if (found) return found.id as string;
  const { data, error } = await supabase.from("rivals").insert({ name }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

function matchFromForm(f: FormData) {
  const match_date = str(f, "match_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match_date)) throw new Error("Indica la fecha del partido");
  const k = str(f, "kickoff");
  if (k && !/^\d{2}:\d{2}$/.test(k)) throw new Error("Hora no válida");
  const competition = COMPETITIONS.some((c) => c.key === str(f, "competition")) ? str(f, "competition") : "league";
  return {
    match_date,
    kickoff: k || null,
    competition,
    round: opt(f, "round", 40),
    is_home: str(f, "is_home") !== "0",
    venue: opt(f, "venue", 120),
    maps_url: url(f, "maps_url"),
    notes: opt(f, "notes", 2000),
  };
}

export async function createMatch(_: MatchState, f: FormData): Promise<MatchState> {
  const supabase = await createClient();
  let id: string;
  try {
    const rival_id = await rivalFrom(supabase, f);
    const row = matchFromForm(f);
    // Fuera de casa, si no se indica el campo, el habitual del rival
    if (!row.is_home && !row.venue) {
      const { data: r } = await supabase.from("rivals").select("home_venue, home_maps_url").eq("id", rival_id).single();
      row.venue = r?.home_venue ?? null;
      row.maps_url = row.maps_url ?? r?.home_maps_url ?? null;
    }
    const { data, error } = await supabase.from("matches").insert({ ...row, rival_id }).select("id, is_home, match_date, kickoff, rival:rivals(name)").single();
    if (error) throw error;
    id = data.id;
    if (f.get("notify") === "on") {
      const m = data as unknown as MatchRow;
      await notifyTeam("📅 Nuevo partido en el calendario", `${vsText(m)} · ${whenText(m)}`, id);
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  redirect(f.get("again") ? `/partidos/nuevo?ok=1` : `/partidos/${id}?nuevo=1`);
}

export async function updateMatch(id: string, _: MatchState, f: FormData): Promise<MatchState> {
  const supabase = await createClient();
  try {
    const { data: before } = await supabase.from("matches").select("match_date, kickoff, venue, status").eq("id", id).single();
    const rival_id = await rivalFrom(supabase, f);
    const row = matchFromForm(f);
    const { data, error } = await supabase.from("matches").update({ ...row, rival_id }).eq("id", id).select("id, is_home, match_date, kickoff, rival:rivals(name)").single();
    if (error) throw error;
    const moved = before && (before.match_date !== row.match_date || hhmm(before.kickoff) !== row.kickoff || (before.venue ?? null) !== row.venue);
    if (moved && before.status === "scheduled" && f.get("notify") === "on") {
      const m = data as unknown as MatchRow;
      await notifyTeam("🔁 Cambio en el partido", `${vsText(m)} · ahora el ${whenText(m)}${row.venue ? ` en ${row.venue}` : ""}`, id);
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(id);
  redirect(`/partidos/${id}?guardado=1`);
}

/** Marcador final: el partido pasa a finalizado. */
export async function saveResult(id: string, _: MatchState, f: FormData): Promise<MatchState> {
  const supabase = await createClient();
  try {
    const gf = Number(str(f, "goals_for"));
    const ga = Number(str(f, "goals_against"));
    if (![gf, ga].every((n) => Number.isInteger(n) && n >= 0 && n <= 99) || str(f, "goals_for") === "" || str(f, "goals_against") === "")
      throw new Error("Pon los goles de los dos equipos");
    const { data: before } = await supabase.from("matches").select("status").eq("id", id).single();
    const { data, error } = await supabase.from("matches").update({ goals_for: gf, goals_against: ga, status: "played" })
      .eq("id", id).select("id, is_home, rival:rivals(name)").single();
    if (error) throw error;
    if (f.get("notify") === "on" && before?.status !== "played") {
      const m = data as unknown as MatchRow;
      const score = m.is_home ? `${CLUB_NAME} ${gf} - ${ga} ${m.rival.name}` : `${m.rival.name} ${ga} - ${gf} ${CLUB_NAME}`;
      const title = gf > ga ? "✅ ¡Victoria!" : gf < ga ? "Resultado final" : "🤝 Empate";
      await notifyTeam(title, score, id);
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(id);
  return { ok: "Resultado guardado" };
}

/** Aplazar, suspender o volver a dejarlo pendiente (con fecha nueva opcional). */
export async function setMatchStatus(id: string, _: MatchState, f: FormData): Promise<MatchState> {
  const supabase = await createClient();
  try {
    const status = str(f, "status") as MatchStatus;
    if (!["scheduled", "postponed", "cancelled"].includes(status)) throw new Error("Estado no válido");
    const patch: Record<string, unknown> = { status };
    const nd = str(f, "new_date");
    if (nd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) throw new Error("Fecha no válida");
      patch.match_date = nd;
      patch.status = "scheduled";
      const nk = str(f, "new_kickoff");
      if (nk && !/^\d{2}:\d{2}$/.test(nk)) throw new Error("Hora no válida");
      patch.kickoff = nk || null;
    }
    // Al volver a pendiente se quita el marcador
    if (patch.status === "scheduled") Object.assign(patch, { goals_for: null, goals_against: null });
    const { data, error } = await supabase.from("matches").update(patch).eq("id", id).select("id, is_home, match_date, kickoff, rival:rivals(name)").single();
    if (error) throw error;
    if (f.get("notify") === "on") {
      const m = data as unknown as MatchRow;
      const reason = opt(f, "reason", 140);
      if (status === "postponed" && !nd) await notifyTeam("⏸️ Partido aplazado", `${vsText(m)}${reason ? ` · ${reason}` : ""}. Os avisaremos de la nueva fecha.`, id);
      else if (status === "cancelled") await notifyTeam("⛔ Partido suspendido", `${vsText(m)}${reason ? ` · ${reason}` : ""}`, id);
      else if (nd) await notifyTeam("📅 Nueva fecha del partido", `${vsText(m)} · ${whenText(m)}`, id);
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh(id);
  return { ok: "Partido actualizado" };
}

export async function deleteMatch(id: string): Promise<MatchState> {
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { error: errMsg(error) };
  refresh();
  redirect("/partidos?eliminado=1");
}

// ---------------------------------------------------------------- Rivales
function rivalFromForm(f: FormData) {
  const name = str(f, "name").slice(0, 60);
  if (!name) throw new Error("Indica el nombre del rival");
  const color = str(f, "color");
  return {
    name,
    short_name: opt(f, "short_name", 4)?.toUpperCase() ?? null,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    home_venue: opt(f, "home_venue", 120),
    home_maps_url: url(f, "home_maps_url"),
    notes: opt(f, "notes", 1000),
  };
}

const CREST_MIME = ["image/png", "image/jpeg", "image/webp"];
async function uploadCrest(supabase: Awaited<ReturnType<typeof createClient>>, id: string, f: FormData) {
  const file = f.get("crest");
  if (!(file instanceof File) || file.size === 0) return;
  if (!CREST_MIME.includes(file.type)) throw new Error("El escudo tiene que ser una imagen PNG, JPG o WebP");
  if (file.size > 1024 * 1024) throw new Error("El escudo pesa demasiado (máximo 1 MB)");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${id}/${Date.now()}.${ext}`;
  const { data: old } = await supabase.storage.from("rival-crests").list(id);
  const { error } = await supabase.storage.from("rival-crests").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  if (old?.length) await supabase.storage.from("rival-crests").remove(old.map((o) => `${id}/${o.name}`));
  const crest_url = supabase.storage.from("rival-crests").getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await supabase.from("rivals").update({ crest_url }).eq("id", id);
  if (e2) throw e2;
}

export async function saveRival(id: string | null, _: MatchState, f: FormData): Promise<MatchState> {
  const supabase = await createClient();
  try {
    const row = rivalFromForm(f);
    let rid = id;
    if (rid) {
      const { error } = await supabase.from("rivals").update(row).eq("id", rid);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("rivals").insert(row).select("id").single();
      if (error) throw error;
      rid = data.id as string;
    }
    if (f.get("remove_crest") === "on") {
      const { data: old } = await supabase.storage.from("rival-crests").list(rid);
      if (old?.length) await supabase.storage.from("rival-crests").remove(old.map((o) => `${rid}/${o.name}`));
      await supabase.from("rivals").update({ crest_url: null }).eq("id", rid);
    } else await uploadCrest(supabase, rid, f);
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  return { ok: id ? "Rival guardado" : "Rival añadido" };
}

export async function deleteRival(id: string): Promise<MatchState> {
  const supabase = await createClient();
  const { error } = await supabase.from("rivals").delete().eq("id", id);
  if (error) return { error: errMsg(error) };
  const { data: old } = await supabase.storage.from("rival-crests").list(id);
  if (old?.length) await supabase.storage.from("rival-crests").remove(old.map((o) => `${id}/${o.name}`));
  refresh();
  return { ok: "Rival eliminado" };
}

// ---------------------------------------------------------------- Liga (futormes)
export type LeagueState = { error?: string; ok?: string; teams?: { id: string; name: string }[]; competition?: string } | undefined;

export async function saveLeague(_: LeagueState, f: FormData): Promise<LeagueState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  const { competitionFromUrl, fetchLeague } = await import("@/lib/league-sync");
  const competition = competitionFromUrl(str(f, "url"));
  if (!competition) return { error: "Pega la dirección de la competición en futormes (la que acaba en «?itm=…»)" };
  try {
    const league = await fetchLeague(competition);
    let team = str(f, "team");
    if (!team || !league.teams.some((t) => t.id === team)) team = league.teams.find((t) => /rayo\s+valleca/i.test(t.name))?.id ?? "";
    if (!team) return { error: "No encuentro a Rayo Vallecañas en esa competición: elige nuestro equipo.", teams: league.teams, competition };
    const supabase = await createClient();
    const { error } = await supabase.from("league_sync").upsert({ id: 1, provider: "futormes", competition, team, competition_name: league.competitionName?.slice(0, 160) ?? null, updated_by: s.user.id });
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/partidos", "layout");
  return { ok: "Liga guardada. Ya puedes sincronizar." };
}

export async function runLeagueSync(): Promise<LeagueState> {
  const s = await getSession();
  if (!s.can("matches", "update")) return { error: "No tienes permiso para hacer esto" };
  try {
    const { syncLeague } = await import("@/lib/league-sync");
    const r = await syncLeague({ notifyExcept: s.user.id });
    refresh();
    const bits = [
      r.matchesNew && `${r.matchesNew} ${r.matchesNew === 1 ? "partido nuevo" : "partidos nuevos"}`,
      r.matchesUpdated && `${r.matchesUpdated} ${r.matchesUpdated === 1 ? "partido actualizado" : "partidos actualizados"}`,
      r.rivalsNew && `${r.rivalsNew} ${r.rivalsNew === 1 ? "rival nuevo" : "rivales nuevos"}`,
      r.playersNew && `${r.playersNew} ${r.playersNew === 1 ? "jugador nuevo" : "jugadores nuevos"} en la plantilla`,
    ].filter(Boolean);
    revalidatePath("/plantilla", "layout");
    if (r.squadError) return { ok: `${bits.length ? `¡Listo! ${bits.join(", ")}.` : "Calendario al día."} La plantilla no se ha podido leer: ${r.squadError}` };
    return { ok: bits.length ? `¡Listo! ${bits.join(", ")}.` : "Todo al día: no había cambios en la liga." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
