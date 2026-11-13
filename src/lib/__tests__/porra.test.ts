import { test } from "node:test";
import assert from "node:assert/strict";
import { porraClosesAt, porraOpen, porraPoints, porraTable } from "../porra.ts";

const played = (gf: number, ga: number) => ({ status: "played", goals_for: gf, goals_against: ga });

test("3 por clavarlo, 1 por el signo, 0 si no", () => {
  assert.equal(porraPoints({ goals_for: 2, goals_against: 1 }, played(2, 1)), 3);
  assert.equal(porraPoints({ goals_for: 3, goals_against: 0 }, played(2, 1)), 1);
  assert.equal(porraPoints({ goals_for: 1, goals_against: 1 }, played(2, 2)), 1);
  assert.equal(porraPoints({ goals_for: 0, goals_against: 1 }, played(2, 1)), 0);
  assert.equal(porraPoints({ goals_for: 2, goals_against: 1 }, { status: "scheduled", goals_for: null, goals_against: null }), null);
});

test("clasificación: puntos, luego clavados, luego menos partidos; empates comparten puesto", () => {
  const matches = [{ id: "a", ...played(2, 1) }, { id: "b", ...played(0, 0) }, { id: "c", status: "scheduled", goals_for: null, goals_against: null }];
  const t = porraTable([
    { match_id: "a", user_id: "ana", goals_for: 2, goals_against: 1 }, // 3
    { match_id: "b", user_id: "ana", goals_for: 1, goals_against: 0 }, // 0
    { match_id: "a", user_id: "bea", goals_for: 3, goals_against: 0 }, // 1
    { match_id: "b", user_id: "bea", goals_for: 1, goals_against: 1 }, // 1
    { match_id: "a", user_id: "carlos", goals_for: 1, goals_against: 0 }, // 1
    { match_id: "b", user_id: "carlos", goals_for: 2, goals_against: 2 }, // 1
    { match_id: "c", user_id: "dani", goals_for: 1, goals_against: 0 }, // sin jugar: no cuenta
  ], matches);
  assert.deepEqual(t.map((r) => [r.user_id, r.points, r.pos]), [["ana", 3, 1], ["bea", 2, 2], ["carlos", 2, 2]]);
  assert.equal(t[0].exact, 1);
});

test("se cierra al pitido, en hora de Madrid (invierno y verano)", () => {
  assert.equal(porraClosesAt({ match_date: "2026-11-15", kickoff: "18:00:00" }).toISOString(), "2026-11-15T17:00:00.000Z");
  assert.equal(porraClosesAt({ match_date: "2027-05-09", kickoff: "10:30" }).toISOString(), "2027-05-09T08:30:00.000Z");
  assert.equal(porraClosesAt({ match_date: "2026-11-15", kickoff: null }).toISOString(), "2026-11-14T23:00:00.000Z");
  const m = { status: "scheduled", match_date: "2026-11-15", kickoff: "18:00" };
  assert.equal(porraOpen(m, new Date("2026-11-15T16:59:00Z")), true);
  assert.equal(porraOpen(m, new Date("2026-11-15T17:00:00Z")), false);
  assert.equal(porraOpen({ ...m, status: "postponed" }, new Date("2026-11-01T00:00:00Z")), false);
});
