import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, goalTitle, type GoalFacts } from "../season-goals.ts";

const facts = (pairs: [number, number][], extra: Partial<GoalFacts> = {}): GoalFacts => ({
  matches: pairs.map(([gf, ga]) => ({ gf, ga })), squad: 14, squadPlayed: 13, league: null, ...extra,
});

test("títulos", () => {
  assert.equal(goalTitle("goals_for", 30), "30 goles a favor");
  assert.equal(goalTitle("position", 1), "Ser campeones de liga");
  assert.equal(goalTitle("position", 6), "Acabar entre los 6 primeros");
  assert.equal(goalTitle("clean_sheets", 1), "1 portería a cero");
});

test("contadores: goles, victorias y porterías a cero", () => {
  const f = facts([[3, 1], [2, 2], [1, 0], [0, 1], [4, 0]]);
  assert.deepEqual(goalProgress("goals_for", 30, f), { value: 10, target: 30, pct: (10 / 30) * 100, done: false, now: "10 / 30", hint: "Faltan 20 goles" });
  assert.equal(goalProgress("wins", 3, f).done, true);
  assert.equal(goalProgress("clean_sheets", 2, f).value, 2);
});

test("rachas: la mejor de la temporada cuenta, la barra sigue a la que está en marcha", () => {
  const f = facts([[1, 0], [1, 0], [1, 0], [0, 1], [2, 0]]);
  const w = goalProgress("win_streak", 3, f);
  assert.equal(w.done, true);
  const w5 = goalProgress("win_streak", 5, f);
  assert.deepEqual([w5.done, w5.now, w5.hint, w5.pct], [false, "En marcha: 1", "Su mejor racha: 3", 20]);
});

test("toda la plantilla y el puesto en la liga", () => {
  assert.equal(goalProgress("all_play", 1, facts([])).hint, "Falta 1 jugador por debutar");
  assert.equal(goalProgress("all_play", 1, facts([], { squadPlayed: 14 })).done, true);
  const league = { pos: 2, total: 12, finished: false, secured: (top: number) => top >= 4 };
  const p3 = goalProgress("position", 3, facts([], { league }));
  assert.deepEqual([p3.done, p3.now, p3.hint], [false, "2º ahora", "Va por buen camino"]);
  assert.equal(goalProgress("position", 6, facts([], { league })).done, true);
  assert.equal(goalProgress("position", 1, facts([], { league })).hint, "Hay que subir 1 puesto");
  assert.equal(goalProgress("position", 3, facts([])).now, "Sin clasificación");
});
