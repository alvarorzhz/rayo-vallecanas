import { test } from "node:test";
import assert from "node:assert/strict";
import { callupClosed, callupRecord, callupVsReport, isFormation, slotsOf, sortCallups, tally, FORMATIONS, type Reply } from "../callups.ts";
import type { Player } from "../squad.ts";

test("cada dibujo de fútbol 7 tiene portero y seis jugadores de campo", () => {
  for (const f of FORMATIONS) {
    const slots = slotsOf(f);
    assert.equal(slots.length, 7, f);
    assert.deepEqual(slots.map((s) => s.slot), [1, 2, 3, 4, 5, 6, 7], f);
    assert.equal(slots[0].line, "GK");
    assert.equal(slots.filter((s) => s.line !== "GK").length, f.split("-").reduce((a, x) => a + Number(x), 0), f);
    for (const s of slots) assert.ok(s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100, `${f} hueco ${s.slot}`);
  }
});

test("un dibujo desconocido usa el habitual", () => {
  assert.deepEqual(slotsOf("4-4-2"), slotsOf("3-2-1"));
  assert.deepEqual(slotsOf(null), slotsOf("3-2-1"));
  assert.equal(isFormation("2-3-1"), true);
  assert.equal(isFormation("4-4-2"), false);
  assert.equal(isFormation(null), false);
});

test("el recuento de respuestas", () => {
  const rows = (["yes", "yes", "maybe", "no", "pending", "pending", "pending"] as Reply[]).map((reply) => ({ reply }));
  assert.deepEqual(tally(rows), { yes: 2, maybe: 1, no: 1, pending: 3, total: 7 });
  assert.deepEqual(tally([]), { yes: 0, maybe: 0, no: 0, pending: 0, total: 0 });
});

test("la convocatoria se ordena de portero a delantero y por dorsal", () => {
  const row = (position: string, number: number | null, nickname: string) => ({ position, number, player: { first_name: "X", last_name: "Y", nickname } as Player });
  const out = sortCallups([row("DC", 9, "Fuentes"), row("POR", 1, "Martín"), row("MCO", 10, "Dani"), row("DFC", 4, "Castro"), row("MCO", null, "Nuevo")]);
  assert.deepEqual(out.map((r) => r.player.nickname), ["Martín", "Castro", "Dani", "Nuevo", "Fuentes"]);
});

test("la convocatoria se cruza con el acta: quién cumplió y quién jugó sin estar", () => {
  const rows = [{ player_id: "a", reply: "yes" as Reply }, { player_id: "b", reply: "yes" as Reply }, { player_id: "c", reply: "no" as Reply }, { player_id: "d", reply: "maybe" as Reply }];
  const apps = [{ player_id: "a", started: true }, { player_id: "d", started: false }, { player_id: "z", started: false }];
  const r = callupVsReport(rows, apps);
  assert.equal(r.attendance("a"), "started");
  assert.equal(r.attendance("d"), "sub");
  assert.equal(r.attendance("b"), "absent");
  assert.equal(r.saidYes, 2);
  assert.equal(r.keptWord, 1);
  assert.equal(r.playedCalled, 2);
  assert.deepEqual(r.extras.map((e) => e.player_id), ["z"]);
});

test("sin acta todavía no se puede saber quién jugó", () => {
  const r = callupVsReport([{ player_id: "a", reply: "yes" as Reply }], null);
  assert.equal(r.attendance("a"), null);
  assert.equal(r.keptWord, null);
  assert.equal(r.playedCalled, null);
  assert.deepEqual(r.extras, []);
  assert.equal(r.saidYes, 1);
});

test("el historial de un jugador cuenta respuestas y partidos jugados", () => {
  const r = callupRecord([{ reply: "yes", played: true }, { reply: "yes", played: false }, { reply: "no", played: false }, { reply: "pending", played: null }]);
  assert.deepEqual(r, { called: 4, yes: 2, maybe: 0, no: 1, pending: 1, played: 1, withReport: 3 });
});

test("la convocatoria se cierra cuando el partido se juega o se cancela", () => {
  assert.equal(callupClosed({ status: "played" }), true);
  assert.equal(callupClosed({ status: "cancelled" }), true);
  assert.equal(callupClosed({ status: "scheduled" }), false);
  assert.equal(callupClosed({ status: "postponed" }), false);
});
