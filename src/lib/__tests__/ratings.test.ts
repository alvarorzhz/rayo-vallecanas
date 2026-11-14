import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtScore, leftToRate, nudge, ratingRanking, scoreTone, seasonRatingPool, validScore } from "../ratings.ts";

test("las notas van del 1 al 10 de medio en medio punto", () => {
  for (const ok of [1, 1.5, 6.5, 10]) assert.equal(validScore(ok), true, String(ok));
  for (const ko of [0, 0.5, 10.5, 6.3, NaN, "7", null]) assert.equal(validScore(ko), false, String(ko));
});

test("medio punto arriba o abajo sin salirse", () => {
  assert.equal(nudge(6, 0.5), 6.5);
  assert.equal(nudge(10, 0.5), 10);
  assert.equal(nudge(1, -0.5), 1);
});

test("formato a la española", () => {
  assert.equal(fmtScore(7), "7");
  assert.equal(fmtScore(6.5), "6,5");
  assert.equal(fmtScore(7.25, 1), "7,3");
  assert.equal(fmtScore(8, 1), "8,0");
});

test("colores de la nota", () => {
  assert.equal(scoreTone(4.5), "low");
  assert.equal(scoreTone(5), "mid");
  assert.equal(scoreTone(7), "good");
  assert.equal(scoreTone(8.5), "top");
});

test("ranking: mejor media arriba, los que no llegan al mínimo al final", () => {
  const r = ratingRanking({
    mine: { b: 9 },
    averages: { a: { avg: 6.5, n: 3 }, b: { avg: 8, n: 2 }, c: { avg: null, n: 1 }, e: { avg: 8, n: 4 } },
  }, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(r.map((x) => x.id), ["e", "b", "a", "c", "d"]);
  assert.equal(r[1].mine, 9);
  assert.equal(r[4].n, 0);
});

test("cuántos me quedan por puntuar, sin contarme a mí", () => {
  assert.equal(leftToRate({ a: 7 }, ["a", "b", "me"], "me"), 1);
  assert.equal(leftToRate({}, ["a", "b"], null), 2);
});

test("la nota media de la temporada solo cuenta a los que tienen notas en bastantes partidos", () => {
  const pool = seasonRatingPool([
    { player_id: "a", avg_score: 9.5, matches: 1, best: 9.5 },
    { player_id: "b", avg_score: 7.2, matches: 4, best: 8 },
    { player_id: "c", avg_score: 6.8, matches: 2, best: 7 },
  ]);
  assert.deepEqual([...pool.keys()], ["b", "c"]);
  assert.equal(seasonRatingPool([{ player_id: "a", avg_score: 9, matches: 1, best: 9 }]).size, 1);
  assert.equal(seasonRatingPool([]).size, 0);
});
