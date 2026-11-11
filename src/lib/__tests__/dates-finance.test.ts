import { test } from "node:test";
import assert from "node:assert/strict";
import { madridDay } from "../dates.ts";
import { kindFromSlug, seasonOf, seasonRange } from "../finance.ts";

test("el día de Madrid cambia a medianoche de Madrid, no de UTC", () => {
  assert.equal(madridDay(new Date("2026-11-14T22:59:00Z")), "2026-11-14");
  assert.equal(madridDay(new Date("2026-11-14T23:00:00Z")), "2026-11-15");
  // En verano Madrid va dos horas por delante
  assert.equal(madridDay(new Date("2026-07-01T21:59:00Z")), "2026-07-01");
  assert.equal(madridDay(new Date("2026-07-01T22:00:00Z")), "2026-07-02");
  assert.match(madridDay(), /^\d{4}-\d{2}-\d{2}$/);
});

test("la temporada va de septiembre a agosto", () => {
  assert.equal(seasonOf("2026-09-01"), "2026/27");
  assert.equal(seasonOf("2026-08-31"), "2025/26");
  assert.equal(seasonOf("2027-01-15"), "2026/27");
  assert.equal(seasonOf("2099-12-31"), "2099/00");
  // El 31 de agosto a las 23:30 UTC ya es 1 de septiembre en Madrid
  assert.equal(seasonOf(new Date("2026-08-31T23:30:00Z")), "2026/27");
  assert.equal(seasonOf(new Date("2026-08-31T21:00:00Z")), "2025/26");
});

test("el rango de fechas de una temporada", () => {
  assert.deepEqual(seasonRange("2026/27"), { from: "2026-09-01", to: "2027-08-31" });
  assert.equal(seasonRange("2026-27"), null);
  assert.equal(seasonRange(""), null);
  assert.equal(seasonOf(seasonRange("2026/27")!.from), "2026/27");
  assert.equal(seasonOf(seasonRange("2026/27")!.to), "2026/27");
});

test("ingreso y gasto en la dirección de la página", () => {
  assert.equal(kindFromSlug("ingreso"), "income");
  assert.equal(kindFromSlug("gasto"), "expense");
  assert.equal(kindFromSlug("otro"), null);
  assert.equal(kindFromSlug(undefined), null);
});
