import { test } from "node:test";
import assert from "node:assert/strict";
import { goalCall, speakable } from "../commentator.ts";

const first = () => 0;
const texts = (c: Parameters<typeof goalCall>[0]) => goalCall(c, first).map((l) => l.text);

test("los nombres en mayúsculas se pasan a minúsculas para que la voz no los deletree", () => {
  assert.equal(speakable("CÁDIZ C.F."), "Cádiz C.F.");
  assert.equal(speakable("UNIÓN  DEPORTIVA"), "Unión Deportiva");
  assert.equal(speakable("Pepe"), "Pepe");
  assert.equal(speakable("McGregor"), "McGregor");
  assert.equal(speakable("J"), "J");
});

test("gol con autor y asistencia, el Rayo se adelanta", () => {
  assert.deepEqual(texts({ scorer: "Chino", assist: "Rubio", goalsToday: 1, gf: 1, ga: 0, rival: "Cádiz" }), [
    "¡Gol, gol, gol, gooooool!", "¡Gol del Rayo!", "¡Gol de Chino!", "Asistencia de Rubio.", "¡El Rayo se adelanta!", "Rayo 1, Cádiz 0.",
  ]);
});

test("empate, segundo gol y triplete", () => {
  assert.ok(texts({ scorer: "Chino", assist: null, goalsToday: 2, gf: 1, ga: 1, rival: null }).includes("¡Empata el Rayo!"));
  assert.ok(texts({ scorer: "Chino", assist: null, goalsToday: 2, gf: 1, ga: 1, rival: null }).includes("¡Su segundo gol del partido!"));
  assert.ok(texts({ scorer: "Chino", assist: null, goalsToday: 3, gf: 3, ga: 0, rival: null }).includes("¡Triplete de Chino!"));
  assert.ok(texts({ scorer: "Chino", assist: null, goalsToday: 4, gf: 4, ga: 0, rival: null }).includes("¡Ya lleva 4 goles hoy!"));
  assert.ok(texts({ scorer: "Chino", assist: null, goalsToday: 1, gf: 2, ga: 1, rival: "X" }).includes("¡El Rayo se pone por delante!"));
});

test("sin autor (en propia o sin apuntar) no dice nombre", () => {
  const t = texts({ scorer: null, assist: "Rubio", goalsToday: 0, gf: 3, ga: 0, rival: "ATLÉTICO" });
  assert.deepEqual(t, ["¡Gol, gol, gol, gooooool!", "¡Gol del Rayo!", "Rayo 3, Atlético 0."]);
});

test("se gritan más agudas las primeras frases", () => {
  const l = goalCall({ scorer: "Chino", assist: null, goalsToday: 1, gf: 3, ga: 0, rival: null }, first);
  assert.ok(l[0].pitch > l.at(-1)!.pitch);
});
