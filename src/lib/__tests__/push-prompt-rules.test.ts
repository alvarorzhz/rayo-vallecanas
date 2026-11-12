import { test } from "node:test";
import assert from "node:assert/strict";
import { promptDecision } from "../push-prompt-rules.ts";

const base = { supported: true, permission: "default" as NotificationPermission, ios: false, standalone: false, lastAt: 0, times: 0, now: Date.UTC(2026, 10, 12) };
const day = 864e5;

test("pide activar los avisos a quien no los tiene", () => {
  assert.equal(promptDecision(base), "ask");
});

test("con permiso concedido no sale nunca", () => {
  assert.equal(promptDecision({ ...base, permission: "granted" }), null);
});

test("tras «Ahora no» descansa 30 días", () => {
  assert.equal(promptDecision({ ...base, lastAt: base.now - 10 * day, times: 1 }), null);
  assert.equal(promptDecision({ ...base, lastAt: base.now - 31 * day, times: 1 }), "ask");
});

test("tras dos «Ahora no» ya no vuelve", () => {
  assert.equal(promptDecision({ ...base, lastAt: base.now - 400 * day, times: 2 }), null);
});

test("bloqueados: se explica una sola vez", () => {
  assert.equal(promptDecision({ ...base, permission: "denied" }), "denied");
  assert.equal(promptDecision({ ...base, permission: "denied", lastAt: base.now - 60 * day, times: 1 }), null);
});

test("iPhone sin instalar: explica cómo instalarla", () => {
  assert.equal(promptDecision({ ...base, supported: false, permission: null, ios: true }), "ios");
  assert.equal(promptDecision({ ...base, supported: false, permission: null, ios: true, standalone: true }), null);
  assert.equal(promptDecision({ ...base, supported: false, permission: null }), null);
});
