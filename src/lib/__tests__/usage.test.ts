import { test } from "node:test";
import assert from "node:assert/strict";
import { AREA_BY_KEY, areaStats, dailyPeople, deviceKind, personStats, usageArea, USAGE_AREAS } from "../usage.ts";

test("cada dirección cuenta a su pantalla", () => {
  const cases: Record<string, string | null> = {
    "/": "inicio",
    "/partidos": "partidos",
    "/partidos/estadisticas": "estadisticas",
    "/partidos/porra": "porra",
    "/partidos/abc-123": "partido",
    "/partidos/abc-123/convocatoria": "convocatoria",
    "/partidos/abc-123/directo": "directo",
    "/partidos/abc-123/acta": "acta",
    "/partidos/abc-123/editar": "partido_editar",
    "/partidos/nuevo": "partido_editar",
    "/plantilla": "plantilla",
    "/plantilla/xyz": "jugador",
    "/plantilla/xyz/editar": "jugador_editar",
    "/plantilla/nueva-temporada": "temporada",
    "/la-voz": "la_voz",
    "/la-voz/n1": "noticia",
    "/la-voz/n1/editar": "redaccion",
    "/la-voz/entrevista/e1": "entrevista",
    "/loteria": "sorteos",
    "/loteria/c1/vender": "vender",
    "/loteria/c1/ventas": "sorteos",
    "/mis-ventas": "mis_ventas",
    "/finanzas": "finanzas",
    "/finanzas/informes": "informes",
    "/finanzas/m1/editar": "movimientos",
    "/admin": "mesa",
    "/admin/auditoria/accesos": "auditoria",
    "/admin/uso": "uso",
    "/admin/algo-raro": null,
    "/votaciones": "votaciones",
    "/perfil": "perfil",
    "/rifa/x": null,
  };
  for (const [path, area] of Object.entries(cases)) assert.equal(usageArea(path), area, path);
});

test("todas las pantallas que se cuentan tienen nombre y cumplen el formato de la base de datos", () => {
  const keys = new Set(USAGE_AREAS.map((a) => a.key));
  assert.equal(keys.size, USAGE_AREAS.length, "sin claves repetidas");
  for (const k of keys) assert.match(k, /^[a-z_]{1,32}$/);
  for (const p of ["/partidos/resumen", "/plantilla/cuotas", "/admin/copia", "/novedades"]) assert.ok(AREA_BY_KEY.has(usageArea(p)!), p);
});

test("dispositivo", () => {
  assert.equal(deviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "movil");
  assert.equal(deviceKind("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari"), "movil");
  assert.equal(deviceKind("Mozilla/5.0 (Linux; Android 15; SM-X210) Safari"), "tablet");
  assert.equal(deviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "tablet");
  assert.equal(deviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "ordenador");
});

const rows = [
  { day: "2026-11-14", user_id: "a", area: "inicio", hits: 5 },
  { day: "2026-11-14", user_id: "a", area: "porra", hits: 2 },
  { day: "2026-11-15", user_id: "a", area: "porra", hits: 1 },
  { day: "2026-11-15", user_id: "b", area: "inicio", hits: 1 },
];

test("pantallas: primero las que usa más gente, y las que nadie abre salen con 0", () => {
  const s = areaStats(rows, (k) => k !== "copia");
  assert.equal(s[0].key, "inicio");
  assert.equal(s[0].people, 2);
  assert.equal(s[0].hits, 6);
  assert.equal(s[1].key, "porra");
  assert.equal(s[1].hits, 3);
  assert.ok(s.some((a) => a.key === "rivales" && a.hits === 0));
  assert.ok(!s.some((a) => a.key === "copia"), "lo que no puede ver nadie no sale");
});

test("por persona: días, visitas, pantalla favorita (sin contar Inicio) y último día", () => {
  const p = personStats(rows);
  assert.deepEqual(p.get("a"), { user_id: "a", days: 2, hits: 8, top: "porra", last: "2026-11-15" });
  assert.deepEqual(p.get("b"), { user_id: "b", days: 1, hits: 1, top: null, last: "2026-11-15" });
});

test("personas por día, con los días vacíos a 0", () => {
  assert.deepEqual(dailyPeople(rows, "2026-11-15", 3), [
    { day: "2026-11-13", people: 0 },
    { day: "2026-11-14", people: 1 },
    { day: "2026-11-15", people: 2 },
  ]);
});
