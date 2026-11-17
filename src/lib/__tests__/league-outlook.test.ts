import { test } from "node:test";
import assert from "node:assert/strict";
import { goalState, leagueOutlook, needLabel, remainingByTeam, zones } from "../league-outlook.ts";

const row = (pos: number, teamId: string, points: number, zone: string | null = null) => ({
  pos, teamId, name: teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, penalty: 0, points, move: 0,
  zone: zone ? { label: zone, color: "#0a0" } : null, form: [], last: [],
});

test("los partidos que quedan salen del calendario", () => {
  const cal = [
    { homeId: "a", awayId: "b", status: "scheduled" }, { homeId: "a", awayId: "c", status: "played" }, { homeId: "c", awayId: "a", status: "postponed" },
  ] as never[];
  const m = remainingByTeam(cal);
  assert.equal(m.get("a"), 2);
  assert.equal(m.get("b"), 1);
  assert.equal(m.get("c"), 1);
});

test("zonas de la web de la liga, o 6 y 6 si no las marca", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, `t${i}`, 30 - i, i < 6 ? "Acceso 4ª Div. Clausura" : "Permanencia 5ª"));
  assert.deepEqual(zones(rows), { up: 6, upLabel: "Acceso 4ª Div. Clausura", down: 6, downLabel: "Permanencia 5ª" });
  const plain = Array.from({ length: 12 }, (_, i) => row(i + 1, `t${i}`, 30 - i));
  assert.deepEqual(zones(plain), { up: 6, upLabel: null, down: 6, downLabel: null });
});

test("depende de nosotros: lo mínimo para asegurarlo aunque los demás lo ganen todo", () => {
  // Nosotros 20 pts, 5 por jugar. Rivales: 22 (5), 17 (5), 10 (5)
  const others = [{ points: 22, left: 5 }, { points: 17, left: 5 }, { points: 10, left: 5 }];
  const top2 = goalState({ points: 20, left: 5 }, others, 2);
  // Para que solo 1 rival pueda llegar: superar al de 17 (máximo 32) → 33 = 13 puntos más
  assert.deepEqual(top2, { state: "depende-de-nosotros", need: 13 });
  // Ser primeros: el de 22 puede llegar a 37 y nosotros a 35 → depende de otros
  assert.equal(goalState({ points: 20, left: 5 }, others, 1).state, "depende-de-otros");
});

test("hecho e imposible", () => {
  assert.deepEqual(goalState({ points: 40, left: 1 }, [{ points: 20, left: 2 }], 1), { state: "hecho", need: 0 });
  assert.equal(goalState({ points: 5, left: 1 }, [{ points: 20, left: 0 }, { points: 19, left: 0 }], 2).state, "imposible");
  // Un empate final a puntos no cuenta como asegurado
  assert.deepEqual(goalState({ points: 9, left: 1 }, [{ points: 9, left: 1 }], 1), { state: "depende-de-otros", need: null });
});

test("texto de los puntos que faltan", () => {
  assert.equal(needLabel(10), "10 puntos (3 victorias y 1 empate)");
  assert.equal(needLabel(3), "3 puntos (1 victoria)");
  assert.equal(needLabel(1), "1 punto (1 empate)");
});

test("panorama completo: no enseña la salvación si está hecha y vamos arriba", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, `t${i}`, 30 - 2 * i));
  const left = new Map(rows.map((r) => [r.teamId, 2]));
  const o = leagueOutlook(rows, "t1", left)!;
  assert.equal(o.left, 2);
  assert.equal(o.atStake, 6);
  assert.equal(o.max, 34);
  assert.deepEqual(o.goals.map((g) => g.key), ["first", "up"]);
  assert.equal(leagueOutlook(rows, "nadie", left), null);
});
