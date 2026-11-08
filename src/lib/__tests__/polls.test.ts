import { test } from "node:test";
import assert from "node:assert/strict";
import { checkClose, closesAt, madridToUtc, results, shareText, timeLeft, type Poll } from "../polls.ts";
import { areaOf } from "../notifications.ts";

test("la hora de Madrid se pasa bien a UTC, en invierno y en verano", () => {
  assert.equal(madridToUtc(2026, 11, 20, 21, 30).toISOString(), "2026-11-20T20:30:00.000Z");
  assert.equal(madridToUtc(2027, 7, 1, 10, 0).toISOString(), "2027-07-01T08:00:00.000Z");
  assert.equal(closesAt({ until: "2026-12-24T18:00" })!.toISOString(), "2026-12-24T17:00:00.000Z");
  assert.equal(closesAt({ until: "mañana" }), null);
});

test("la duración se cuenta desde ahora y tiene límites", () => {
  const now = new Date("2026-11-08T19:00:00Z");
  assert.equal(closesAt({ hours: 24 }, now)!.toISOString(), "2026-11-09T19:00:00.000Z");
  assert.equal(closesAt({ hours: 0 }, now), null);
  assert.equal(checkClose(closesAt({ hours: 1 }, now), now), null);
  assert.match(checkClose(new Date(now.getTime() + 5 * 60_000), now)!, /15 minutos/);
  assert.match(checkClose(new Date(now.getTime() + 40 * 86_400_000), now)!, /30 días/);
  assert.match(checkClose(null, now)!, /Elige/);
});

test("el tiempo que queda se lee bien", () => {
  const now = new Date("2026-11-08T19:00:00Z");
  assert.equal(timeLeft("2026-11-08T19:20:00Z", now), "Quedan 20 min");
  assert.equal(timeLeft("2026-11-08T21:00:00Z", now), "Quedan 2 h");
  assert.equal(timeLeft("2026-11-08T21:15:00Z", now), "Quedan 2 h 15 min");
  assert.equal(timeLeft("2026-11-09T19:00:00Z", now), "Quedan 1 día");
  assert.equal(timeLeft("2026-11-11T19:00:00Z", now), "Quedan 3 días");
  assert.equal(timeLeft("2026-11-08T18:00:00Z", now), "Cerrada");
});

test("resultado, porcentajes y participación", () => {
  assert.deepEqual(results({ yes: 7, no: 3, eligible: 14 }), { votes: 10, yesPct: 70, noPct: 30, turnout: 71, outcome: "yes" });
  assert.equal(results({ yes: 2, no: 2, eligible: 4 }).outcome, "tie");
  assert.equal(results({ yes: 1, no: 5, eligible: 10 }).outcome, "no");
  assert.deepEqual(results({ yes: 0, no: 0, eligible: 0 }), { votes: 0, yesPct: 0, noPct: 0, turnout: 0, outcome: "none" });
  // 1 de 3: los porcentajes suman 100
  const r = results({ yes: 1, no: 2, eligible: 3 });
  assert.equal(r.yesPct + r.noPct, 100);
});

test("el texto para compartir lleva la pregunta y el resultado", () => {
  const p = { question: "¿Cena el viernes?", open: false, yes: 8, no: 2, eligible: 12 } as Poll;
  const t = shareText(p);
  assert.match(t, /Gana el SÍ/);
  assert.match(t, /«¿Cena el viernes\?»/);
  assert.match(t, /Han votado 10 de 12/);
});

test("cada aviso enviado cae en su sección", () => {
  assert.equal(areaOf("/votaciones#x", "votacion-x"), "polls");
  assert.equal(areaOf("/partidos/liga", "liga-sincronizacion"), "league");
  assert.equal(areaOf("/partidos/123", "convocatoria-123"), "matches");
  assert.equal(areaOf("/loteria/venta/1", null), "lottery");
  assert.equal(areaOf("/admin/patrocinadores", "patrocinadores"), "sponsors");
  assert.equal(areaOf("/", null), "manual");
});
