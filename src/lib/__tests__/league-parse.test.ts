/**
 * Pruebas de la lectura de la web de la liga (futormes).
 *
 * Las páginas de fixtures/futormes son páginas reales guardadas el 8-11-2026
 * (Jornada 6 de la Apertura), recortadas y con los nombres de las personas
 * cambiados por «Jugador XX Ejemplo Prueba». Para refrescarlas:
 *   node scripts/futormes-fixtures.mjs
 *
 * Si la liga cambia su web, `npm run test:live` compara la web de verdad con estas
 * mismas comprobaciones, y la revisión semanal (/api/cron/liga) avisa a los gestores.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  competitionFromUrl, decode, inspectCalendar, inspectPlayer, inspectSheet, inspectTable, inspectTeam,
  parseCalendar, parseCompetitionName, parsePlayer, parseSheet, parseTable, prettyTeam, titleCase, zoneLabel,
} from "../league-parse.ts";

const page = (name: string) => readFileSync(new URL(`./fixtures/futormes/${name}.html`, import.meta.url), "utf8");
const RAYO = "176726";

const calendar = page("calendar");
const table = page("table");
const team = page("team");
const player = page("player");
const match = page("match");
const situation = page("situation");

// ---------------------------------------------------------------- Utilidades

describe("utilidades", () => {
  test("decode quita entidades HTML y espacios de más", () => {
    assert.equal(decode("  RAYO&nbsp;VALLECA&Ntilde;AS &amp; Cía  "), "RAYO VALLECAÑAS & Cía");
    assert.equal(decode("4&ordf; Divisi&oacute;n &#183; Grupo"), "4ª División · Grupo");
    assert.equal(decode("&lt;b&gt;"), "<b>");
    assert.equal(decode("&desconocida;"), "&desconocida;");
  });

  test("competitionFromUrl acepta la dirección de futormes o el número suelto", () => {
    assert.equal(competitionFromUrl("https://www.futormes.com/mod/soccer/situation.aspx?itm=15868"), "15868");
    assert.equal(competitionFromUrl(" 15868 "), "15868");
    assert.equal(competitionFromUrl("https://futormes.com/mod/soccer/calendar.aspx?itm=99"), "99");
  });

  test("competitionFromUrl rechaza otras webs y direcciones sin competición", () => {
    assert.equal(competitionFromUrl("https://www.futormes.com.evil.com/situation.aspx?itm=15868"), null);
    assert.equal(competitionFromUrl("https://ejemplo.com/situation.aspx?itm=15868"), null);
    assert.equal(competitionFromUrl("https://www.futormes.com/mod/soccer/situation.aspx"), null);
    assert.equal(competitionFromUrl("https://www.futormes.com/?itm=12a"), null);
    assert.equal(competitionFromUrl("no es una dirección"), null);
  });

  test("prettyTeam y titleCase", () => {
    assert.equal(prettyTeam("RAYO VALLECAÑAS"), "Rayo Vallecañas");
    assert.equal(prettyTeam("ÁVILA SUR CF"), "Ávila Sur CF");
    assert.equal(prettyTeam("PIZA 1904-BAR KFETÍN"), "Piza 1904-Bar Kfetín");
    assert.equal(prettyTeam("PEÑA DE LA ALDEHUELA"), "Peña de la Aldehuela");
    assert.equal(titleCase("JOSÉ LUIS DEL RÍO"), "José Luis del Río");
  });

  test("zoneLabel", () => {
    assert.equal(zoneLabel("ACCESO 4ª DIV. CLAUSURA"), "Acceso 4ª Div. Clausura");
    assert.equal(zoneLabel("DESCENSO A 5ª DIV. CLAUSURA"), "Descenso a 5ª Div. Clausura");
  });
});

// ---------------------------------------------------------------- Portada

test("portada: nombre de la competición", () => {
  assert.equal(parseCompetitionName(situation), "F7 - LIGA 4ª DIVISIÓN APERTURA | GRUPO I");
  assert.equal(parseCompetitionName("<html><body>Nada</body></html>"), null);
});

// ---------------------------------------------------------------- Calendario

describe("calendario", () => {
  const cal = inspectCalendar(calendar);

  test("se leen todos los partidos, sin incidencias", () => {
    assert.deepEqual(cal.issues, []);
    assert.equal(cal.skipped, 0);
    assert.equal(cal.expected, 66);
    assert.equal(cal.items.length, 66);
    // 12 equipos, 11 jornadas de 6 partidos
    assert.equal(new Set(cal.items.map((r) => r.round)).size, 11);
    assert.equal(new Set(cal.items.flatMap((r) => [r.homeId, r.awayId])).size, 12);
    assert.equal(parseCalendar(calendar).length, 66);
  });

  test("primer partido, con todos sus datos", () => {
    assert.deepEqual(cal.items[0], {
      extId: "1371201",
      round: "Jornada 1",
      date: "2026-09-26",
      time: "16:00",
      venue: "La Aldehuela C2",
      address: "Ciudad Deportiva La Aldehuela, Parque de la Aldehuela s/n, Salamanca",
      homeId: "177139",
      homeName: "ALFARO CF",
      awayId: "176719",
      awayName: "CHARROS FC",
      goalsHome: 0,
      goalsAway: 3,
      status: "played",
    });
  });

  test("nuestros partidos: 11, y los jugados con resultado", () => {
    const ours = cal.items.filter((r) => r.homeId === RAYO || r.awayId === RAYO);
    assert.equal(ours.length, 11);
    const home = ours.find((r) => r.extId === "1371211")!;
    assert.equal(home.homeName, "RAYO VALLECAÑAS");
    assert.equal(home.status, "played");
    assert.deepEqual([home.goalsHome, home.goalsAway], [7, 10]);
    assert.equal(home.venue, "Residencia Bravo Fútbol 7");
    assert.equal(ours.filter((r) => r.status === "played").length, 4);
  });

  test("todas las filas tienen un formato válido", () => {
    for (const r of cal.items) {
      assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, `fecha de ${r.extId}`);
      if (r.time) assert.match(r.time, /^\d{2}:\d{2}$/, `hora de ${r.extId}`);
      assert.match(r.extId, /^\d+$/);
      assert.notEqual(r.homeId, r.awayId);
      assert.ok(r.homeName && r.awayName);
      if (r.status === "played") assert.ok(r.goalsHome != null && r.goalsAway != null, `resultado de ${r.extId}`);
      else assert.equal(r.goalsHome, null);
    }
    // Ningún partido repetido
    assert.equal(new Set(cal.items.map((r) => r.extId)).size, cal.items.length);
  });

  test("los jugados van antes que los pendientes", () => {
    const played = cal.items.filter((r) => r.status === "played").map((r) => r.date).sort();
    const pending = cal.items.filter((r) => r.status === "scheduled").map((r) => r.date).sort();
    assert.ok(played.at(-1)! <= pending[0]!);
  });
});

// ---------------------------------------------------------------- Clasificación

describe("clasificación", () => {
  const t = inspectTable(table);

  test("12 equipos, posiciones del 1 al 12, sin incidencias", () => {
    assert.deepEqual(t.issues, []);
    assert.equal(t.items.length, 12);
    assert.deepEqual(t.items.map((r) => r.pos), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal(parseTable(table).length, 12);
  });

  test("las cuentas de cada equipo cuadran", () => {
    for (const r of t.items) {
      assert.equal(r.won + r.drawn + r.lost, r.played, `partidos de ${r.name}`);
      assert.equal(r.gf - r.ga, r.gd, `diferencia de ${r.name}`);
      // La sanción viene en negativo («-3»)
      assert.equal(r.won * 3 + r.drawn + r.penalty, r.points, `puntos de ${r.name}`);
    }
    // Ordenada por puntos
    for (let i = 1; i < t.items.length; i++) assert.ok(t.items[i - 1].points >= t.items[i].points);
  });

  test("equipo sancionado", () => {
    const alfaro = t.items.find((r) => r.name === "Alfaro CF")!;
    assert.deepEqual({ points: alfaro.points, penalty: alfaro.penalty, pos: alfaro.pos }, { points: -3, penalty: -3, pos: 12 });
  });

  test("nuestra fila y las zonas", () => {
    const rayo = t.items.find((r) => r.teamId === RAYO)!;
    assert.equal(rayo.name, "Rayo Vallecañas");
    assert.deepEqual({ pos: rayo.pos, played: rayo.played, points: rayo.points, gf: rayo.gf, ga: rayo.ga }, { pos: 11, played: 4, points: 1, gf: 10, ga: 23 });
    assert.deepEqual(rayo.zone, { label: "Descenso a 5ª Div. Clausura", color: "#E2001A" });
    assert.deepEqual(t.items[0].zone, { label: "Acceso 4ª Div. Clausura", color: "#41A62A" });
  });

  test("los equipos de la clasificación son los del calendario", () => {
    const fromCalendar = new Set(parseCalendar(calendar).flatMap((r) => [r.homeId, r.awayId]));
    assert.deepEqual(new Set(t.items.map((r) => r.teamId)), fromCalendar);
  });
});

// ---------------------------------------------------------------- Plantilla y fichas

describe("plantilla", () => {
  test("ficha del equipo: 19 jugadores con enlace", () => {
    const r = inspectTeam(team);
    assert.deepEqual(r.issues, []);
    assert.equal(r.items.length, 19);
    assert.ok(r.items.every((id) => /^\d+$/.test(id)));
    assert.equal(new Set(r.items).size, 19);
  });

  test("ficha de un jugador", () => {
    const { player: p, issues } = inspectPlayer("2825935", player);
    assert.deepEqual(issues, []);
    assert.deepEqual(p, {
      extId: "2825935", name: "Jugador Oa Ejemplo Prueba", number: 10, nickname: null, line: "DFC", foot: "left",
      birth: "2000-01-01", height: null, apps: 2, goals: 0, conceded: 0, yellows: 0, reds: 0,
    });
    assert.deepEqual(parsePlayer("2825935", player), p);
  });
});

// ---------------------------------------------------------------- Ficha de partido

describe("ficha del partido", () => {
  test("se lee a todos los jugadores de los dos equipos", () => {
    const home = inspectSheet(match, "L");
    const away = inspectSheet(match, "V");
    assert.deepEqual([...home.issues, ...away.issues], []);
    assert.equal(home.items.length, 12);
    assert.equal(away.items.length, 8);
    assert.equal(parseSheet(match, "L").length, 12);
  });

  test("los goles de cada jugador suman el resultado (7-10)", () => {
    // Regresión: a los goleadores la web les pone el número en negrita y antes se perdían sus filas
    const sum = (side: "L" | "V") => parseSheet(match, side).reduce((n, r) => n + r.goals, 0);
    assert.equal(sum("L"), 7);
    assert.equal(sum("V"), 10);
    const scorers = parseSheet(match, "L").filter((r) => r.goals > 0).map((r) => [r.number, r.goals]);
    assert.deepEqual(scorers, [[7, 4], [20, 3]]);
  });

  test("porteros con goles encajados", () => {
    assert.deepEqual(parseSheet(match, "L").filter((r) => r.conceded != null).map((r) => [r.number, r.conceded]), [[1, 6], [99, 4]]);
    assert.deepEqual(parseSheet(match, "V").filter((r) => r.conceded != null).map((r) => [r.number, r.conceded]), [[11, 7]]);
  });

  test("jugador sin dorsal", () => {
    assert.equal(parseSheet(match, "V")[0].number, null);
  });

  test("tarjetas", () => {
    // La ficha guardada no tiene tarjetas: se añaden a mano en dos jugadores
    const withCards = match
      .replace(/(dgrJugadoresL_ctl03_pnlAmonestaciones">)/, '$1<img src="/images/shared/card_yellow.png" />')
      .replace(/(dgrJugadoresL_ctl04_pnlAmonestaciones">)/, '$1<img src="/images/shared/card_yellow_red.png" />');
    const rows = parseSheet(withCards, "L");
    assert.deepEqual([rows[1].yellows, rows[1].red], [1, false]);
    assert.deepEqual([rows[2].yellows, rows[2].red], [2, true]);
    assert.ok(rows.slice(3).every((r) => r.yellows === 0 && !r.red));
  });

  test("ficha todavía sin publicar: vacía y sin incidencias", () => {
    assert.deepEqual(inspectSheet("<html><body>Partido sin acta</body></html>", "L"), { items: [], expected: 0, skipped: 0, issues: [] });
  });
});

// ---------------------------------------------------------------- Si la liga cambia su web

describe("cambios en la web de la liga", () => {
  test("calendario: cambian los nombres de las jornadas", () => {
    const r = inspectCalendar(calendar.replaceAll("_lblJornada", "_lblRonda"));
    assert.equal(r.items.length, 0);
    assert.match(r.issues.join(), /no aparecen las jornadas/);
  });

  test("calendario: cambian los enlaces a los partidos", () => {
    const r = inspectCalendar(calendar.replaceAll('href="match.aspx', 'href="partido.aspx'));
    assert.equal(r.items.length, 0);
    assert.equal(r.skipped, 66);
    assert.match(r.issues.join(), /66 de 66 partidos no se han podido leer/);
  });

  test("calendario: cambia el formato de la fecha", () => {
    const r = inspectCalendar(calendar.replace(/(_lblFecha">)(\d{2})\.(\d{2})\.(\d{4})/, "$1$4/$3/$2"));
    assert.equal(r.items.length, 65);
    assert.match(r.issues.join(), /1 de 66 partidos/);
  });

  test("calendario: desaparecen las fechas", () => {
    const r = inspectCalendar(calendar.replaceAll("_lblFecha", "_lblDia"));
    assert.equal(r.items.length, 0);
    assert.match(r.issues.join(), /ninguna fecha/);
  });

  test("calendario: cambian los enlaces a los equipos", () => {
    const r = inspectCalendar(calendar.replaceAll('href="team.aspx', 'href="equipo.aspx'));
    assert.equal(r.items.length, 0);
    assert.ok(r.issues.length > 0);
  });

  test("clasificación: cambia la tabla", () => {
    assert.match(inspectTable(table.replaceAll("dgrClasificacion", "gridTabla")).issues.join(), /no aparece la tabla/);
  });

  test("clasificación: cambian los enlaces a los equipos", () => {
    const r = inspectTable(table.replaceAll("_hlkEquipo", "_lnkEquipo"));
    assert.equal(r.items.length, 0);
    assert.match(r.issues.join(), /12 de 12 equipos/);
  });

  test("clasificación: desaparecen los puntos", () => {
    const r = inspectTable(table.replaceAll("_lblPuntos\"", "_lblPts\""));
    assert.match(r.issues.join(), /sin posición, partidos o puntos/);
  });

  test("plantilla: cambian los enlaces a las fichas", () => {
    assert.match(inspectTeam(team.replaceAll("dgrJugadores_", "gridJugadores_")).issues.join(), /no muestra jugadores/);
    const r = inspectTeam(team.replaceAll('href="player.aspx', 'href="jugador.aspx'));
    assert.equal(r.items.length, 0);
    assert.ok(r.issues.length > 0);
  });

  test("ficha de jugador: cambia el nombre o desaparecen las estadísticas", () => {
    assert.match(inspectPlayer("1", player.replaceAll("lblJugadorInfoNombre", "lblNombre")).issues.join(), /no aparece el nombre/);
    assert.match(inspectPlayer("1", player.replaceAll("lblEstadisticas", "lblStats")).issues.join(), /estadísticas de la liga/);
  });

  test("ficha de partido: cambian los goles", () => {
    const r = inspectSheet(match.replaceAll("_lblGoles\"", "_lblTantos\""), "L");
    assert.equal(r.items.length, 0);
    assert.match(r.issues.join(), /12 de 12 jugadores del equipo local/);
  });

  test("página de error o vacía", () => {
    const html = "<html><body><h1>Servicio no disponible</h1></body></html>";
    assert.ok(inspectCalendar(html).issues.length > 0);
    assert.ok(inspectTable(html).issues.length > 0);
    assert.ok(inspectTeam(html).issues.length > 0);
    assert.equal(parsePlayer("1", html), null);
  });
});
