import { test } from "node:test";
import assert from "node:assert/strict";
import { isNostradamus, nostradamusSet, oracleFor, type PlayedMatch } from "../nostradamus.ts";

const M = (id: string, date: string, gf: number, ga: number): PlayedMatch => ({ id, match_date: date, status: "played", goals_for: gf, goals_against: ga, rival: `Rival ${id}` });
const matches = [M("a", "2026-11-07", 2, 1), M("b", "2026-11-14", 0, 0), M("c", "2026-11-21", 3, 2)];
const P = (user_id: string, match_id: string, goals_for: number, goals_against: number) => ({ user_id, match_id, goals_for, goals_against });

test("bola de cristal: el último clavado, como mucho 3 días después", () => {
  const preds = [P("u", "a", 2, 1), P("u", "c", 3, 2), P("u", "b", 1, 0)];
  assert.deepEqual(oracleFor("u", preds, matches, "2026-11-23"), { matchId: "c", rival: "Rival c", gf: 3, ga: 2, count: 2, nostradamus: true });
  assert.equal(oracleFor("u", preds, matches, "2026-11-25"), null);
  // Acertar solo quién gana no cuenta
  assert.equal(oracleFor("v", [P("v", "c", 1, 0)], matches, "2026-11-22"), null);
  // El primero clavado: aún sin mote
  assert.equal(oracleFor("w", [P("w", "c", 3, 2)], matches, "2026-11-22")!.nostradamus, false);
});

test("Nostradamus: dos clavados y una semana desde el último", () => {
  const preds = [P("u", "a", 2, 1), P("u", "c", 3, 2), P("x", "b", 0, 0)];
  assert.deepEqual([...nostradamusSet(preds, matches, "2026-11-28")], ["u"]);
  assert.equal(nostradamusSet(preds, matches, "2026-11-29").size, 0);
  assert.equal(isNostradamus([matches[0]], "2026-11-08"), false);
});
