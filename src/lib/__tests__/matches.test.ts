import { test } from "node:test";
import assert from "node:assert/strict";
import { byKickoff, form, hhmm, kickoffDate, longDay, mapsLink, matchShareText, monthLabel, outcomeOf, record, relativeDay, rivalColor, rivalShort, shortDay, sides, streak, type Match, type MatchRow } from "../matches.ts";

const rival = { name: "Racing Puente", short_name: null, color: null };
let n = 0;
const played = (gf: number, ga: number, date = `2026-10-${String(++n).padStart(2, "0")}`) =>
  ({ id: date, status: "played", goals_for: gf, goals_against: ga, match_date: date, kickoff: "18:30:00", is_home: true, competition: "league", round: "Jornada 1", venue: null, maps_url: null, rival }) as unknown as MatchRow;

test("el resultado solo cuenta si el partido se ha jugado y tiene marcador", () => {
  assert.equal(outcomeOf({ status: "played", goals_for: 3, goals_against: 1 }), "W");
  assert.equal(outcomeOf({ status: "played", goals_for: 2, goals_against: 2 }), "D");
  assert.equal(outcomeOf({ status: "played", goals_for: 0, goals_against: 1 }), "L");
  assert.equal(outcomeOf({ status: "scheduled", goals_for: 3, goals_against: 1 }), null);
  assert.equal(outcomeOf({ status: "played", goals_for: null, goals_against: null }), null);
});

test("el balance suma victorias, goles, porterías a cero y puntos", () => {
  const r = record([played(3, 1), played(2, 2), played(4, 0), played(1, 2), { status: "scheduled", goals_for: null, goals_against: null }, { status: "cancelled", goals_for: null, goals_against: null }]);
  assert.deepEqual(r, { played: 4, W: 2, D: 1, L: 1, gf: 10, ga: 5, cleanSheets: 1, points: 7 });
});

test("la racha se cuenta desde el último partido hacia atrás", () => {
  assert.equal(streak([played(1, 0, "2026-10-01"), played(2, 0, "2026-10-08"), played(3, 0, "2026-10-15")]), "3 victorias seguidas");
  assert.equal(streak([played(0, 1, "2026-10-01"), played(0, 2, "2026-10-08")]), "2 derrotas seguidas");
  assert.equal(streak([played(1, 1, "2026-10-01"), played(0, 0, "2026-10-08")]), "2 empates seguidos");
  // Perdió, y luego ganó, empató y ganó: tres sin perder
  assert.equal(streak([played(0, 1, "2026-10-01"), played(1, 0, "2026-10-08"), played(1, 1, "2026-10-15"), played(2, 0, "2026-10-22")]), "3 partidos sin perder");
  assert.equal(streak([played(1, 0, "2026-10-01"), played(0, 1, "2026-10-08")]), null);
  assert.equal(streak([played(1, 0, "2026-10-01")]), null);
  // El orden de entrada no importa
  assert.equal(streak([played(3, 0, "2026-10-15"), played(1, 0, "2026-10-01"), played(2, 0, "2026-10-08")]), "3 victorias seguidas");
});

test("los últimos resultados salen del más antiguo al más reciente", () => {
  const rows = [played(1, 0, "2026-10-15"), played(0, 1, "2026-10-01"), played(2, 2, "2026-10-08")];
  assert.deepEqual(form(rows, 2).map((m) => m.match_date), ["2026-10-08", "2026-10-15"]);
});

test("local y visitante se escriben en su orden", () => {
  const home = sides({ is_home: true, goals_for: 3, goals_against: 1 }, rival);
  assert.deepEqual(home.map((s) => [s.name, s.goals]), [["Rayo Vallecañas", 3], ["Racing Puente", 1]]);
  const away = sides({ is_home: false, goals_for: 3, goals_against: 1 }, rival);
  assert.deepEqual(away.map((s) => [s.name, s.goals]), [["Racing Puente", 1], ["Rayo Vallecañas", 3]]);
});

