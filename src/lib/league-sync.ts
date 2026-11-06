import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { CLUB_NAME, hhmm, longDay } from "@/lib/matches";
import { seasonOf } from "@/lib/finance";

const finance_season = (date: string) => seasonOf(new Date(`${date}T12:00:00Z`));

/**
 * Sincronización con la web de la liga (futormes.com, gestionada con ServerSports).
 * Se leen las páginas públicas de la competición: equipos, escudos, calendario,
 * campos y resultados. Solo se tocan los partidos de nuestro equipo.
 */

const BASE = "https://www.futormes.com/mod/soccer";
const UA = "Mozilla/5.0 (compatible; RayoVallecanasApp/3.0; +https://rayo-vallecanas.vercel.app)";

export type LeagueRow = {
  extId: string;
  round: string;
  date: string;          // "2026-11-08"
  time: string | null;   // "18:00"
  venue: string | null;  // "La Aldehuela A1"
  address: string | null;
  homeId: string;
  homeName: string;
  awayId: string;
  awayName: string;
  goalsHome: number | null;
  goalsAway: number | null;
  status: "played" | "scheduled" | "postponed" | "cancelled";
};

export type LeagueData = { competitionName: string | null; teams: { id: string; name: string }[]; rows: LeagueRow[] };

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ({ aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", ordf: "ª", ordm: "º", middot: "·" } as Record<string, string>)[n] ?? m)
    .replace(/\s+/g, " ").trim();

/** Número de competición a partir de la dirección que se pega ("…situation.aspx?itm=15868") o del número suelto. */
export function competitionFromUrl(input: string): string | null {
  const s = input.trim();
  if (/^\d{1,9}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)futormes\.com$/i.test(u.hostname)) return null;
    const itm = u.searchParams.get("itm");
    return itm && /^\d{1,9}$/.test(itm) ? itm : null;
  } catch {
    return null;
  }
}

