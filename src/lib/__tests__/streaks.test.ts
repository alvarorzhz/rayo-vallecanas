import { test } from "node:test";
import assert from "node:assert/strict";
import { runOf, streaks, type StreakGame } from "../streaks.ts";

test("racha en marcha y la mejor", () => {
  assert.deepEqual(runOf([true, true, false, true, true, true, false]), { current: 2, best: 3 });
  assert.deepEqual(runOf([false, true]), { current: 0, best: 1 });
  assert.deepEqual(runOf([]), { current: 0, best: 0 });
});

const g = (goals: number, gf: number, ga: number, extra: Partial<StreakGame> = {}): StreakGame =>
  ({ goals, yellows: 0, red: false, goalkeeper: false, conceded: 0, gf, ga, ...extra });

test("rachas de un delantero: en marcha primero, solo las de 3 o más", () => {
  const games = [g(1, 3, 1), g(2, 2, 2), g(1, 1, 0), g(0, 0, 1, { yellows: 1 }), g(1, 2, 0)];
  const s = streaks(games, ["yes", "yes", "yes", "yes", "no"], false);
  assert.deepEqual(s.map((x) => [x.key, x.current, x.best, x.live]), [
    ["voy", 4, 4, true],
    ["goals", 3, 3, true],
    ["unbeaten", 3, 3, true],
    ["cards", 3, 3, true],
  ]);
});

test("al portero se le cuentan porterías a cero y no goles", () => {
  const games = [g(0, 1, 0, { goalkeeper: true }), g(0, 2, 0, { goalkeeper: true }), g(0, 3, 0, { goalkeeper: true })];
  const keys = streaks(games, [], true).map((x) => x.key);
  assert.ok(keys.includes("clean"));
  assert.ok(!keys.includes("goals"));
  // «Sin perder» igual que «victorias seguidas»: no se repite
  assert.ok(keys.includes("wins") && !keys.includes("unbeaten"));
});

test("una racha cortada sale con su récord, sin «en marcha»", () => {
  const games = [g(0, 0, 1), g(1, 1, 0), g(1, 1, 0), g(1, 1, 0)];
  const goals = streaks(games, [], false).find((x) => x.key === "goals")!;
  assert.deepEqual([goals.current, goals.best, goals.live], [0, 3, false]);
});
