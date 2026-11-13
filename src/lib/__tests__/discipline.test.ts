import { test } from "node:test";
import assert from "node:assert/strict";
import { discipline, type CardRow } from "../discipline.ts";

const r = (id: string, yellows = 0, red = false): CardRow => ({ match_id: id, yellows, red });

test("sin tarjetas, nada", () => {
  assert.deepEqual(discipline([r("a"), r("b")], 0, "b"), { count: 0, inCycle: 0, status: "ok", reason: null });
});

test("con 4 amarillas avisa de que está a una", () => {
  const d = discipline([r("a", 1), r("b", 1), r("c", 1), r("d", 1), r("e")], null, "e");
  assert.equal(d.inCycle, 4);
  assert.equal(d.status, "warn");
});

test("la quinta en el último partido: sanción", () => {
  const d = discipline([r("a", 1), r("b", 1), r("c", 1), r("d", 1), r("e", 1)], null, "e");
  assert.equal(d.count, 5);
  assert.equal(d.status, "banned");
});

test("el ciclo ya cumplido no vuelve a sancionar", () => {
  const d = discipline([r("a", 1), r("b", 1), r("c", 1), r("d", 1), r("e", 1), r("f")], null, "f");
  assert.equal(d.status, "ok");
  assert.equal(d.inCycle, 0);
});

test("la doble amarilla es expulsión y no cuenta para el ciclo", () => {
  const d = discipline([r("a", 1), r("b", 2, true)], null, "b");
  assert.equal(d.count, 1);
  assert.equal(d.status, "banned");
  assert.match(d.reason!, /doble amarilla/);
  assert.equal(discipline([r("a", 1), r("b", 2, true), r("c")], null, "c").status, "ok");
});

test("roja directa en el último partido", () => {
  assert.match(discipline([r("a", 0, true)], null, "a").reason!, /Roja directa/);
});

test("las amarillas de la liga sin acta se suman al principio", () => {
  // La liga dice 4 y las actas solo tienen 1: lleva 4
  assert.equal(discipline([r("a", 1)], 4, "z").status, "warn");
  // La liga dice 4 y hoy ha visto otra en el último partido con acta: cumple ciclo
  assert.equal(discipline([r("a", 1)], 5, "a").status, "banned");
  // Si las actas tienen más que la liga, mandan las actas
  assert.equal(discipline([r("a", 1), r("b", 1)], 0, "z").count, 2);
});
