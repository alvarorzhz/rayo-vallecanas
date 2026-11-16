/**
 * Jugadores nuevos en la liga (v4.17.0): a quién se reconoce, quién sale en la lista,
 * de quién se avisa y cómo se escribe el aviso.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePlayer, type LeaguePlayer } from "../league-parse.ts";
import { isIgnored, matchPlayer, mergeNewcomers, newcomersText, splitName, storedNewcomers, type Newcomer } from "../newcomers.ts";

const lp = (extId: string, name: string, number: number | null = null): LeaguePlayer => ({
  extId, name, number, nickname: null, line: "DFC", foot: null, birth: null, height: null, apps: 2, goals: 1, conceded: 0, yellows: 0, reds: 0,
});
const players = [
  { id: "a", first_name: "Rubén", last_name: "López García", ext_id: "futormes:100" },
  { id: "b", first_name: "Dani", last_name: "Pérez", ext_id: null },
  { id: "c", first_name: "Javier", last_name: "Martín Sanz", ext_id: null },
];
const numbers = new Map<string, number | null>([["a", 4], ["b", 5], ["c", 11]]);

describe("reconocer a un jugador de la liga en la app", () => {
  test("por su número en la liga, por el nombre (sin tildes ni mayúsculas) o por dorsal + nombre de pila", () => {
    assert.equal(matchPlayer(players, numbers, lp("100", "Otro Nombre"))?.id, "a");
    assert.equal(matchPlayer(players, numbers, lp("200", "RUBEN LOPEZ GARCIA"))?.id, "a");
    // En la app solo tiene un apellido: vale si el nombre de la liga empieza igual
    assert.equal(matchPlayer(players, numbers, lp("201", "Dani Pérez Gómez"))?.id, "b");
    assert.equal(matchPlayer(players, numbers, lp("202", "Javier Martin Ruiz", 11))?.id, "c");
  });
  test("un nombre que no está, o el mismo dorsal con otro nombre de pila, es nuevo", () => {
    assert.equal(matchPlayer(players, numbers, lp("300", "Carlos Gómez Ruiz", 14)), undefined);
    assert.equal(matchPlayer(players, numbers, lp("301", "Pedro Martín Ruiz", 11)), undefined);
    assert.equal(matchPlayer(players, numbers, lp("302", "Carlos Sin Dorsal", null)), undefined);
  });
  test("nombre y apellidos: las dos últimas palabras son los apellidos", () => {
    assert.deepEqual(splitName("Carlos Gómez Ruiz"), { first_name: "Carlos", last_name: "Gómez Ruiz" });
    assert.deepEqual(splitName("Juan Carlos Gómez Ruiz"), { first_name: "Juan Carlos", last_name: "Gómez Ruiz" });
    assert.deepEqual(splitName("Carlos  Gómez"), { first_name: "Carlos", last_name: "Gómez" });
    assert.deepEqual(splitName("Carlos"), { first_name: "Carlos", last_name: "" });
  });
  test("la ficha real de futormes trae lo necesario para la lista", () => {
    const p = parsePlayer("999", readFileSync(new URL("./fixtures/futormes/player.html", import.meta.url), "utf8"));
    assert.ok(p && p.name.length > 3 && /^(POR|DFC|MCD|DC)$/.test(p.line));
  });
});

describe("lista de nuevos en la liga", () => {
  const now = "2026-11-16T09:00:00.000Z";
  const carlos = { ...lp("300", "Carlos Gómez Ruiz", 14), playerId: null };
  const javi = { ...lp("301", "Javi Martín Gil", 9), playerId: "old" };

  test("la primera vez todos son nuevos y se avisa de todos, ordenados por dorsal", () => {
    const r = mergeNewcomers({ missing: [carlos, javi], prev: [], ignored: [], now });
    assert.deepEqual(r.list.map((n) => n.extId), ["301", "300"]);
    assert.equal(r.fresh.length, 2);
    assert.equal(r.list[0].seenAt, now);
  });
  test("al volver a mirar no se avisa otra vez y se conserva desde cuándo está", () => {
    const prev: Newcomer[] = [{ ...carlos, seenAt: "2026-11-10T09:00:00.000Z" }];
    const r = mergeNewcomers({ missing: [carlos, javi], prev, ignored: [], now });
    assert.deepEqual(r.fresh.map((n) => n.extId), ["301"]);
    assert.equal(r.list.find((n) => n.extId === "300")?.seenAt, "2026-11-10T09:00:00.000Z");
  });
  test("si la liga le cambia el número (otra competición) sigue siendo el mismo", () => {
    const prev: Newcomer[] = [{ ...carlos, seenAt: "2026-11-10T09:00:00.000Z" }];
    const r = mergeNewcomers({ missing: [{ ...carlos, extId: "777" }], prev, ignored: [], now });
    assert.equal(r.fresh.length, 0);
    assert.equal(r.list[0].extId, "777");
  });
  test("quien ya se ha fichado a mano sale de la lista; los ignorados no vuelven", () => {
    const prev: Newcomer[] = [{ ...carlos, seenAt: now }, { ...javi, seenAt: now }];
    assert.deepEqual(mergeNewcomers({ missing: [javi], prev, ignored: [], now }).list.map((n) => n.extId), ["301"]);
    const ignored = [{ ext: "999", name: "CARLOS GOMEZ RUIZ" }];
    assert.ok(isIgnored(ignored, carlos));
    assert.deepEqual(mergeNewcomers({ missing: [carlos, javi], prev: [], ignored, now }).list.map((n) => n.extId), ["301"]);
  });
  test("lo guardado se lee aunque venga vacío o roto", () => {
    assert.deepEqual(storedNewcomers(null), { newcomers: [], ignored: [] });
    assert.deepEqual(storedNewcomers({ newcomers: "x", ignoredPlayers: [null, { ext: "1", name: "A" }] }), { newcomers: [], ignored: [{ ext: "1", name: "A" }] });
  });
});

describe("texto del aviso", () => {
  test("uno, con dorsal; varios, con nombres cortos", () => {
    assert.deepEqual(newcomersText([lp("1", "Carlos Gómez Ruiz", 14)]), {
      title: "🆕 Jugador nuevo en la liga",
      body: "Carlos Gómez (dorsal 14) está en la plantilla de futormes y no en la app. Toca para revisarlo.",
    });
    assert.equal(newcomersText([lp("1", "Carlos Gómez Ruiz"), lp("2", "Javi Martín Gil")]).body, "Carlos Gómez y Javi Martín están en futormes y no en la app. Toca para revisarlos.");
    const five = ["Ana Uno Dos", "Bea Tres Cuatro", "Ciro Cinco Seis", "Dani Siete Ocho", "Eva Nueve Diez"].map((n, i) => lp(String(i), n));
    assert.equal(newcomersText(five).title, "🆕 5 jugadores nuevos en la liga");
    assert.match(newcomersText(five).body, /^Ana Uno, Bea Tres, Ciro Cinco y 2 más están/);
  });
});
