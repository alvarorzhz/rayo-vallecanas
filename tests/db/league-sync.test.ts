/**
 * Sincronización con futormes de principio a fin, contra la base de datos de verdad y con la web
 * de la liga simulada a partir de las páginas guardadas en src/lib/__tests__/fixtures/futormes.
 * No sale nada a internet: las peticiones a futormes se contestan aquí mismo.
 *
 * Comprueba lo que de verdad importa: que se guardan los partidos y resultados, que una segunda
 * pasada no duplica nada, que no se pisan los cambios hechos a mano, que el freno de seguridad
 * para la sincronización si la web enseña menos partidos, y la lista de jugadores nuevos.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { admin, as, ok } from "./helpers.ts";
import { inspectCalendar, inspectTeam, type LeagueRow } from "../../src/lib/league-parse.ts";
import { seasonOf } from "../../src/lib/finance.ts";
import type { Newcomer } from "../../src/lib/newcomers.ts";

const COMPETITION = "15868";
const TEAM = "176726";
const page = (name: string) => readFileSync(new URL(`../../src/lib/__tests__/fixtures/futormes/${name}.html`, import.meta.url), "utf8");

// ---------------------------------------------------------------- La web de la liga, simulada
const pages = { situation: page("situation"), calendar: page("calendar"), table: page("table"), team: page("team"), player: page("player") };
const rosterIds = inspectTeam(pages.team).items;
const ours: LeagueRow[] = inspectCalendar(pages.calendar).items.filter((r) => r.homeId === TEAM || r.awayId === TEAM);
const SEASON = seasonOf(new Date(`${ours[0].date}T12:00:00Z`));

/** Quién es cada jugador de la plantilla en la liga: los dos primeros ya están en la app (Dani y Javi). */
type Fake = { name: string; number: number; apps: number; goals: number };
const roster = new Map<string, Fake>(rosterIds.map((id, i) => [id, { name: `Nuevo Fichaje ${String.fromCharCode(65 + i)}`, number: 30 + i, apps: 1, goals: 0 }]));
roster.set(rosterIds[0], { name: "Dani García", number: 10, apps: 4, goals: 6 });
roster.set(rosterIds[1], { name: "Javi Martín", number: 7, apps: 3, goals: 2 });

const setLabel = (html: string, id: string, value: string | number) =>
  html.replace(new RegExp(`(id="ctl00_ContentPlaceHolder1_${id}"[^>]*>)[^<]*`), `$1${value}`);
function playerPage(id: string) {
  const p = roster.get(id);
  if (!p) return null;
  let h = setLabel(pages.player, "lblJugadorInfoNombre", p.name.toUpperCase());
  h = setLabel(h, "lblDorsal", p.number);
  h = setLabel(h, "lblEstadisticasPartidosJugados", p.apps);
  h = setLabel(h, "lblEstadisticasGolesMarcados", p.goals);
  return h;
}

