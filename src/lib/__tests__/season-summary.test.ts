import { test } from "node:test";
import assert from "node:assert/strict";
import { playerSummary, teamSummary, type SumMatch } from "../season-summary.ts";

const M = (id: string, gf: number, ga: number, mvp: string | null = null): SumMatch =>
  ({ id, match_date: `2026-10-${id.padStart(2, "0")}`, status: "played", goals_for: gf, goals_against: ga, mvp_player_id: mvp, rival: `Rival ${id}`, is_home: true });
const matches = [M("1", 3, 1, "dani"), M("2", 2, 2), M("3", 4, 0, "dani"), M("4", 0, 1), { ...M("5", 0, 0), status: "scheduled", goals_for: null, goals_against: null }];
const app = (match_id: string, player_id: string, extra = {}) => ({ match_id, player_id, goalkeeper: false, conceded: 0, yellows: 0, red: false, ...extra });
const data = {
  matches,
  apps: [
    app("1", "dani"), app("2", "dani", { yellows: 1 }), app("3", "dani"), app("4", "dani"),
    app("1", "javi"), app("3", "javi"),
    app("1", "porte", { goalkeeper: true, conceded: 1 }), app("3", "porte", { goalkeeper: true, conceded: 0 }), app("4", "porte", { goalkeeper: true, conceded: 1 }),
  ],
  goals: [
    { match_id: "1", scorer_id: "dani", assist_id: "javi" }, { match_id: "1", scorer_id: "dani", assist_id: null }, { match_id: "1", scorer_id: "javi", assist_id: "dani" },
    { match_id: "2", scorer_id: "javi", assist_id: null }, { match_id: "2", scorer_id: "dani", assist_id: null },
    { match_id: "3", scorer_id: "dani", assist_id: "javi" }, { match_id: "3", scorer_id: "dani", assist_id: "javi" }, { match_id: "3", scorer_id: "dani", assist_id: null }, { match_id: "3", scorer_id: null, assist_id: null },
  ],
  callups: [{ match_id: "1", player_id: "javi", reply: "yes" }, { match_id: "2", player_id: "javi", reply: "no" }],
};

test("balance del equipo, sin contar los no jugados", () => {
  assert.deepEqual(teamSummary(matches), { played: 4, W: 2, D: 1, L: 1, gf: 9, ga: 4 });
});

test("resumen del pichichi: goles, MVP, mejor partido y puesto", () => {
  const s = playerSummary("dani", data);
  assert.equal(s.apps, 4);
  assert.equal(s.goals, 6);
  assert.equal(s.assists, 1);
  assert.equal(s.mvps, 2);
  assert.equal(s.yellows, 1);
  assert.equal(s.goalsRank, 1);
  assert.equal(s.best?.match.id, "3");
  assert.equal(s.best?.goals, 3);
  assert.equal(s.badge.title, "Pichichi");
});

test("asistente, portero y convocatorias", () => {
  const j = playerSummary("javi", data);
  assert.equal(j.assists, 3);
  assert.equal(j.assistsRank, 1);
  assert.equal(j.goalsRank, 2);
  assert.equal(j.called, 2);
  assert.equal(j.said_yes, 1);
  assert.equal(j.badge.title, "El Asistente");
  const p = playerSummary("porte", data);
  assert.deepEqual([p.gkApps, p.conceded, p.cleanSheets], [3, 2, 1]);
  assert.equal(p.badge.title, "El Muro");
  assert.equal(playerSummary("nadie", data).badge.line, "Esta vez le tocó animar desde la banda");
});