/** La web guarda la competición elegida en la sesión: primero se abre su portada y luego el resto con la misma cookie. */
async function openSession(competition: string) {
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

const field = (row: string, key: string) => row.match(new RegExp(`_${key}"[^>]*>([^<]*)<`))?.[1];

export function parseCalendar(calendar: string): LeagueRow[] {
  const rows: LeagueRow[] = [];
  const sections = calendar.split(/rptCalendarioJornada_ctl\d+_lblJornada"[^>]*>/).slice(1);
  for (const sec of sections) {
    const round = decode(sec.slice(0, sec.indexOf("<")));
    for (const tr of sec.split(/<tr[\s>]/).slice(1)) {
      if (!tr.includes("_lblFecha")) continue;
      const fecha = field(tr, "lblFecha");
      const local = tr.match(/_hlkLocal" title="([^"]*)" href="team\.aspx\?itm=(\d+)"/);
      const visit = tr.match(/_hlkVisitante" title="([^"]*)" href="team\.aspx\?itm=(\d+)"/);
      const id = tr.match(/_hlkPartido"[^>]*href="match\.aspx\?itm=(\d+)"/)?.[1];
      if (!fecha || !local || !visit || !id) continue;
      const [d, m, y] = fecha.trim().split(".");
      const time = field(tr, "lblHora")?.trim() || null;
      const campo = tr.match(/_lblCampo" title="([^"]*)"/)?.[1];
      const parts = campo ? decode(campo).split(" · ") : [];
      const score = field(tr, "lblMarcador")?.match(/(\d+)\s*-\s*(\d+)/);
      const state = (tr.match(/_imgFinalizado" title="([^"]*)"/)?.[1] ?? "").toLowerCase();
      rows.push({
        extId: id,
        round: round || "Jornada",
        date: `${y}-${m}-${d}`,
        time: time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : null,
        venue: parts[0] || null,
        address: parts.length > 1 ? parts.slice(1).join(", ") : null,
        homeId: local[2],
        homeName: decode(local[1]),
        awayId: visit[2],
        awayName: decode(visit[1]),
        goalsHome: score ? Number(score[1]) : null,
        goalsAway: score ? Number(score[2]) : null,
        status: state.includes("aplazado") ? "postponed" : state.includes("suspendido") ? "cancelled" : state.includes("finalizado") && score ? "played" : "scheduled",
      });
    }
  }
  return rows;
}

export async function fetchLeague(competition: string, sess?: Awaited<ReturnType<typeof openSession>>): Promise<LeagueData> {
  const { get, situation } = sess ?? (await openSession(competition));
  const calendar = await get("calendar.aspx");
  const rows = parseCalendar(calendar);
  if (!rows.length) throw new Error("No se ha encontrado el calendario. Revisa la dirección de la competición.");
  const teams = new Map<string, string>();
  for (const r of rows) {
    teams.set(r.homeId, r.homeName);
    teams.set(r.awayId, r.awayName);
  }
  const comp = decode(situation).match(/Campeonato:(?:<\/b>)?\s*([^"<]{3,160})/)?.[1]?.trim() ?? null;
  return { competitionName: comp, teams: [...teams].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es")), rows };
}

/** Escudo grande y, si no hay, el pequeño. */
const crestUrls = (teamId: string) => ["shields_g", "shields_p"].map((d) => `https://www.futormes.com/storage/soccer/${d}/${teamId}.png`);

/** "PIZA 1904-BAR KFETÍN" -> "Piza 1904-Bar Kfetín"; las siglas (CF, FC, CB…) se quedan en mayúsculas. */
export function prettyTeam(name: string) {
  const keep = /^(CF|FC|CD|UD|AD|SD|CB|RL|BZ|CP|SAD|UDS|AT|II|III|IV|F7)\.?$/i;
  return titleCase(name, keep);
}

/** Mayúscula inicial en cada palabra, salvo las partículas ("de", "del", "la") y las siglas. */
export function titleCase(name: string, keep = /^$/) {
  const small = /^(de|del|la|las|los|y|e)$/;
  return name
    .toLowerCase()
    .replace(/(^|[\s\-/(.])([\p{L}\d]+)/gu, (m, sep: string, w: string, off: number) =>
      sep + (keep.test(w) ? w.toUpperCase() : off > 0 && sep === " " && small.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .replace(/\bC\.b\b/g, "C.B");
}

// ---------------------------------------------------------------- Plantilla

export type LeaguePlayer = {
  extId: string; name: string; number: number | null; nickname: string | null; line: "POR" | "DFC" | "MCD" | "DC";
  foot: "right" | "left" | "both" | null; birth: string | null; height: number | null; photo: string | null;
  apps: number; goals: number; conceded: number; yellows: number; reds: number;
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const lbl = (html: string, id: string) => {
  const m = html.match(new RegExp(`id="ctl00_ContentPlaceHolder1_${id}"[^>]*>([^<]*)<`));
  return m ? decode(m[1]) : "";
};
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function parsePlayer(extId: string, html: string): LeaguePlayer | null {
  const name = lbl(html, "lblJugadorInfoNombre");
  if (!name) return null;
  const nick = lbl(html, "lblApodo");
  const line = ({ portero: "POR", defensa: "DFC", centrocampista: "MCD", delantero: "DC" } as const)[lbl(html, "lblDemaracion").toLowerCase() as "portero"] ?? "MCD";
  const foot = ({ diestro: "right", zurdo: "left", ambidiestro: "both" } as const)[lbl(html, "lblLateralidad").toLowerCase() as "diestro"] ?? null;
  const b = lbl(html, "lblFechaNacimiento").match(/(\d{1,2}) de (\p{L}+) de (\d{4})/u);
  const mi = b ? MONTHS.indexOf(b[2].toLowerCase()) : -1;
  const height = num(lbl(html, "lblAltura"));
  const photo = new RegExp(`imgJugadorInfoFoto"[^>]*src="/storage/soccer/players/${extId}\\.jpg"`).test(html) ? `https://www.futormes.com/storage/soccer/players/${extId}.jpg` : null;
  return {
    extId, name: titleCase(name), number: num(lbl(html, "lblDorsal")),
    nickname: nick && !/^sin (definir|apodo)$/i.test(nick) ? nick.slice(0, 24) : null,
    line, foot,
    birth: b && mi >= 0 ? `${b[3]}-${String(mi + 1).padStart(2, "0")}-${b[1].padStart(2, "0")}` : null,
    height: height && height >= 120 && height <= 230 ? height : null,
    photo,
    apps: num(lbl(html, "lblEstadisticasPartidosJugados")) ?? 0,
    goals: num(lbl(html, "lblEstadisticasGolesMarcados")) ?? 0,
    conceded: num(lbl(html, "lblEstadisticasGolesRecibidos")) ?? 0,
    yellows: num(lbl(html, "lblEstadisticasTarjetasAmarillas")) ?? 0,
    reds: num(lbl(html, "lblEstadisticasTarjetasRojas")) ?? 0,
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Nombre y apellidos: las dos últimas palabras son los apellidos. */
const splitName = (full: string) => {
  const w = full.split(" ");
  return w.length <= 2 ? { first_name: w[0], last_name: w.slice(1).join(" ") } : { first_name: w.slice(0, -2).join(" "), last_name: w.slice(-2).join(" ") };
};

async function syncSquad(admin: ReturnType<typeof createAdminClient>, get: (p: string) => Promise<string>, team: string, season: string) {
  const html = await get(`team.aspx?itm=${team}`);
  const ids = [...new Set([...html.matchAll(/dgrJugadores_ctl\d+_hlkJugador"[^>]*href="player\.aspx\?itm=(\d+)"/g)].map((m) => m[1]))];
  const list: LeaguePlayer[] = [];
  for (let i = 0; i < ids.length; i += 5) {
    const batch = await Promise.all(ids.slice(i, i + 5).map(async (id) => parsePlayer(id, await get(`player.aspx?itm=${id}`))));
    list.push(...batch.filter((p): p is LeaguePlayer => !!p));
  }
  const [{ data: players }, { data: members }] = await Promise.all([
    admin.from("players").select("id, first_name, last_name, nickname, foot, height_cm, photo_url, ext_id"),
    admin.from("squad_members").select("id, player_id, number, starts, status").eq("season", season),
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
    let photoFor: string | null = null;
    if (!p) {
      const { data, error } = await admin.from("players").insert({ ...splitName(lp.name), nickname: lp.nickname, foot: lp.foot, height_cm: lp.height, ext_id: ext })
        .select("id, first_name, last_name, nickname, foot, height_cm, photo_url, ext_id").single();
      if (error) throw error;
      p = data;
      playersNew++;
      if (lp.birth) await admin.from("player_private").update({ birth_date: lp.birth }).eq("player_id", p.id);
      photoFor = lp.photo;
    } else {
      // Solo se rellena lo que falta: lo editado en la app manda
      const patch: Record<string, unknown> = {};
      if (!p.ext_id) patch.ext_id = ext;
      if (!p.foot && lp.foot) patch.foot = lp.foot;
      if (!p.height_cm && lp.height) patch.height_cm = lp.height;
      if (!p.nickname && lp.nickname) patch.nickname = lp.nickname;
      if (Object.keys(patch).length) { await admin.from("players").update(patch).eq("id", p.id); playersUpdated++; }
      if (lp.birth) await admin.from("player_private").update({ birth_date: lp.birth }).eq("player_id", p.id).is("birth_date", null);
      if (!p.photo_url) photoFor = lp.photo;
    }
    // Ficha de la temporada y estadísticas de la liga
    const stats = { apps: lp.apps, goals: lp.goals, conceded: lp.line === "POR" ? lp.conceded : 0, yellows: lp.yellows, reds: lp.reds };
    const m = memberOf.get(p!.id);
    if (!m) {
      const { error } = await admin.from("squad_members").insert({ player_id: p!.id, season, number: lp.number, position: lp.line, status: "active", joined_on: new Date().toISOString().slice(0, 10), ...stats });
      // Dorsal repetido: entra sin dorsal
      if (error && /number_uniq/.test(error.message)) await admin.from("squad_members").insert({ player_id: p!.id, season, number: null, position: lp.line, status: "active", ...stats });
      else if (error) throw error;
    } else {
      await admin.from("squad_members").update({ ...stats, apps: Math.max(stats.apps, m.starts ?? 0) }).eq("id", m.id);
    }
    // Foto provisional (las de la liga son pequeñas)
    if (photoFor) {
      try {
        const img = await fetch(photoFor, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
        if (img.ok && img.headers.get("content-type")?.startsWith("image/jpeg")) {
          const path = `${p!.id}/foto-${Date.now()}.jpg`;
          const up = await admin.storage.from("player-photos").upload(path, await img.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
          if (!up.error) await admin.from("players").update({ photo_url: admin.storage.from("player-photos").getPublicUrl(path).data.publicUrl }).eq("id", p!.id);
        }
      } catch { /* sin foto */ }
    }
  }
  return { playersNew, playersUpdated, players: list.length };
}

export type SyncSummary = { playersNew: number; players: number; squadError?: string; rivalsNew: number; matchesNew: number; matchesUpdated: number; results: number; competition: string | null; at: string };

/**
 * Trae los partidos de nuestro equipo y los guarda. Los cambios que haga un gestor
 * a mano (observaciones, enlace de mapa, resultado puesto antes que la liga) no se pisan.
 */
export async function syncLeague(opts: { notifyExcept?: string } = {}): Promise<SyncSummary> {
  const admin = createAdminClient();
  const { data: cfg } = await admin.from("league_sync").select("*").eq("id", 1).maybeSingle();
  if (!cfg) throw new Error("Primero configura la liga");
  const sess = await openSession(cfg.competition);
  const league = await fetchLeague(cfg.competition, sess);
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
      pushes.push({ id: old.id, title: gf > ga ? "✅ ¡Victoria!" : gf < ga ? "Resultado final" : "🤝 Empate", body: home ? `${CLUB_NAME} ${gf} - ${ga} ${oppName}` : `${oppName} ${ga} - ${gf} ${CLUB_NAME}` });
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
    const r = await syncSquad(admin, sess.get, cfg.team, season);
    squad = { playersNew: r.playersNew, players: r.players };
  } catch (e) {
    squad.squadError = e instanceof Error ? e.message : String(e);
  }

  const summary: SyncSummary = { ...squad, rivalsNew, matchesNew, matchesUpdated, results, competition: league.competitionName, at: new Date().toISOString() };
  await admin.from("league_sync").update({ last_synced_at: summary.at, last_summary: summary, competition_name: league.competitionName?.slice(0, 160) ?? cfg.competition_name }).eq("id", 1);
  return summary;
}
