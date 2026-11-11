import { test } from "node:test";
import assert from "node:assert/strict";
import { readToken, signToken } from "../signed-token.ts";

const KEY = "clave-de-prueba";
const MATCH = "3ce3ae4b-ad87-4b87-b5ed-9d26b00365fb";
const USER = "91724116-3fb8-4a95-99f0-283a9c211154";
const OTHER = "a6d0c3cd-ae94-42f6-bf82-8c556cb25cdd";
const exp = new Date("2026-11-15T23:59:59Z");
const before = new Date("2026-11-14T10:00:00Z").getTime();

test("un token recién firmado se lee y devuelve su partido y su usuario", () => {
  const t = signToken(KEY, MATCH, USER, exp);
  assert.deepEqual(readToken(KEY, t, before), { subjectId: MATCH, userId: USER });
});

test("un token caducado no vale", () => {
  const t = signToken(KEY, MATCH, USER, exp);
  assert.equal(readToken(KEY, t, exp.getTime() + 1000), null);
  assert.notEqual(readToken(KEY, t, exp.getTime() - 1000), null);
});

test("no se puede cambiar el usuario, el asunto ni la caducidad sin romper la firma", () => {
  const t = signToken(KEY, MATCH, USER, exp);
  const [m, u, e, sig] = t.split(".");
  assert.equal(readToken(KEY, [m, OTHER, e, sig].join("."), before), null);
  assert.equal(readToken(KEY, [OTHER, u, e, sig].join("."), before), null);
  assert.equal(readToken(KEY, [m, u, String(Number(e) + 86400), sig].join("."), before), null);
});

test("un token firmado con otra clave no vale", () => {
  assert.equal(readToken("otra-clave", signToken(KEY, MATCH, USER, exp), before), null);
});

test("lo que no tiene forma de token se rechaza sin romper nada", () => {
  for (const bad of ["", "a.b.c", "a.b.c.d", `${MATCH}.${USER}.abc.firma`, `${MATCH}.${USER}.123`, `x.${USER}.123.firma`, `${MATCH}.${USER}.123.`]) {
    assert.equal(readToken(KEY, bad, before), null, bad);
  }
  assert.equal(readToken(KEY, undefined as unknown as string, before), null);
});
