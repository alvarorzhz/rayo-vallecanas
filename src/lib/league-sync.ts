import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { CLUB_NAME, hhmm, longDay } from "@/lib/matches";
import { seasonOf } from "@/lib/finance";
import {
  inspectCalendar, inspectPlayer, inspectSheet, inspectTable, inspectTeam, parseCompetitionName, parseSheet, prettyTeam,
  type LeaguePlayer, type LeagueRow, type SheetRow,
} from "@/lib/league-parse";
import { resultNotice } from "@/lib/result-watch";
import { alertLeagueProblem, recordLeagueFailure, type LeagueStatus } from "@/lib/league-alerts";

// Los lectores de páginas viven en league-parse.ts (sin dependencias, con pruebas propias)
export { competitionFromUrl, decode, parseCalendar, parsePlayer, parseSheet, parseTable, prettyTeam, titleCase } from "@/lib/league-parse";
export type { LeaguePlayer, LeagueRow, SheetRow } from "@/lib/league-parse";

const finance_season = (date: string) => seasonOf(new Date(`${date}T12:00:00Z`));

/**
 * Sincronización con la web de la liga (futormes.com, gestionada con ServerSports).
 * Se leen las páginas públicas de la competición: equipos, escudos, calendario,
 * campos y resultados. Solo se tocan los partidos de nuestro equipo.
 *
 * Si algo no se puede leer (la liga ha cambiado su web, falla una ficha…), la
 * sincronización sigue con lo que sí ha leído, apunta cada incidencia y avisa a
 * quienes gestionan los partidos (ver league-alerts.ts).
 */

const BASE = "https://www.futormes.com/mod/soccer";
const UA = "Mozilla/5.0 (compatible; RayoVallecanasApp/3.0; +https://rayo-vallecanas.vercel.app)";

export type LeagueData = { competitionName: string | null; teams: { id: string; name: string }[]; rows: LeagueRow[]; issues: string[] };