let calendar = pages.calendar;
const realFetch = globalThis.fetch;
const asked: string[] = [];
before(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "www.futormes.com") return realFetch(input, init);
    asked.push(url.pathname + url.search);
    const name = url.pathname.split("/").pop()!;
    const itm = url.searchParams.get("itm");
    const html =
      name === "situation.aspx" ? pages.situation :
      name === "calendar.aspx" ? calendar :
      name === "table.aspx" ? pages.table :
      name === "team.aspx" && itm === TEAM ? pages.team :
      name === "player.aspx" && itm ? playerPage(itm) : null;
    // Escudos y cualquier otra cosa: no existen (la app pinta el escudo genérico)
    if (!html) return new Response("Not found", { status: 404 });
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }) as typeof fetch;
});
after(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- Preparación de la base de datos
/** Partidos de esta competición y fichajes que crea la prueba (se borran antes y después). */
async function cleanLeagueData() {
  const ids = (ok(await admin.from("matches").select("id").eq("league_competition", COMPETITION)) as { id: string }[]).map((m) => m.id);
  if (ids.length) ok(await admin.from("matches").delete().in("id", ids));
  const old = (ok(await admin.from("players").select("id").eq("first_name", "Nuevo").like("last_name", "Fichaje %")) as { id: string }[]).map((p) => p.id);
  if (old.length) {
    ok(await admin.from("squad_members").delete().in("player_id", old));
    ok(await admin.from("players").delete().in("id", old));
  }
}
// Al acabar se deja la base de datos como estaba: en la CI la prueba de humo va después y usa los mismos datos.
// Los partidos de esta prueba tienen fechas fijas; el día que una coincidía con el próximo partido de los datos
// de ejemplo (p. ej. el 22-11-2026), pasaba a ser «el próximo partido», sin convocatoria, y el «Voy» de Inicio no salía.
after(cleanLeagueData);
before(async () => {
  // La liga configurada como en producción
  ok(await admin.from("league_sync").upsert({ id: 1, competition: COMPETITION, team: TEAM, last_summary: null, last_synced_at: null }));
  // Empezar de cero con esta competición y sin fichajes de una ejecución anterior (por si se repite en local)
  await cleanLeagueData();
  // Dani y Javi en la plantilla de la temporada de esa liga (los datos de ejemplo usan la temporada actual)
  const players = ok(await admin.from("players").select("id, first_name").in("first_name", ["Dani", "Javi"])) as { id: string; first_name: string }[];
  for (const p of players) {
    ok(await admin.from("players").update({ ext_id: null }).eq("id", p.id));
    ok(await admin.from("squad_members").upsert({ player_id: p.id, season: SEASON, number: p.first_name === "Dani" ? 10 : 7, position: "MCO", league_stats: null, league_stats_by: null }, { onConflict: "player_id,season" }));
  }
});

const { syncLeague, checkNewcomers } = await import("../../src/lib/league-sync.ts");

type Summary = Awaited<ReturnType<typeof syncLeague>>;
const ourMatches = async () =>
  ok(await admin.from("matches").select("id, ext_id, match_date, kickoff, status, goals_for, goals_against, notes, is_home, rival_id").eq("league_competition", COMPETITION).order("match_date")) as
    { id: string; ext_id: string; match_date: string; kickoff: string | null; status: string; goals_for: number | null; goals_against: number | null; notes: string | null; is_home: boolean; rival_id: string }[];
const stored = async () => (ok(await admin.from("league_sync").select("last_summary, competition_name, team_name").eq("id", 1).single()) as { last_summary: Record<string, unknown>; competition_name: string | null; team_name: string | null });

describe("sincronización con la liga", () => {
  let first: Summary;

  test("la primera vez trae los partidos del Rayo con sus resultados y los rivales", async () => {
    first = await syncLeague();
    assert.deepEqual(first.issues, []);
    assert.equal(first.status, "ok");
    assert.equal(first.matches, ours.length);
    assert.equal(first.matchesNew, ours.length);
    assert.equal(first.played, ours.filter((r) => r.status === "played").length);
    const rows = await ourMatches();
    assert.equal(rows.length, ours.length);
    // Rayo 7-10 Birrarreal, en casa
    const m = rows.find((r) => r.ext_id === "futormes:1371211")!;
    assert.deepEqual([m.status, m.is_home, m.goals_for, m.goals_against, m.match_date], ["played", true, 7, 10, "2026-10-03"]);
    // BZ FC 1-1 Rayo, fuera
    const bz = rows.find((r) => r.ext_id === "futormes:1371205")!;
    assert.deepEqual([bz.is_home, bz.goals_for, bz.goals_against], [false, 1, 1]);
    // Cada rival, una vez
    const rivals = ok(await admin.from("rivals").select("id, ext_id").like("ext_id", "futormes:%")) as { id: string; ext_id: string }[];
    assert.equal(new Set(rivals.map((r) => r.ext_id)).size, rivals.length);
    assert.ok(!rivals.some((r) => r.ext_id === `futormes:${TEAM}`), "el Rayo no se apunta como rival");
    const s = await stored();
    assert.ok(s.competition_name);
    assert.match(s.team_name ?? "", /RAYO/i);
    const hist = ok(await admin.from("league_competitions").select("season, finished").eq("competition", COMPETITION).single()) as { season: string; finished: boolean };
    assert.equal(hist.season, SEASON);
  });

  test("los jugadores reconocidos reciben su enlace con la liga y sus estadísticas", async () => {
    const dani = ok(await admin.from("players").select("id, ext_id").eq("first_name", "Dani").single()) as { id: string; ext_id: string };
    assert.equal(dani.ext_id, `futormes:${rosterIds[0]}`);
    const sm = ok(await admin.from("squad_members").select("league_stats, league_stats_by").eq("player_id", dani.id).eq("season", SEASON).single()) as { league_stats: Record<string, number>; league_stats_by: Record<string, Record<string, number>> };
    assert.equal(sm.league_stats.apps, 4);
    assert.equal(sm.league_stats.goals, 6);
    assert.equal(sm.league_stats_by[COMPETITION].goals, 6);
  });

  test("los que no están en la plantilla salen como «Nuevos en la liga», sin darlos de alta solos", async () => {
    const list = (await stored()).last_summary.newcomers as Newcomer[];
    assert.equal(first.newcomers, rosterIds.length - 2);
    assert.equal(list.length, rosterIds.length - 2);
    assert.ok(list.every((n) => n.name.startsWith("Nuevo Fichaje")));
    const added = ok(await admin.from("players").select("id").like("first_name", "Nuevo%")) as unknown[];
    assert.equal(added.length, 0);
  });

  test("una segunda pasada no duplica nada ni vuelve a avisar de los mismos", async () => {
    const before = (await stored()).last_summary.newcomers as Newcomer[];
    const again = await syncLeague();
    assert.deepEqual([again.matchesNew, again.matchesUpdated, again.rivalsNew, again.results], [0, 0, 0, 0]);
    assert.equal((await ourMatches()).length, ours.length);
    const list = (await stored()).last_summary.newcomers as Newcomer[];
    // Misma lista y misma fecha de aparición: no son «nuevos» otra vez
    assert.deepEqual(list.map((n) => [n.extId, n.seenAt]), before.map((n) => [n.extId, n.seenAt]));
  });

  test("un resultado nuevo o un cambio de hora se actualizan; las notas puestas a mano se respetan", async () => {
    const next = ours.find((r) => r.status !== "played")!;
    const row = (await ourMatches()).find((r) => r.ext_id === `futormes:${next.extId}`)!;
    ok(await admin.from("matches").update({ notes: "Llevar petos" }).eq("id", row.id));
    // La liga publica el resultado de ese partido (el Rayo gana 3-0)
    const home = next.homeId === TEAM;
    const old = calendar;
    calendar = withResult(calendar, next.extId, home ? 3 : 0, home ? 0 : 3);
    try {
      const s = await syncLeague();
      assert.equal(s.results, 1);
      assert.equal(s.matchesUpdated, 1);
      const upd = (await ourMatches()).find((r) => r.id === row.id)!;
      assert.deepEqual([upd.status, upd.goals_for, upd.goals_against, upd.notes], ["played", 3, 0, "Llevar petos"]);
    } finally {
      calendar = old;
    }
  });

  test("un cambio de hora en la liga se guarda", async () => {
    const next = ours.filter((r) => r.status !== "played").at(-1)!;
    const old = calendar;
    calendar = withTime(calendar, next.extId, "21:15");
    try {
      const s = await syncLeague();
      assert.equal(s.matchesUpdated, 1);
      const upd = (await ourMatches()).find((r) => r.ext_id === `futormes:${next.extId}`)!;
      assert.equal(upd.kickoff?.slice(0, 5), "21:15");
    } finally {
      calendar = old;
    }
  });

  test("si la web enseña muchos menos partidos de los guardados, no toca nada y avisa", async () => {
    const before = await ourMatches();
    const old = calendar;
    calendar = keepOnly(calendar, ours.slice(0, 2).map((r) => r.extId));
    try {
      await assert.rejects(syncLeague(), /partidos/);
      assert.deepEqual(await ourMatches(), before);
      const s = (await stored()).last_summary;
      assert.equal(s.status, "failed");
      assert.match(String((s.issues as string[])[0]), /partidos/);
      assert.ok(s.alert, "no ha quedado apuntado el aviso a los gestores");
      // La lista de jugadores nuevos no se pierde por un fallo
      assert.ok((s.newcomers as Newcomer[]).length > 0);
    } finally {
      calendar = old;
    }
  });

  test("la comprobación diaria saca de la lista a quien ya se ha fichado y no vuelve a meter a los descartados", async () => {
    const list = (await stored()).last_summary.newcomers as Newcomer[];
    const [signed, ignored] = list;
    // Un gestor ficha al primero (como desde «Nuevos en la liga») y descarta al segundo
    const gestor = await as("gestor");
    const p = ok(await gestor.db.from("players").insert({ first_name: "Nuevo", last_name: `Fichaje ${signed.name.split(" ").pop()}` }).select("id").single()) as { id: string };
    ok(await admin.from("squad_members").insert({ player_id: p.id, season: seasonOf(), number: 99, position: "DFC" }));
    const s = (await stored()).last_summary;
    ok(await admin.from("league_sync").update({ last_summary: { ...s, ignoredPlayers: [{ ext: ignored.extId, name: ignored.name }] } }).eq("id", 1));

    const r = await checkNewcomers();
    assert.equal(r.status, "ok");
    assert.equal(r.fresh, 0);
    const now = (await stored()).last_summary.newcomers as Newcomer[];
    assert.ok(!now.some((n) => n.extId === signed.extId), "el fichado sigue en la lista");
    assert.ok(!now.some((n) => n.extId === ignored.extId), "el descartado ha vuelto a la lista");
    assert.equal(now.length, list.length - 2);
    // Solo baja las fichas de quien no conoce: a Dani y Javi ya los reconoce por su enlace
    assert.ok(!asked.slice(-rosterIds.length).includes(`/mod/soccer/player.aspx?itm=${rosterIds[0]}`));
  });

  test("un jugador que aparece de repente en la plantilla de la liga es «nuevo» y se avisa", async () => {
    const id = "999999";
    roster.set(id, { name: "Recién Llegado", number: 77, apps: 0, goals: 0 });
    const old = pages.team;
    pages.team += `<a id="ctl00_ContentPlaceHolder1_dgrJugadores_ctl98_hlkJugador" href="player.aspx?itm=${id}">RECIÉN LLEGADO</a>`;
    try {
      const r = await checkNewcomers();
      assert.equal(r.fresh, 1);
      const now = (await stored()).last_summary.newcomers as Newcomer[];
      assert.ok(now.some((n) => n.extId === id && n.name === "Recién Llegado"));
    } finally {
      pages.team = old;
    }
  });
});

// ---------------------------------------------------------------- Retoques del calendario simulado

/** Cambia la fila de un partido del calendario (como hace la web cuando se juega o se cambia la hora). */
function editRow(html: string, extId: string, edit: (row: string) => string) {
  const at = html.indexOf(`match.aspx?itm=${extId}`);
  assert.ok(at > 0, `no está el partido ${extId} en el calendario`);
  const start = html.lastIndexOf("<tr", at);
  const end = html.indexOf("</tr>", at) + 5;
  return html.slice(0, start) + edit(html.slice(start, end)) + html.slice(end);
}

/** Pone resultado a un partido del calendario. */
function withResult(html: string, extId: string, home: number, away: number) {
  const out = editRow(html, extId, (row) => row
    .replace(/(_lblMarcador">)[^<]*/, `$1${home} - ${away}`)
    .replace(/(_imgFinalizado" title=")[^"]*/, "$1Partido finalizado"));
  assert.equal(inspectCalendar(out).items.find((r) => r.extId === extId)?.status, "played", "el calendario simulado no ha quedado con el resultado");
  return out;
}

/** Cambia la hora de un partido del calendario. */
const withTime = (html: string, extId: string, time: string) => editRow(html, extId, (row) => row.replace(/(_lblHora">)[^<]*/, `$1${time}`));

/** Deja en el calendario solo algunos partidos del Rayo (como si la web fallara a medias). */
function keepOnly(html: string, extIds: string[]) {
  let out = html;
  for (const r of ours) {
    if (extIds.includes(r.extId)) continue;
    const at = out.indexOf(`match.aspx?itm=${r.extId}`);
    if (at < 0) continue;
    const start = out.lastIndexOf("<tr", at);
    const end = out.indexOf("</tr>", at) + 5;
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}