test("las siglas del rival quitan «CD», «Atlético» y los acentos", () => {
  assert.equal(rivalShort({ name: "Helmántica CF", short_name: null }), "HEL");
  assert.equal(rivalShort({ name: "C.D. Amigos", short_name: null }), "AMI");
  assert.equal(rivalShort({ name: "Atlético Garrido", short_name: null }), "GAR");
  assert.equal(rivalShort({ name: "Águilas", short_name: null }), "AGU");
  assert.equal(rivalShort({ name: "Alfaro", short_name: " alf " }), "ALF");
  assert.equal(rivalShort({ name: "1905", short_name: null }), "RIV");
  assert.equal(rivalColor({ name: "X", color: "#123456" }), "#123456");
  assert.equal(rivalColor({ name: "Alfaro", color: null }), rivalColor({ name: "Alfaro", color: null }));
});

test("la hora del partido es hora de Madrid, en invierno y en verano", () => {
  assert.equal(kickoffDate({ match_date: "2026-11-14", kickoff: "18:30:00" }).toISOString(), "2026-11-14T17:30:00.000Z");
  assert.equal(kickoffDate({ match_date: "2026-06-13", kickoff: "18:30:00" }).toISOString(), "2026-06-13T16:30:00.000Z");
  assert.equal(kickoffDate({ match_date: "2026-11-14", kickoff: null }).toISOString(), "2026-11-14T11:00:00.000Z");
  assert.equal(hhmm("18:30:00"), "18:30");
  assert.equal(hhmm(null), null);
});

test("los días se dicen como en el vestuario", () => {
  assert.equal(shortDay("2026-11-14"), "sáb, 14 nov");
  assert.equal(longDay("2026-11-14"), "sábado, 14 de noviembre");
  assert.equal(monthLabel("2026-11-14"), "noviembre de 2026");
  assert.equal(relativeDay("2026-11-14", "2026-11-14"), "Hoy");
  assert.equal(relativeDay("2026-11-15", "2026-11-14"), "Mañana");
  assert.equal(relativeDay("2026-11-13", "2026-11-14"), "Ayer");
  assert.equal(relativeDay("2026-11-18", "2026-11-14"), "En 4 días");
  assert.equal(relativeDay("2026-11-10", "2026-11-14"), "Hace 4 días");
  assert.equal(relativeDay("2026-11-30", "2026-11-14"), null);
  // El cambio de hora de octubre no descuadra la cuenta
  assert.equal(relativeDay("2026-10-27", "2026-10-24"), "En 3 días");
});

test("el calendario ordena por fecha y hora, y sin hora al final del día", () => {
  const m = (match_date: string, kickoff: string | null) => ({ match_date, kickoff }) as Match;
  const out = [m("2026-11-14", null), m("2026-11-14", "18:30:00"), m("2026-11-07", "20:00:00"), m("2026-11-14", "10:00:00")].sort(byKickoff);
  assert.deepEqual(out.map((x) => `${x.match_date} ${x.kickoff}`), ["2026-11-07 20:00:00", "2026-11-14 10:00:00", "2026-11-14 18:30:00", "2026-11-14 null"]);
});

test("el campo lleva a Google Maps: el enlace pegado o una búsqueda", () => {
  assert.equal(mapsLink({ maps_url: "https://maps.app/x", venue: "La Aldehuela" }), "https://maps.app/x");
  assert.equal(mapsLink({ maps_url: null, venue: "La Aldehuela C1" }), "https://www.google.com/maps/search/?api=1&query=La%20Aldehuela%20C1");
  assert.equal(mapsLink({ maps_url: null, venue: null }), null);
});

test("el texto para WhatsApp cambia si el partido ya se ha jugado", () => {
  const done = matchShareText(played(3, 1, "2026-10-10"));
  assert.match(done, /RESULTADO\* ✅/);
  assert.match(done, /Rayo Vallecañas \*3\*\nRacing Puente \*1\*/);
  const next = matchShareText({ ...played(0, 0, "2026-11-14"), status: "scheduled", goals_for: null, goals_against: null, venue: "La Aldehuela C1" } as MatchRow);
  assert.match(next, /PRÓXIMO PARTIDO/);
  assert.match(next, /Rayo Vallecañas vs Racing Puente/);
  assert.match(next, /sábado, 14 de noviembre · 18:30/);
  assert.match(next, /📍 La Aldehuela C1/);
});
