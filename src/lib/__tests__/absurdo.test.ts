import { test } from "node:test";
import assert from "node:assert/strict";
import { datoAbsurdo, datosAbsurdos, type HistMatch } from "../absurdo.ts";

const names = new Map([["pitu", "Pitu"], ["dani", "Dani"]]);
const m = (id: string, date: string, gf: number, ga: number, extra: Partial<HistMatch> = {}): HistMatch =>
  ({ id, date, kickoff: "10:00:00", rival: "Helmántica CF", gf, ga, firstYes: null, firstScorer: null, assisters: [], ...extra });

// Pitu contesta el primero en 3 partidos: 2 victorias y un empate. En el resto se pierde.
const hist = [
  m("1", "2026-10-03", 2, 1, { firstYes: "pitu" }),
  m("2", "2026-10-10", 1, 1, { firstYes: "pitu" }),
  m("3", "2026-10-17", 3, 0, { firstYes: "pitu" }),
  m("4", "2026-10-24", 0, 2, { firstYes: "dani" }),
  m("5", "2026-10-31", 1, 3, { firstYes: "dani" }),
];
const up = { id: "x", date: "2026-11-28", kickoff: "10:00:00", rival: "Pinto", firstYes: null };

test("encuentra la racha de quien contesta el primero", () => {
  const d = datosAbsurdos(hist, up, names).find((x) => x.key === "voy-pitu");
  assert.ok(d);
  assert.equal(d.text, "Cuando Pitu contesta «Voy» el primero, el Rayo no conoce la derrota: 2 victorias y 1 empate en 3 partidos.");
  assert.equal(d.now, null);
});

test("si la condición se cumple ahora, lo dice y manda sobre el resto", () => {
  const d = datoAbsurdo(hist, { ...up, firstYes: "pitu" }, names);
  assert.deepEqual(d, { text: "Cuando Pitu contesta «Voy» el primero, el Rayo no conoce la derrota: 2 victorias y 1 empate en 3 partidos.", now: "Y esta vez Pitu ya ha contestado el primero 👀" });
});

test("nunca se le echa la culpa de las derrotas a una persona", () => {
  // Con Dani de primero se pierde siempre, pero solo hay 2: y además no se dice de personas
  const more = [...hist, m("6", "2026-11-07", 0, 1, { firstYes: "dani" })];
  assert.ok(!datosAbsurdos(more, up, names).some((x) => x.key === "voy-dani"));
});

test("las condiciones sin persona sí pueden ser gafes", () => {
  // Los sábados (3, 10, 17, 24, 31 oct son sábado): todo. Probamos las horas: a y media se pierde siempre
  const h = hist.map((x, i) => (i >= 2 ? { ...x, kickoff: "10:30:00", gf: 0, ga: 1 } : x));
  const d = datosAbsurdos(h, up, names).find((x) => x.key === "media");
  assert.match(d!.text, /^Cuando el partido empieza a y media, el Rayo no ha ganado nunca: 3 partidos, 3 derrotas y 0 empates/);
});

test("si pasa en todos los partidos no es dato (es la temporada)", () => {
  // Todos en sábado: «los sábados» no sale aunque haya victorias
  assert.ok(!datosAbsurdos(hist, up, names).some((x) => x.key === "dia-6"));
});

test("hacen falta al menos 3 partidos con la condición", () => {
  assert.equal(datoAbsurdo(hist.slice(0, 2), up, names), null);
});

test("de vez en cuando: no sale en todos los partidos, y el mismo partido da siempre lo mismo", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `partido-${i}`);
  const shown = ids.filter((id) => datoAbsurdo(hist, { ...up, id }, names));
  assert.ok(shown.length > 10 && shown.length < 30);
  assert.deepEqual(datoAbsurdo(hist, { ...up, id: "abc" }, names), datoAbsurdo(hist, { ...up, id: "abc" }, names));
});
