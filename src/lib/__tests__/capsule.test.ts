import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capsuleStage, closest, computeReality, defaultDates, judge, madridEndOfDay, parseAnswer, seerTable, untilLabel, QUESTION,
  type CapsulePrediction,
} from "../capsule.ts";

const now = new Date("2026-11-19T12:00:00Z");

test("momento de la cápsula: se escribe, cerrada o abierta", () => {
  assert.equal(capsuleStage({ write_until: "2026-11-20T22:59:00Z" }, "2027-06-01T00:00:00Z", now), "writing");
  assert.equal(capsuleStage({ write_until: "2026-11-18T22:59:00Z" }, "2027-06-01T00:00:00Z", now), "sealed");
  assert.equal(capsuleStage({ write_until: "2026-11-18T22:59:00Z" }, "2026-11-19T11:00:00Z", now), "open");
  // Sin momento de apertura (sin cápsula) nunca está abierta
  assert.equal(capsuleStage({ write_until: "2026-11-18T22:59:00Z" }, null, now), "sealed");
});

test("fechas propuestas: hasta el primer partido y la gala no antes del 31 de mayo", () => {
  assert.deepEqual(defaultDates("2027/28", "2027-09-20", "2027-12-14", "2026-11-19"), { writeUntil: "2027-09-20", opensOn: "2028-05-31" });
  assert.deepEqual(defaultDates("2027/28", "2027-09-20", "2028-06-10", "2026-11-19"), { writeUntil: "2027-09-20", opensOn: "2028-06-10" });
  // Sin calendario: 15 de octubre
  assert.deepEqual(defaultDates("2027/28", null, null, "2026-11-19"), { writeUntil: "2027-10-15", opensOn: "2028-05-31" });
  // Temporada ya empezada: dos semanas desde hoy
  assert.deepEqual(defaultDates("2026/27", "2026-10-19", "2026-12-14", "2026-11-19"), { writeUntil: "2026-12-03", opensOn: "2027-05-31" });
});

test("último minuto del día en Madrid, en invierno y en verano", () => {
  assert.equal(madridEndOfDay("2026-12-01"), "2026-12-01T23:59:00+01:00");
  assert.equal(madridEndOfDay("2027-06-01"), "2027-06-01T23:59:00+02:00");
  assert.equal(new Date(madridEndOfDay("2026-12-01")).toISOString(), "2026-12-01T22:59:00.000Z");
});

test("cuenta atrás", () => {
  assert.equal(untilLabel("2026-11-25T12:00:00Z", now), "faltan 6 días");
  assert.equal(untilLabel("2026-11-19T17:00:00Z", now), "faltan 5 horas");
  assert.equal(untilLabel("2026-11-19T12:01:00Z", now), "falta 1 minuto");
  assert.equal(untilLabel("2026-11-19T11:00:00Z", now), "ya");
});

const data = {
  matches: [
    { id: "m1", goals_for: 3, goals_against: 1, mvp_player_id: "ana" },
    { id: "m2", goals_for: 1, goals_against: 1, mvp_player_id: "bea" },
    { id: "m3", goals_for: 2, goals_against: 0, mvp_player_id: "ana" },
    { id: "m4", goals_for: null, goals_against: null, mvp_player_id: null }, // sin jugar
  ],
  goals: [
    { match_id: "m1", scorer_id: "ana", assist_id: "bea" }, { match_id: "m1", scorer_id: "ana", assist_id: null }, { match_id: "m1", scorer_id: "cris", assist_id: "bea" },
    { match_id: "m2", scorer_id: "cris", assist_id: "ana" },
    { match_id: "m3", scorer_id: "cris", assist_id: null }, { match_id: "m3", scorer_id: null, assist_id: null }, // propia puerta
    { match_id: "m4", scorer_id: "bea", assist_id: null },
  ],
  apps: [
    { match_id: "m1", player_id: "ana", yellows: 1, red: false }, { match_id: "m1", player_id: "bea", yellows: 0, red: false }, { match_id: "m1", player_id: "cris", yellows: 0, red: false },
    { match_id: "m2", player_id: "ana", yellows: 0, red: false }, { match_id: "m2", player_id: "bea", yellows: 1, red: true },
    { match_id: "m3", player_id: "ana", yellows: 0, red: false }, { match_id: "m3", player_id: "cris", yellows: 0, red: false },
  ],
};

