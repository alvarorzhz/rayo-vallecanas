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
  // empate en el 1º: los dos son primeros
  assert.deepEqual(r.map((x) => x.rank), [1, 1, 3, null, null]);
});

test("solo se ve la nota de los 3 mejores; el resto, en su sitio y sin nota (respuesta antigua)", () => {
  const r = ratingRanking({
    mine: { f: 4 },
    averages: { a: { avg: 9, n: 3 }, b: { avg: 8, n: 3 }, c: { avg: 7.5, n: 3 }, d: { avg: 7.04, n: 3 }, f: { avg: 4, n: 2 }, g: { avg: null, n: 1 } },
  }, ["g", "f", "d", "c", "b", "a", "h"]);
  assert.deepEqual(r.map((x) => x.id), ["a", "b", "c", "d", "f", "g", "h"]);
  assert.deepEqual(r.map((x) => x.avg), [9, 8, 7.5, null, null, null, null]);
  assert.deepEqual(r.map((x) => x.hidden), [false, false, false, true, true, false, false]);
  assert.equal(r[4].mine, 4); // mi propia nota sí la veo
});

test("empate en el 3º: se ven todos los empatados", () => {
  const r = ratingRanking({
    mine: {},
    averages: { a: { avg: 9, n: 3 }, b: { avg: 8, n: 3 }, c: { avg: 7.5, n: 4 }, d: { avg: 7.52, n: 3 }, e: { avg: 7, n: 3 } },
  }, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3, 3, null]);
  assert.equal(r[4].hidden, true);
});

test("respuesta nueva: el orden lo da pos y solo llegan las medias del podio", () => {
  const r = ratingRanking({
    mine: {},
    averages: { a: { avg: 8, n: 3, pos: 2 }, b: { avg: 9, n: 3, pos: 1 }, c: { avg: null, n: 3, pos: 5 }, d: { avg: null, n: 2, pos: 4 }, e: { avg: 7, n: 3, pos: 3 }, f: { avg: null, n: 1, pos: null } },
  }, ["f", "c", "d", "a", "b", "e", "g"]);
  assert.deepEqual(r.map((x) => x.id), ["b", "a", "e", "d", "c", "f", "g"]);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3, null, null, null, null]);
  assert.deepEqual(r.map((x) => x.hidden), [false, false, false, true, true, false, false]);
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
