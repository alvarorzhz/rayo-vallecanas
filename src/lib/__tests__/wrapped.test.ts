import { test } from "node:test";
import assert from "node:assert/strict";
import type { SumMatch } from "../season-summary.ts";
import { goalPartner, withWithout, wrappedSlides, type WrappedInput } from "../wrapped.ts";

const M = (id: string, gf: number, ga: number, mvp: string | null = null): SumMatch =>
  ({ id, match_date: `2026-10-${id.padStart(2, "0")}`, status: "played", goals_for: gf, goals_against: ga, mvp_player_id: mvp, rival: `Rival ${id}`, is_home: true });
const matches = [M("1", 3, 1, "dani"), M("2", 2, 2), M("3", 4, 0, "dani"), M("4", 0, 1), { ...M("5", 0, 0), status: "scheduled", goals_for: null, goals_against: null }];
const app = (match_id: string, player_id: string, extra = {}) => ({ match_id, player_id, goalkeeper: false, conceded: 0, yellows: 0, red: false, ...extra });
const data = {
  matches,
  apps: [
    app("1", "dani"), app("2", "dani"), app("3", "dani"), app("4", "dani"),
    app("1", "javi"), app("3", "javi"),
    app("1", "porte", { goalkeeper: true, conceded: 1 }), app("3", "porte", { goalkeeper: true, conceded: 0 }), app("4", "porte", { goalkeeper: true, conceded: 1 }),
  ],
  goals: [
    { match_id: "1", scorer_id: "dani", assist_id: "javi" }, { match_id: "1", scorer_id: "dani", assist_id: null }, { match_id: "1", scorer_id: "javi", assist_id: "dani" },
    { match_id: "2", scorer_id: "javi", assist_id: null }, { match_id: "2", scorer_id: "dani", assist_id: "luis" },
    { match_id: "3", scorer_id: "dani", assist_id: "javi" }, { match_id: "3", scorer_id: "dani", assist_id: "javi" }, { match_id: "3", scorer_id: "dani", assist_id: null },
  ],
  callups: [{ match_id: "1", player_id: "dani", reply: "yes" }, { match_id: "2", player_id: "dani", reply: "no" }],
};
const names = new Map([["dani", "Dani"], ["javi", "Javi"], ["luis", "Luis"], ["porte", "Porte"]]);
const input = (playerId: string, extra: Partial<WrappedInput> = {}): WrappedInput =>
  ({ playerId, you: true, name: names.get(playerId)!, scope: "Apertura 2026-27", scopeShort: "Apertura", gk: false, data, names, rating: null, ...extra });

test("socio de gol: con quien más ha combinado, en las dos direcciones", () => {
  assert.deepEqual(goalPartner("dani", data.goals), { id: "javi", together: 4, got: 3, gave: 1 });
  assert.deepEqual(goalPartner("javi", data.goals), { id: "dani", together: 4, got: 1, gave: 3 });
  assert.equal(goalPartner("porte", data.goals), null);
});

test("con él y sin él: solo partidos jugados", () => {
  assert.deepEqual(withWithout("javi", matches, data.apps), { withW: 2, withN: 2, withoutW: 0, withoutN: 2 });
  assert.deepEqual(withWithout("dani", matches, data.apps), { withW: 2, withN: 4, withoutW: 0, withoutN: 0 });
});

test("historias del pichichi, en orden y de tú", () => {
  const { slides } = wrappedSlides(input("dani", { rating: { avg: 7.36, matches: 3, best: 9, rank: 1 } }));
  assert.deepEqual(slides.map((s) => s.key), ["intro", "partidos", "goles", "socio", "mejor", "mvp", "talisman", "titulo"]);
  const by = Object.fromEntries(slides.map((s) => [s.key, s]));
  assert.equal(by.intro.big, "Tu Apertura");
  assert.equal(by.partidos.count, 4);
  assert.match(by.partidos.lines[0], /Todos los que jugó el equipo \(4\)/);
  assert.match(by.partidos.lines.at(-1)!, /Dijiste «Voy» a 1 de 2 convocatorias/);
  assert.equal(by.goles.count, 6);
  assert.equal(by.goles.lines[0], "y 1 asistencia");
  assert.equal(by.goles.lines[1], "Máximo goleador del equipo");
  // 7 goles en los que participó de 9 a favor
  assert.match(by.goles.lines[2], /78 %/);
  assert.equal(by.socio.big, "Javi");
  assert.equal(by.socio.lines[0], "4 goles juntos");
  assert.equal(by.socio.lines[1], "Javi te dio 3 pases de gol y tú le diste 1");
  assert.equal(by.mejor.big, "Rayo 4-0 Rival 3");
  assert.equal(by.mvp.unit, "veces MVP");
  assert.ok(by.mvp.lines.includes("Nota media 7,4 · Notable"));
  assert.ok(by.mvp.lines.includes("La mejor nota del equipo"));
  assert.equal(by.talisman.big, "50 %");
  assert.equal(by.talisman.lines[1], "Estuviste en todos");
  assert.equal(by.titulo.big, "Pichichi");
});

test("en tercera persona cuando mira otro", () => {
  const { slides } = wrappedSlides(input("javi", { you: false }));
  const by = Object.fromEntries(slides.map((s) => [s.key, s]));
  assert.equal(by.intro.big, "Javi");
  assert.equal(by.socio.kicker, "SU SOCIO DE GOL");
  assert.match(by.talisman.lines[1], /^Sin él: 0 % \(0 de 2\)$/);
  assert.equal(by.talisman.big, "100 %");
});

test("portero: porterías a cero y sin historia de goles", () => {
  const { slides } = wrappedSlides(input("porte", { gk: true }));
  const keys = slides.map((s) => s.key);
  assert.ok(!keys.includes("goles"));
  assert.ok(!keys.includes("socio"));
  const p = slides.find((s) => s.key === "porteria")!;
  assert.equal(p.count, 1);
  assert.equal(p.unit, "portería a cero");
  assert.equal(p.lines[1], "2 goles encajados · 0,7 por partido");
});

test("sin partidos: intro, partidos a cero y título, sin nada más", () => {
  const { slides } = wrappedSlides(input("nadie", { name: "Nadie" }));
  assert.deepEqual(slides.map((s) => s.key), ["intro", "partidos", "titulo"]);
  assert.equal(slides[2].big, "Del Rayo");
  assert.match(slides[1].lines[0], /animar desde la banda/);
});