test("la realidad de la temporada sale de las actas (con empates)", () => {
  const r = computeReality(data, 4);
  assert.deepEqual(r.top_scorer, { players: ["cris"], value: 3 });
  assert.deepEqual(r.top_assists, { players: ["bea"], value: 2 });
  assert.deepEqual(r.top_mvp, { players: ["ana"], value: 2 });
  assert.deepEqual(r.top_apps, { players: ["ana"], value: 3 });
  assert.deepEqual(r.top_cards, { players: ["bea"], value: 2 });
  assert.deepEqual(r.position, { number: 4 });
  assert.deepEqual(r.goals_for, { number: 6 });
  assert.deepEqual(r.wins, { number: 2 });
  // Sin partidos ni puesto: no hay nada que comparar
  const empty = computeReality({ matches: [], goals: [], apps: [] }, null);
  assert.equal(empty.top_scorer, null);
  assert.equal(empty.goals_for, null);
  assert.equal(empty.position, null);
  // Empate a goles: valen los dos
  const tie = computeReality({ ...data, goals: [{ match_id: "m1", scorer_id: "ana", assist_id: null }, { match_id: "m2", scorer_id: "cris", assist_id: null }] }, null);
  assert.deepEqual(tie.top_scorer, { players: ["ana", "cris"], value: 1 });
});

test("puntos: 3 por acertar, 1 por quedarse cerca en los números", () => {
  const r = computeReality(data, 4);
  assert.deepEqual(judge({ question: "top_scorer", player_id: "cris", number: null }, r.top_scorer), { points: 3, hit: "exact" });
  assert.deepEqual(judge({ question: "top_scorer", player_id: "ana", number: null }, r.top_scorer), { points: 0, hit: "miss" });
  assert.deepEqual(judge({ question: "position", player_id: null, number: 4 }, r.position), { points: 3, hit: "exact" });
  assert.deepEqual(judge({ question: "position", player_id: null, number: 5 }, r.position), { points: 1, hit: "close" });
  assert.deepEqual(judge({ question: "position", player_id: null, number: 6 }, r.position), { points: 0, hit: "miss" });
  assert.deepEqual(judge({ question: "goals_for", player_id: null, number: 11 }, r.goals_for), { points: 1, hit: "close" });
  assert.deepEqual(judge({ question: "goals_for", player_id: null, number: 12 }, r.goals_for), { points: 0, hit: "miss" });
  assert.equal(judge({ question: "position", player_id: null, number: 4 }, null), null);
});

test("el pitoniso: más puntos, y a igualdad, más aciertos", () => {
  const r = computeReality(data, 4);
  const p = (user_id: string, question: CapsulePrediction["question"], v: string | number): CapsulePrediction =>
    ({ user_id, question, player_id: typeof v === "string" ? v : null, number: typeof v === "number" ? v : null });
  const preds = [
    p("u1", "top_scorer", "cris"), p("u1", "position", 9),                 // 3
    p("u2", "position", 5), p("u2", "wins", 3), p("u2", "goals_for", 7),   // 1+1+1 = 3, sin aciertos exactos
    p("u3", "top_mvp", "bea"),                                              // 0
  ];
  const t = seerTable(preds, r);
  assert.deepEqual(t.map((x) => [x.user_id, x.points, x.hits, x.pos]), [["u1", 3, 1, 1], ["u2", 3, 0, 2], ["u3", 0, 0, 3]]);
  assert.deepEqual(closest(preds, "position", r.position), ["u2"]);
  assert.deepEqual(closest(preds, "top_scorer", r.top_scorer), []);
});

test("respuestas de número válidas para cada pregunta", () => {
  assert.equal(parseAnswer(QUESTION.position, "3"), 3);
  assert.equal(parseAnswer(QUESTION.position, "0"), null);
  assert.equal(parseAnswer(QUESTION.position, "31"), null);
  assert.equal(parseAnswer(QUESTION.goals_for, "120"), 120);
  assert.equal(parseAnswer(QUESTION.wins, "-1"), null);
  assert.equal(parseAnswer(QUESTION.wins, "2,5"), null);
});
