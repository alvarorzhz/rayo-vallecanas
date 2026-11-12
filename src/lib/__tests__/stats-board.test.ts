import { test } from "node:test";
import assert from "node:assert/strict";
import { appsLine, assistsLine, goalsLine, joinNames, pct, rankBy } from "../stats-board.ts";

const p = (name: string, n: number, dorsal: number) => ({ name, n, dorsal });

test("los empatados comparten puesto y se quitan los ceros", () => {
  const r = rankBy([p("A", 1, 9), p("B", 3, 7), p("C", 1, 4), p("D", 0, 2), p("E", 2, 1)], (x) => x.n, { tie: (a, b) => a.dorsal - b.dorsal });
  assert.deepEqual(r.map((x) => [x.row.name, x.pos]), [["B", 1], ["E", 2], ["C", 3], ["A", 3]]);
});

test("en orden ascendente (Zamora) gana el valor más bajo y cuentan los ceros", () => {
  const r = rankBy([p("A", 2.5, 1), p("B", 0, 13)], (x) => x.n, { asc: true });
  assert.deepEqual(r.map((x) => x.row.name), ["B", "A"]);
});

test("se corta en el límite", () => {
  const r = rankBy([1, 2, 3, 4, 5, 6, 7].map((n) => p(String(n), n, n)), (x) => x.n, { limit: 3 });
  assert.equal(r.length, 3);
  assert.equal(r[0].row.name, "7");
});

test("frases del cuadro de honor", () => {
  assert.equal(pct(7, 11), 64);
  assert.equal(pct(12, 11), 100);
  assert.equal(goalsLine(7, 11), "El 64 % de los goles del Rayo esta temporada");
  assert.equal(goalsLine(3, 3), "Ha marcado todos los goles del Rayo esta temporada");
  assert.equal(goalsLine(9, 4), null); // con goles previos apuntados a mano no tiene sentido
  assert.equal(assistsLine(2, 11), "Ha dado el pase en 2 de los 11 goles del equipo");
  assert.equal(appsLine(5, 5), "de 5 · no ha faltado a ninguno");
  assert.equal(appsLine(3, 5), "de 5 partidos");
  assert.equal(joinNames(["Eisiel", "Samu", "Iván"]), "Eisiel, Samu y Iván");
  assert.equal(joinNames(["Eisiel"]), "Eisiel");
});
