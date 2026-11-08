import { test } from "node:test";
import assert from "node:assert/strict";
import { fiestaDe, fiestaForzada, saludoDe } from "../fiestas.ts";

const at = (iso: string) => fiestaDe(new Date(iso));

test("fuera de fiestas no hay adorno ni saludo", () => {
  assert.deepEqual(at("2026-11-08T12:00:00Z"), { adorno: null, saludo: null, year: 2026 });
  assert.equal(at("2026-12-14T12:00:00Z").adorno, null);
  assert.equal(at("2027-01-07T12:00:00Z").adorno, null);
});

test("Navidad: gorro del 15 de diciembre a Reyes, saludo el 24 y el 25", () => {
  assert.deepEqual(at("2026-12-15T12:00:00Z"), { adorno: "gorro", saludo: null, year: 2026 });
  assert.equal(at("2026-12-24T12:00:00Z").saludo, "navidad");
  assert.equal(at("2026-12-25T20:00:00Z").saludo, "navidad");
  assert.equal(at("2026-12-26T12:00:00Z").saludo, null);
  assert.equal(at("2027-01-06T12:00:00Z").adorno, "gorro");
});

test("Nochevieja y Año Nuevo con hora de Madrid", () => {
  // 23:30 UTC del 30 ya es 31 en Madrid
  assert.equal(at("2026-12-30T23:30:00Z").saludo, "nochevieja");
  // 23:30 UTC del 31 ya es 1 de enero en Madrid
  assert.deepEqual(at("2026-12-31T23:30:00Z"), { adorno: "purpurina", saludo: "anonuevo", year: 2027 });
  assert.equal(saludoDe("anonuevo", 2027).title, "¡Feliz 2027!");
  assert.match(saludoDe("nochevieja", 2026).text, /2027/);
});

test("se puede forzar para probar", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(fiestaForzada("navidad", now)?.adorno, "gorro");
  assert.equal(fiestaForzada("anonuevo", now)?.saludo, "anonuevo");
  assert.equal(fiestaForzada("anonuevo", now)?.year, 2027);
  assert.equal(fiestaForzada("nochevieja", now)?.year, 2026);
  assert.equal(fiestaForzada("cualquiera", now), null);
});
