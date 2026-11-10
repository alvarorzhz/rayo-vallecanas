import { test } from "node:test";
import assert from "node:assert/strict";
import { gapLabel, matchRanks, perGame, rivalRow, stakes, teamGames } from "../standings.ts";
import { parseCalendar, parseTable } from "../league-parse.ts";
import { readFileSync } from "node:fs";
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

const page = (name: string) => readFileSync(new URL(`./fixtures/futormes/${name}.html`, import.meta.url), "utf8");

test("los últimos partidos de cada equipo salen del calendario, el más reciente primero", () => {
  const { byTeam, round } = teamGames(parseCalendar(page("calendar")));
  assert.ok(round);
  const table = parseTable(page("table"));
  for (const r of table) {
    const t = byTeam.get(r.teamId);
    if (!r.played) continue;
    assert.ok(t, `sin partidos para ${r.name}`);
    assert.ok(t.last.length <= 3 && t.form.length <= 5);
    assert.ok(t.last.every((g, i) => i === 0 || g.date <= t.last[i - 1].date));
    // La racha acaba con el último partido
    assert.equal(t.form.at(-1), t.last[0].outcome);
  }
});

test("goles por partido con coma decimal", () => {
  assert.equal(perGame(15, 7), "2,1");
  assert.equal(perGame(0, 0), "0");
});

const zone = (label: string, color = "#000") => ({ label, color });
const z = (rows: StandingRow[], top: number, bottomFrom: number) =>
  rows.map((r) => ({ ...r, zone: r.pos <= top ? zone("Ascenso") : r.pos >= bottomFrom ? zone("Descenso") : null }));
const T = (pts: number[]) => z(pts.map((p, i) => row(i + 1, String(i + 1), `Equipo ${i + 1}`, p)), 2, 7);

test("qué nos jugamos: una frase según la tabla", () => {
  const rows = T([20, 18, 15, 13, 12, 10, 9, 8]);
  // Líderes que siguen líderes
  assert.equal(stakes(rows, "1", rows[1], "B"), "Si ganamos, seguimos líderes");
  // En descenso (7º, 9 pts): con 12 podemos salir
  assert.equal(stakes(rows, "7", rows[0], "A"), "Una victoria nos puede sacar del descenso");
  // 3º a 3 del 2º: entramos en zona de ascenso
  assert.equal(stakes(rows, "3", rows[7], "H"), "Una victoria nos puede meter en zona de ascenso");
  // 5º (12) contra el 4º (13): le adelantamos
  assert.equal(stakes(T([30, 28, 26, 13, 12, 10, 9, 8]), "5", rows[3], "D"), "Si ganamos, adelantamos a D");
  // 5º (12) contra el último: subimos de puesto
  assert.equal(stakes(T([30, 28, 26, 13, 12, 10, 9, 8]), "5", rows[7], "H"), "Si ganamos, podemos subir al 4º");
});
