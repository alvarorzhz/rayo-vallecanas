import { test } from "node:test";
import assert from "node:assert/strict";
import { duracion, esMadrugada, FRASES_GENERICAS, horaForzada, parte, relojMadrid, suenoHasta, type NightCtx } from "../madrugada.ts";

const at = (h: number, m = 0, day = "2026-11-29") => ({ h, m, day });

test("madrugada de 1:00 a 5:59, hora de Madrid", () => {
  assert.equal(esMadrugada(at(0, 59)), false);
  assert.equal(esMadrugada(at(1)), true);
  assert.equal(esMadrugada(at(5, 59)), true);
  assert.equal(esMadrugada(at(6)), false);
  // 01:30 UTC en invierno son las 2:30 en Madrid
  assert.deepEqual(relojMadrid(new Date("2026-11-29T01:30:00Z")), { h: 2, m: 30, day: "2026-11-29" });
  // 23:30 UTC del día 28 ya es día 29 en Madrid
  assert.deepEqual(relojMadrid(new Date("2026-11-28T23:30:00Z")), { h: 0, m: 30, day: "2026-11-29" });
});

test("hora fingida para probar", () => {
  assert.deepEqual(horaForzada("3:12", at(14)), at(3, 12));
  assert.deepEqual(horaForzada("1", at(14)), at(3, 12));
  assert.deepEqual(horaForzada("1", at(2, 5)), at(2, 5));
  assert.equal(horaForzada(null, at(14)), null);
});

test("sueño hasta la quedada o una hora antes del partido", () => {
  const next = { date: "2026-11-29", kickoff: "10:30:00", meet: "09:45:00", rival: "Pinto", reply: "yes" as const };
  assert.deepEqual(suenoHasta(at(2, 47), next), { min: 388, alarm: "9:15", why: "quedada" });
  assert.deepEqual(suenoHasta(at(2, 47), { ...next, meet: null }), { min: 403, alarm: "9:30", why: "partido" });
  // Partido mañana: un día más
  assert.equal(suenoHasta(at(2, 0, "2026-11-28"), { ...next, meet: null })!.min, 1440 + 450);
  assert.equal(suenoHasta(at(2), { ...next, kickoff: null }), null);
  assert.equal(duracion(388), "6 h 28 min");
  assert.equal(duracion(45), "45 min");
  assert.equal(duracion(120), "2 h");
});

const base: NightCtx = { name: "Pitu", player: true, next: null, last: null };
const next = { date: "2026-11-29", kickoff: "10:30:00", meet: null, rival: "Pinto", reply: "yes" as const };

test("convocado que dijo «Voy»: amarilla con las horas de sueño", () => {
  const p = parte({ ...base, next }, at(2, 47), 1, 1);
  assert.equal(p.card, "yellow");
  assert.equal(p.title, "¿Tú no tenías partido mañana?");
  assert.match(p.text, /Dijiste «Voy» para jugar hoy a las 10:30 contra Pinto, y son las 2:47/);
  assert.match(p.text, /6 h 43 min/);
  assert.match(parte({ ...base, next: { ...next, date: "2026-11-30" } }, at(2, 47), 1, 1).text, /jugar mañana a las 10:30/);
});

test("cada respuesta de la convocatoria tiene su frase", () => {
  assert.match(parte({ ...base, next: { ...next, reply: "pending" } }, at(3), 1, 1).text, /no hubo tiempo/);
  assert.match(parte({ ...base, next: { ...next, reply: "maybe" } }, at(3), 1, 1).text, /ojeras/);
  assert.match(parte({ ...base, next: { ...next, reply: "no" } }, at(3), 1, 1).text, /no vienes/);
  assert.match(parte({ ...base, next: { ...next, reply: null } }, at(3), 1, 1).text, /No estás en la lista/);
  assert.match(parte({ ...base, player: false, next }, at(3), 1, 1).text, /el acta/);
});

test("la noche de después: MVP, goles y resultado", () => {
  const last = { date: "2026-11-28", gf: 3, ga: 1, rival: "Pinto", goals: 0, mvp: false, played: true };
  assert.match(parte({ ...base, last: { ...last, mvp: true } }, at(2), 1, 1).title, /MVP/);
  assert.match(parte({ ...base, last: { ...last, goals: 2 } }, at(2), 1, 1).text, /^2 goles/);
  assert.match(parte({ ...base, last: { ...last, goals: 1 } }, at(2), 1, 1).title, /tu gol/);
  assert.match(parte({ ...base, last }, at(2), 1, 1).text, /3-1/);
  assert.match(parte({ ...base, last: { ...last, gf: 1, ga: 1 } }, at(2), 1, 1).text, /ovejas/);
  assert.match(parte({ ...base, last: { ...last, gf: 0, ga: 2 } }, at(2), 1, 1).text, /0-2/);
});

test("reincidir la misma noche: roja y luego Comité", () => {
  assert.equal(parte({ ...base, next }, at(3), 2, 1).card, "red");
  assert.match(parte(base, at(3, 5), 2, 1).text, /3:05/);
  assert.equal(parte(base, at(4), 3, 1).title, "Al Comité de Competición");
});

test("sin nada especial: frase de vestuario que cambia cada noche; racha del mes al pie", () => {
  const a = parte(null, at(3, 0, "2026-11-29"), 1, 1);
  assert.ok(FRASES_GENERICAS.some((f) => f.title === a.title));
  const titles = new Set(["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"].map((d) => parte(null, at(3, 0, d), 1, 1).title));
  assert.ok(titles.size >= 2);
  assert.equal(a.foot, null);
  assert.match(parte(null, at(3), 1, 2).foot!, /Segunda/);
  assert.match(parte(null, at(3), 1, 4).foot!, /4\.ª madrugada.*Búho de Oro/);
});
