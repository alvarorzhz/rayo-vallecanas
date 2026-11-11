import { test } from "node:test";
import assert from "node:assert/strict";
import { allows, blocked, isUuid, profileKey, EDITABLE_MODULES, PLAYER_BLOCKED } from "../roles.ts";

const all = { read: true, create: true, update: true, delete: true };

test("el superadministrador puede con todo, también con la auditoría", () => {
  const def = { base: "superadmin" as const, perms: {} };
  for (const m of [...EDITABLE_MODULES, "audit"]) assert.equal(allows(def, m, "delete"), true, m);
});

test("la auditoría es solo del superadministrador aunque el perfil la tenga marcada", () => {
  assert.equal(allows({ base: "admin", perms: { audit: all } }, "audit", "read"), false);
  assert.equal(allows({ base: "player", perms: { audit: all } }, "audit", "read"), false);
});

test("un jugador nunca ve Finanzas, patrocinios ni datos personales, ni con permiso a medida", () => {
  const def = { base: "player" as const, perms: Object.fromEntries(EDITABLE_MODULES.map((m) => [m, all])) };
  for (const m of PLAYER_BLOCKED) {
    assert.equal(blocked("player", m), true);
    assert.equal(allows(def, m, "read"), false, m);
  }
  assert.equal(allows(def, "matches", "read"), true);
  assert.equal(blocked("admin", "finances"), false);
});

test("un gestor puede solo lo que tiene marcado, acción por acción", () => {
  const def = { base: "admin" as const, perms: { finances: { read: true, create: true }, squad: { read: true } } };
  assert.equal(allows(def, "finances", "read"), true);
  assert.equal(allows(def, "finances", "create"), true);
  assert.equal(allows(def, "finances", "delete"), false);
  assert.equal(allows(def, "squad", "update"), false);
  assert.equal(allows(def, "matches", "read"), false);
});

test("identificadores y clave de perfil", () => {
  assert.equal(isUuid("91724116-3fb8-4a95-99f0-283a9c211154"), true);
  assert.equal(isUuid("91724116-3fb8-4a95-99f0"), false);
  assert.equal(isUuid("admin"), false);
  assert.equal(profileKey({ role: "admin" }), "admin");
  assert.equal(profileKey({ role: "admin", custom_role_id: "abc" }), "abc");
});