/** La web guarda la competición elegida en la sesión: primero se abre su portada y luego el resto con la misma cookie. */
export async function openSession(competition: string) {
  const jar = new Map<string, string>();
  const get = async (path: string) => {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { "User-Agent": UA, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    if (!res.ok) throw new Error(`La web de la liga no responde (${res.status})`);
    return res.text();
  };
  const situation = await get(`situation.aspx?itm=${competition}`);
  return { get, situation };
}

export async function fetchLeague(competition: string, sess?: Awaited<ReturnType<typeof openSession>>): Promise<LeagueData> {
  const { get, situation } = sess ?? (await openSession(competition));
  const calendar = await get("calendar.aspx");
  const cal = inspectCalendar(calendar);
  const rows = cal.items;
  if (!rows.length) throw new Error(cal.issues[0] ?? "No se ha encontrado el calendario. Revisa la dirección de la competición.");
  const teams = new Map<string, string>();
  for (const r of rows) {
    teams.set(r.homeId, r.homeName);
    teams.set(r.awayId, r.awayName);
  }
  const comp = parseCompetitionName(situation);
  const issues = [...cal.issues];
  if (!comp) issues.push("Portada: no aparece el nombre de la competición.");
  return { competitionName: comp, teams: [...teams].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es")), rows, issues };
}

/** Escudo grande y, si no hay, el pequeño. */
const crestUrls = (teamId: string) => ["shields_g", "shields_p"].map((d) => `https://www.futormes.com/storage/soccer/${d}/${teamId}.png`);

// ---------------------------------------------------------------- Plantilla

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Nombre y apellidos: las dos últimas palabras son los apellidos. */
const splitName = (full: string) => {
  const w = full.split(" ");
  return w.length <= 2 ? { first_name: w[0], last_name: w.slice(1).join(" ") } : { first_name: w.slice(0, -2).join(" "), last_name: w.slice(-2).join(" ") };
};

async function syncSquad(admin: ReturnType<typeof createAdminClient>, get: (p: string) => Promise<string>, team: string, season: string, issues: string[]) {
  const html = await get(`team.aspx?itm=${team}`);
  const roster = inspectTeam(html);
  issues.push(...roster.issues);
  const ids = roster.items;
  const list: LeaguePlayer[] = [];
  const unread: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < ids.length; i += 5) {
    const batch = await Promise.all(ids.slice(i, i + 5).map(async (id) => {
      try {
        const r = inspectPlayer(id, await get(`player.aspx?itm=${id}`));
        if (r.issues.length) unread.push(...r.issues);
        return r.player;
      } catch {
        failed.push(id);
        return null;
      }
    }));
    list.push(...batch.filter((p): p is LeaguePlayer => !!p));
  }
  // Una ficha que no se lee no tumba el resto: se apunta y se sigue
  if (failed.length) issues.push(`Plantilla: ${failed.length} de ${ids.length} fichas de jugador no se han podido descargar.`);
  for (const msg of new Set(unread)) issues.push(`${msg} (${unread.filter((m) => m === msg).length} de ${ids.length})`);
  const [{ data: players }, { data: members }] = await Promise.all([
    admin.from("players").select("id, first_name, last_name, nickname, foot, height_cm, ext_id"),
    admin.from("squad_members").select("id, player_id, number, status").eq("season", season),
  ]);
  const memberOf = new Map((members ?? []).map((m) => [m.player_id as string, m]));
  let playersNew = 0, playersUpdated = 0;
  for (const lp of list) {
    const ext = `futormes:${lp.extId}`;
    const full = norm(lp.name);
    // Ya en la app: por su enlace con la liga, por el nombre o por el dorsal de esta temporada con el mismo nombre de pila
    let p = players?.find((x) => x.ext_id === ext)
      ?? players?.find((x) => { const n = norm(`${x.first_name} ${x.last_name}`); return n === full || (n.split(" ").length >= 2 && full.startsWith(n + " ")); })
      ?? players?.find((x) => memberOf.get(x.id)?.number === lp.number && norm(x.first_name) === norm(splitName(lp.name).first_name));
    if (!p) {
      const { data, error } = await admin.from("players").insert({ ...splitName(lp.name), nickname: lp.nickname, foot: lp.foot, height_cm: lp.height, ext_id: ext })
        .select("id, first_name, last_name, nickname, foot, height_cm, ext_id").single();
      if (error) throw error;
      p = data;
      playersNew++;
      if (lp.birth) await admin.from("player_private").update({ birth_date: lp.birth }).eq("player_id", p.id);
    } else {
      // Solo se rellena lo que falta: lo editado en la app manda
      const patch: Record<string, unknown> = {};
      if (!p.ext_id) patch.ext_id = ext;
      if (!p.foot && lp.foot) patch.foot = lp.foot;
      if (!p.height_cm && lp.height) patch.height_cm = lp.height;
      if (!p.nickname && lp.nickname) patch.nickname = lp.nickname;
      if (Object.keys(patch).length) { await admin.from("players").update(patch).eq("id", p.id); playersUpdated++; }
      if (lp.birth) await admin.from("player_private").update({ birth_date: lp.birth }).eq("player_id", p.id).is("birth_date", null);
    }
    // Las fotos de la liga no se traen: son diminutas (71×85) y en el cromo se ven pixeladas.
    // Cada jugador sube la suya desde su ficha.
    // Ficha de la temporada y estadísticas de la liga
    // Los totales de la liga van aparte: la app suma previas + actas y, de cada dato, lo que la liga tenga de más
    const stats = { league_stats: { apps: lp.apps, goals: lp.goals, conceded: lp.line === "POR" ? lp.conceded : 0, yellows: lp.yellows, reds: lp.reds } };
    const m = memberOf.get(p!.id);
    if (!m) {
      const { error } = await admin.from("squad_members").insert({ player_id: p!.id, season, number: lp.number, position: lp.line, status: "active", joined_on: new Date().toISOString().slice(0, 10), ...stats });
      // Dorsal repetido: entra sin dorsal
      if (error && /number_uniq/.test(error.message)) await admin.from("squad_members").insert({ player_id: p!.id, season, number: null, position: lp.line, status: "active", ...stats });
      else if (error) throw error;
    } else {
      await admin.from("squad_members").update(stats).eq("id", m.id);
    }
  }
  return { playersNew, playersUpdated, players: list.length };
}

export type SyncSummary = {
  playersNew: number; players: number; squadError?: string; rivalsNew: number; matchesNew: number; matchesUpdated: number; results: number;
  competition: string | null; at: string;
  /** ok: todo leído · partial: guardado lo que se pudo leer, con incidencias · failed: no se guardó nada */
  status: LeagueStatus;
  issues: string[];
};

/**
 * Trae los partidos de nuestro equipo y los guarda. Los cambios que haga un gestor
 * a mano (observaciones, enlace de mapa, resultado puesto antes que la liga) no se pisan.
 * Si falla o queda a medias, se avisa a los gestores (menos a quien la lanzó, que lo ve en pantalla).
 */
export async function syncLeague(opts: { notifyExcept?: string } = {}): Promise<SyncSummary> {
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("*").eq("id", 1).maybeSingle();
  if (!cfg) throw new Error("Primero configura la liga");
  try {
    const summary = await runSync(admin, cfg, opts);
    if (summary.status !== "ok") await alertLeagueProblem({ status: summary.status, issues: summary.issues, source: "sync", except: opts.notifyExcept });
    return summary;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordLeagueFailure(msg);
    await alertLeagueProblem({ status: "failed", issues: [msg], source: "sync", except: opts.notifyExcept });
    throw e;
  }
}

type Cfg = { competition: string; team: string; competition_name: string | null; last_summary: Record<string, unknown> | null };

async function runSync(admin: ReturnType<typeof createAdminClient>, cfg: Cfg, opts: { notifyExcept?: string }): Promise<SyncSummary> {
  const sess = await openSession(cfg.competition);
  const league = await fetchLeague(cfg.competition, sess);
  const issues = [...league.issues];
  const ours = league.rows.filter((r) => r.homeId === cfg.team || r.awayId === cfg.team);
  if (!ours.length) throw new Error("No aparece nuestro equipo en esa competición");

  // ---- Rivales: todos los equipos de la liga menos el nuestro
  const { data: existing } = await admin.from("rivals").select("id, name, ext_id, crest_url");
  const byExt = new Map((existing ?? []).filter((r) => r.ext_id).map((r) => [r.ext_id as string, r]));
  const byName = new Map((existing ?? []).map((r) => [r.name.trim().toLowerCase(), r]));
  const rivalId = new Map<string, string>();
  let rivalsNew = 0;
  for (const t of league.teams) {
    if (t.id === cfg.team) continue;
    const ext = `futormes:${t.id}`;
    const name = prettyTeam(t.name).slice(0, 60);
    let r = byExt.get(ext) ?? byName.get(name.toLowerCase()) ?? byName.get(t.name.toLowerCase());
    if (r && !r.ext_id) await admin.from("rivals").update({ ext_id: ext }).eq("id", r.id);
    if (!r) {
      const { data, error } = await admin.from("rivals").insert({ name, ext_id: ext }).select("id, name, ext_id, crest_url").single();
      if (error) throw error;
      r = data;
      rivalsNew++;
    }
    rivalId.set(t.id, r!.id);
    // Escudo: se copia a nuestro almacenamiento la primera vez
    if (!r!.crest_url) {
      try {
        for (const u of crestUrls(t.id)) {
          const img = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
          if (!img.ok || !img.headers.get("content-type")?.startsWith("image/png")) continue;
          const buf = await img.arrayBuffer();
          if (buf.byteLength >= 1024 * 1024) continue;
          const path = `${r!.id}/${Date.now()}.png`;
          const up = await admin.storage.from("rival-crests").upload(path, buf, { contentType: "image/png", upsert: true });
          if (!up.error) {
            const url = admin.storage.from("rival-crests").getPublicUrl(path).data.publicUrl;
            await admin.from("rivals").update({ crest_url: url }).eq("id", r!.id);
          }
          break;
        }
      } catch {
        /* sin escudo: se pinta el genérico */
      }
    }
  }

  // ---- Partidos
  const { data: current } = await admin.from("matches").select("id, ext_id, match_date, kickoff, status, goals_for, goals_against, venue")
    .in("ext_id", ours.map((r) => `futormes:${r.extId}`));
  const prev = new Map((current ?? []).map((m) => [m.ext_id as string, m]));
  const firstImport = !current?.length;
  let matchesNew = 0, matchesUpdated = 0, results = 0;
  const pushes: { title: string; body: string; id: string }[] = [];

  for (const r of ours) {
    const home = r.homeId === cfg.team;
    const oppId = home ? r.awayId : r.homeId;
    const oppName = prettyTeam(home ? r.awayName : r.homeName);
    const base = {
      match_date: r.date,
      kickoff: r.time,
      competition: "league" as const,
      round: r.round.slice(0, 40),
      rival_id: rivalId.get(oppId)!,
      is_home: home,
      venue: r.venue?.slice(0, 120) ?? null,
    };
    const score = r.status === "played" ? { goals_for: home ? r.goalsHome : r.goalsAway, goals_against: home ? r.goalsAway : r.goalsHome } : null;
    const ext = `futormes:${r.extId}`;
    const old = prev.get(ext);
    const vs = home ? `${CLUB_NAME} vs ${oppName}` : `${oppName} vs ${CLUB_NAME}`;
    if (!old) {
      const mapsQ = [r.venue, r.address].filter(Boolean).join(", ");
      const { error } = await admin.from("matches").insert({
        ...base, ext_id: ext,
        maps_url: mapsQ ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQ)}` : null,
        status: score ? "played" : r.status,
        ...(score ?? {}),
      });
      if (error) throw error;
      matchesNew++;
      if (score) results++;
      continue;
    }
    const patch: Record<string, unknown> = { ...base };
    if (score) Object.assign(patch, { status: "played", ...score });
    else if (r.status === "postponed" || r.status === "cancelled") patch.status = r.status;
    else if (old.status === "postponed" || old.status === "cancelled") patch.status = "scheduled";
    const changed =
      old.match_date !== base.match_date || hhmm(old.kickoff) !== base.kickoff || (old.venue ?? null) !== base.venue ||
      (patch.status && patch.status !== old.status) ||
      (score && (old.goals_for !== score.goals_for || old.goals_against !== score.goals_against));
    if (!changed) continue;
    const { error } = await admin.from("matches").update(patch).eq("id", old.id);
    if (error) throw error;
    matchesUpdated++;
    if (score && old.status !== "played") {
      results++;
      const [gf, ga] = [score.goals_for!, score.goals_against!];
      pushes.push({ id: old.id, ...resultNotice({ gf, ga, home, club: CLUB_NAME, rival: oppName }) });
    } else if (!score && (old.match_date !== base.match_date || hhmm(old.kickoff) !== base.kickoff) && r.date >= new Date().toISOString().slice(0, 10)) {
      pushes.push({ id: old.id, title: "🔁 Cambio en el partido", body: `${vs} · ahora el ${longDay(r.date)}${r.time ? ` a las ${r.time}` : ""}` });
    }
  }

  // Avisos (nunca en la primera importación, que serían todos a la vez)
  if (!firstImport && pushes.length) {
    const { data: people } = await admin.from("profiles").select("id").eq("active", true);
    const ids = (people ?? []).map((p) => p.id).filter((id) => id !== opts.notifyExcept);
    for (const p of pushes.slice(0, 5)) await sendPush(ids, { title: p.title, body: p.body, url: `/partidos/${p.id}`, tag: `partido-${p.id}` });
  }

  // ---- Plantilla de la temporada (si falla, el calendario ya está guardado)
  let squad = { playersNew: 0, players: 0 } as { playersNew: number; players: number; squadError?: string };
  try {
    const season = finance_season(ours[0].date);
    const r = await syncSquad(admin, sess.get, cfg.team, season, issues);
    squad = { playersNew: r.playersNew, players: r.players };
  } catch (e) {
    squad.squadError = e instanceof Error ? e.message : String(e);
    issues.push(`Plantilla: no se ha podido leer (${squad.squadError}).`);
  }

  // ---- Clasificación: no se guarda, pero se comprueba que se sigue leyendo bien
  try {
    issues.push(...inspectTable(await sess.get("table.aspx")).issues);
  } catch (e) {
    issues.push(`Clasificación: no se ha podido descargar (${e instanceof Error ? e.message : String(e)}).`);
  }

  const summary: SyncSummary = {
    ...squad, rivalsNew, matchesNew, matchesUpdated, results, competition: league.competitionName, at: new Date().toISOString(),
    status: issues.length ? "partial" : "ok", issues,
  };
  // Se conservan la última revisión semanal y el último aviso enviado
  const keep = Object.fromEntries(Object.entries(cfg.last_summary ?? {}).filter(([k]) => k === "health" || k === "alert"));
  await admin.from("league_sync").update({ last_synced_at: summary.at, last_summary: { ...keep, ...summary }, competition_name: league.competitionName?.slice(0, 160) ?? cfg.competition_name }).eq("id", 1);
  return summary;
}

// ---------------------------------------------------------------------
// Revisión semanal (solo lectura): ¿se sigue entendiendo la web de la liga?
// ---------------------------------------------------------------------
export type HealthReport = { status: LeagueStatus; issues: string[]; at: string; checked: string[] };

/**
 * Abre las mismas páginas que la sincronización (portada, calendario, clasificación,
 * plantilla, una ficha de jugador y la ficha de nuestro último partido) y comprueba que
 * se leen. No guarda partidos ni jugadores: la sincronización sigue siendo con el botón.
 */
export async function checkLeagueHealth(competition: string, team: string): Promise<HealthReport> {
  const issues: string[] = [];
  const checked: string[] = [];
  const at = new Date().toISOString();
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checked.push(name);
    } catch (e) {
      issues.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  let sess: Awaited<ReturnType<typeof openSession>>;
  try {
    sess = await openSession(competition);
  } catch (e) {
    return { status: "failed", issues: [`Portada: ${e instanceof Error ? e.message : String(e)}`], at, checked };
  }
  let rows: LeagueRow[] = [];
  await step("Calendario", async () => {
    const league = await fetchLeague(competition, sess);
    rows = league.rows;
    issues.push(...league.issues);
    if (!rows.some((r) => r.homeId === team || r.awayId === team)) issues.push("Calendario: no aparece nuestro equipo.");
  });
  await step("Clasificación", async () => {
    const t = inspectTable(await sess.get("table.aspx"));
    issues.push(...t.issues);
    if (t.items.length && !t.items.some((r) => r.teamId === team)) issues.push("Clasificación: no aparece nuestro equipo.");
  });
  await step("Plantilla", async () => {
    const roster = inspectTeam(await sess.get(`team.aspx?itm=${team}`));
    issues.push(...roster.issues);
    if (roster.items[0]) issues.push(...inspectPlayer(roster.items[0], await sess.get(`player.aspx?itm=${roster.items[0]}`)).issues);
  });
  const last = rows.filter((r) => r.status === "played" && (r.homeId === team || r.awayId === team)).at(-1);
  if (last) {
    await step("Ficha del partido", async () => {
      const sheet = inspectSheet(await sess.get(`match.aspx?itm=${last.extId}`), last.homeId === team ? "L" : "V");
      issues.push(...sheet.issues);
    });
  }
  const status: LeagueStatus = !checked.length ? "failed" : issues.length ? "partial" : "ok";
  return { status, issues, at, checked };
}

// ---------------------------------------------------------------------
// Ficha de un partido (match.aspx): quién jugó, goles, encajados y tarjetas
// ---------------------------------------------------------------------
/** Ficha de uno de nuestros partidos en la web de la liga. */
export async function fetchSheet(competition: string, matchExt: string, home: boolean): Promise<SheetRow[]> {
  if (!/^\d{1,9}$/.test(matchExt)) throw new Error("Partido de la liga no válido");
  const { get } = await openSession(competition);
  const html = await get(`match.aspx?itm=${matchExt}`);
  return parseSheet(html, home ? "L" : "V");
}
