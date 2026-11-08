import { test } from "node:test";
import assert from "node:assert/strict";
import { mvpClosesAt, mvpStage, ranking, untilLabel, type MvpBoard } from "../mvp.ts";

test("la votación del MVP se cierra a las 23:59 de Madrid del mismo día", () => {
  // Invierno (UTC+1): 19:00 UTC = 20:00 en Madrid
  assert.equal(mvpClosesAt(new Date("2026-11-08T19:00:00Z")).toISOString(), "2026-11-08T22:59:59.000Z");
  // Verano (UTC+2)
  assert.equal(mvpClosesAt(new Date("2027-05-02T10:00:00Z")).toISOString(), "2027-05-02T21:59:59.000Z");
  // Pasada la medianoche de Madrid (23:30 UTC = 00:30 del día 9): hasta las 23:59 del día 9
  assert.equal(mvpClosesAt(new Date("2026-11-08T23:30:00Z")).toISOString(), "2026-11-09T22:59:59.000Z");
});

test("si quedan menos de 2 horas, dura hasta el día siguiente", () => {
  // 22:30 en Madrid
  const late = new Date("2026-11-08T21:30:00Z");
  assert.equal(mvpClosesAt(late).toISOString(), "2026-11-09T22:59:59.000Z");
  assert.equal(untilLabel(mvpClosesAt(late), late), "hasta mañana a las 23:59");
  const early = new Date("2026-11-08T18:00:00Z");
  assert.equal(untilLabel(mvpClosesAt(early), early), "hasta las 23:59");
});

const board = (o: Partial<MvpBoard>): MvpBoard => ({
  match_id: "m", closes_at: "2026-11-08T22:59:59Z", open: false, counted: true, winner_id: null, tie_ids: null, picked: false,
  voters: 0, eligible: 10, my_vote: null, my_player_id: null, tally: null, candidates: ["a", "b", "c"], ...o,
});

test("clasificación y estado de la votación", () => {
  assert.deepEqual(ranking(board({ tally: { b: 3, a: 1 } })), [{ id: "b", votes: 3 }, { id: "a", votes: 1 }]);
  assert.deepEqual(ranking(board({ open: true, counted: false })), []);
  assert.equal(mvpStage(board({ open: true, counted: false })), "open");
  assert.equal(mvpStage(board({ counted: false })), "counting");
  assert.equal(mvpStage(board({ winner_id: "a" })), "winner");
  assert.equal(mvpStage(board({ tie_ids: ["a", "b"] })), "tie");
  assert.equal(mvpStage(board({})), "empty");
});
