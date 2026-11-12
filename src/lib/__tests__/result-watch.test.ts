import { test } from "node:test";
import assert from "node:assert/strict";
import { awaitingResult, madridNow, resultNotice, type WatchMatch } from "../result-watch.ts";

const m = (o: Partial<WatchMatch>): WatchMatch => ({
  id: "a", match_date: "2026-11-08", kickoff: "18:00:00", status: "scheduled", competition: "league", ext_id: "futormes:1", ...o,
});

test("la hora de Madrid sale bien en invierno y en verano", () => {
  assert.equal(madridNow(new Date("2026-11-08T19:05:00Z")), "2026-11-08 20:05");
  assert.equal(madridNow(new Date("2027-06-12T21:45:00Z")), "2027-06-12 23:45");
  assert.equal(madridNow(new Date("2026-11-08T23:30:00Z")), "2026-11-09 00:30");
});

test("se empieza a mirar hora y media después del pitido", () => {
  assert.equal(awaitingResult([m({})], "2026-11-08 19:00").length, 0);
  assert.equal(awaitingResult([m({})], "2026-11-08 19:30").length, 1);
  assert.equal(awaitingResult([m({ kickoff: "23:00:00" })], "2026-11-08 23:59").length, 0);
});

test("sin hora, se mira por la tarde; el de ayer, siempre", () => {
  assert.equal(awaitingResult([m({ kickoff: null })], "2026-11-08 10:00").length, 0);
  assert.equal(awaitingResult([m({ kickoff: null })], "2026-11-08 14:00").length, 1);
  assert.equal(awaitingResult([m({ match_date: "2026-11-07", kickoff: "20:00:00" })], "2026-11-08 09:00").length, 1);
  assert.equal(awaitingResult([m({ match_date: "2026-11-30", kickoff: "20:00:00" })], "2026-12-01 09:00").length, 1);
});

test("no se mira si ya hay resultado, si es otro día o si no viene de la liga", () => {
  const now = "2026-11-08 21:00";
  assert.equal(awaitingResult([m({ status: "played" })], now).length, 0);
  assert.equal(awaitingResult([m({ status: "postponed" })], now).length, 0);
  assert.equal(awaitingResult([m({ match_date: "2026-11-06" })], now).length, 0);
  assert.equal(awaitingResult([m({ match_date: "2026-11-09" })], now).length, 0);
  assert.equal(awaitingResult([m({ competition: "friendly" })], now).length, 0);
  assert.equal(awaitingResult([m({ ext_id: null })], now).length, 0);
});

test("el aviso pone el marcador en el orden de casa y fuera", () => {
  const home = resultNotice({ gf: 3, ga: 1, home: true, club: "Rayo", rival: "Peñaranda" });
  assert.equal(home.title, "✅ ¡Victoria! 3-1 ante Peñaranda");
  assert.match(home.body, /^Rayo 3 - 1 Peñaranda/);
  const away = resultNotice({ gf: 0, ga: 2, home: false, club: "Rayo", rival: "Peñaranda" });
  assert.equal(away.title, "⚽ Final: 0-2 ante Peñaranda");
  assert.match(away.body, /Ya están los datos del partido\.$/);
  assert.match(away.body, /^Peñaranda 2 - 0 Rayo/);
  assert.match(resultNotice({ gf: 1, ga: 1, home: true, club: "R", rival: "P" }).title, /Empate/);
});
