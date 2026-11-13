import { test } from "node:test";
import assert from "node:assert/strict";
import { achievements, type AchievementInput } from "../achievements.ts";

const season = (o: Partial<AchievementInput["seasons"][number]> = {}): AchievementInput["seasons"][number] => ({
  season: "2026/27", apps: 0, goals: 0, assists: 0, mvps: 0, clean_sheets: 0, yellows: 0, reds: 0, armband: null, ...o,
});

test("sin partidos no hay insignias, pero sí el primer escalón de cada cosa", () => {
  const r = achievements({ seasons: [season()], goalsPerMatch: [], line: "FWD" });
  assert.equal(r.badges.length, 0);
  const keys = r.next.map((n) => n.key);
  assert.ok(keys.includes("apps") && keys.includes("goals") && keys.includes("hat"));
  assert.ok(!keys.includes("clean"), "al de campo no se le piden porterías a cero");
});

test("suma todas las temporadas y da el nivel más alto alcanzado", () => {
  const r = achievements({
    seasons: [season({ season: "2025/26", apps: 14, goals: 6, assists: 2 }), season({ apps: 12, goals: 5, mvps: 3 })],
    goalsPerMatch: [1, 3, 2],
    line: "MID",
  });
  const by = Object.fromEntries(r.badges.map((b) => [b.key, b]));
  assert.equal(by.apps.title, "Fijo");          // 26 partidos
  assert.equal(by.apps.detail, "26 partidos");
  assert.equal(by.goals.title, "Killer");       // 11 goles
  assert.equal(by.hat.title, "Hat-trick");
  assert.equal(by.hat.detail, "3 goles en un partido");
  assert.equal(by.mvps.title, "Estrella");
  assert.equal(by.seasons.title, "Repite");
  // El siguiente de partidos: 50
  assert.deepEqual(r.next.find((n) => n.key === "apps"), { key: "apps", icon: "🏟️", title: "Veterano", detail: "50 partidos", value: 26, goal: 50 });
});

test("portero: porterías a cero en lugar de goles", () => {
  const r = achievements({ seasons: [season({ apps: 8, clean_sheets: 5 })], goalsPerMatch: [], line: "GK" });
  assert.equal(r.badges.find((b) => b.key === "clean")?.title, "El Muro");
  assert.ok(!r.next.some((n) => n.key === "goals"));
});

test("capitán y temporada sin tarjetas", () => {
  const r = achievements({ seasons: [season({ apps: 10, armband: "captain" })], goalsPerMatch: [], line: "DEF" });
  assert.ok(r.badges.some((b) => b.key === "captain"));
  assert.equal(r.badges.find((b) => b.key === "fair")?.detail, "2026/27 sin tarjetas");
  const carded = achievements({ seasons: [season({ apps: 10, yellows: 1 })], goalsPerMatch: [], line: "DEF" });
  assert.ok(!carded.badges.some((b) => b.key === "fair"));
});

test("los siguientes escalones, el más cercano primero", () => {
  const r = achievements({ seasons: [season({ apps: 9, goals: 1 })], goalsPerMatch: [1], line: "FWD" });
  assert.equal(r.next[0].key, "apps"); // 9 de 10
});
