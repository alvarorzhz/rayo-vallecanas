import { test } from "node:test";
import assert from "node:assert/strict";
import { activeBanner, backAtLabel, isoToMadridLocal, madridLocalToIso, needsReload, normalizeSettings, DEFAULT_SETTINGS } from "../app-settings.ts";

test("sin fila (SQL sin ejecutar) la app sigue como siempre", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.equal(normalizeSettings({ modules_off: ["lottery", "inventado"] as string[] }).modules_off.join(), "lottery");
  assert.equal(normalizeSettings({ banner_tone: "rarito" as never }).banner_tone, "info");
});

test("el mensaje fijo se ve hasta su fecha y no si está vacío", () => {
  const now = new Date("2026-11-25T17:00:00Z");
  const s = { ...DEFAULT_SETTINGS, banner_text: "  Pagad la cuota  ", banner_tone: "urgent" as const };
  assert.deepEqual(activeBanner(s, now), { text: "Pagad la cuota", tone: "urgent" });
  assert.equal(activeBanner({ ...s, banner_until: "2026-11-25T16:59:00Z" }, now), null);
  assert.ok(activeBanner({ ...s, banner_until: "2026-11-26T00:00:00Z" }, now));
  assert.equal(activeBanner({ ...s, banner_text: "   " }, now), null);
});

test("hora de Madrid del formulario ↔ UTC, en invierno y en verano", () => {
  assert.equal(madridLocalToIso("2026-11-25T18:30"), "2026-11-25T17:30:00.000Z");
  assert.equal(madridLocalToIso("2026-07-01T10:00"), "2026-07-01T08:00:00.000Z");
  assert.equal(isoToMadridLocal("2026-11-25T17:30:00.000Z"), "2026-11-25T18:30");
  assert.equal(madridLocalToIso(""), null);
  assert.equal(madridLocalToIso("mañana"), null);
});

test("«volvemos hoy a las…», «mañana…» o el día de la semana", () => {
  const now = new Date("2026-11-25T15:00:00Z"); // miércoles 16:00 en Madrid
  assert.equal(backAtLabel("2026-11-25T17:30:00Z", now), "hoy a las 18:30");
  assert.equal(backAtLabel("2026-11-26T09:00:00Z", now), "mañana a las 10:00");
  assert.match(backAtLabel("2026-11-27T08:00:00Z", now) ?? "", /^el viernes 27 a las 9:00$/);
  assert.equal(backAtLabel("2026-11-25T14:00:00Z", now), null, "una hora ya pasada no se enseña");
  assert.equal(backAtLabel(null, now), null);
});

test("forzar actualización: recarga solo si la marca es nueva para ese móvil", () => {
  assert.equal(needsReload(null, "2026-11-25T17:00:00Z"), false, "primera vez en ese móvil: ya tiene la última");
  assert.equal(needsReload("0", "2026-11-25T17:00:00Z"), true, "nunca se había forzado y ahora sí");
  assert.equal(needsReload("2026-11-25T17:00:00Z", "2026-11-25T17:00:00Z"), false);
  assert.equal(needsReload("2026-11-25T16:00:00Z", "2026-11-25T17:00:00Z"), true);
  assert.equal(needsReload("0", null), false);
});
