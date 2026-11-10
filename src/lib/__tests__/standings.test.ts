import { test } from "node:test";
import assert from "node:assert/strict";
import { gapLabel, matchRanks, rivalRow } from "../standings.ts";
import type { StandingRow } from "../league-parse.ts";

const row = (pos: number, teamId: string, name: string, points: number, played = 6): StandingRow => ({
  pos, teamId, name, played, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, penalty: 0, points, move: 0, zone: null, form: [],
});
const rows = [row(1, "10", "C.D. Peñaranda", 16), row(2, "176726", "Rayo Vallecañas", 13), row(3, "30", "Atlético Tejares", 13, 5), row(4, "40", "Unión Ciudad Rodrigo", 7)];
const m = (id: string, rival: { name: string; ext_id?: string | null }, extra: Partial<{ competition: string; status: string; season: string }> = {}) =>
  ({ id, competition: "league", status: "scheduled", season: "2026/27", rival, ...extra });

test("el rival se encuentra por su id de la liga y, si no lo tiene, por el nombre sin tildes", () => {
  assert.equal(rivalRow(rows, { name: "Otro nombre", ext_id: "futormes:40" })?.pos, 4);
  assert.equal(rivalRow(rows, { name: "CD Penaranda", ext_id: null })?.pos, 1);
  assert.equal(rivalRow(rows, { name: "Desconocido" }), null);
});

test("solo hay posición para los partidos de liga de esta temporada sin jugar", () => {
  const ranks = matchRanks(rows, "176726", [
    m("a", { name: "x", ext_id: "futormes:10" }),
    m("b", { name: "x", ext_id: "futormes:10" }, { status: "played" }),
    m("c", { name: "x", ext_id: "futormes:10" }, { competition: "friendly" }),
    m("d", { name: "x", ext_id: "futormes:10" }, { season: "2025/26" }),
    m("e", { name: "x", ext_id: "futormes:30" }, { status: "postponed" }),
  ], "2026/27");
  assert.deepEqual([...ranks.keys()], ["a", "e"]);
  const a = ranks.get("a")!;
  assert.equal(a.rival?.pos, 1);
  assert.equal(a.rival?.points, 16);
  assert.equal(a.rival?.total, 4);
  assert.equal(a.us?.pos, 2);
});

test("la diferencia de puntos se cuenta desde nuestro lado", () => {
  const r = matchRanks(rows, "176726", [m("a", { name: "", ext_id: "futormes:10" }), m("b", { name: "", ext_id: "futormes:30" }), m("c", { name: "", ext_id: "futormes:40" })], "2026/27");
  assert.equal(gapLabel(r.get("a")!.us, r.get("a")!.rival), "Nos sacan 3 puntos");
  assert.equal(gapLabel(r.get("b")!.us, r.get("b")!.rival), "Empatados a puntos");
  assert.equal(gapLabel(r.get("c")!.us, r.get("c")!.rival), "Les sacamos 6 puntos");
});
