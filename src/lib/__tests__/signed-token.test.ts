import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LIFETIME_MS, readToken, signToken } from "../signed-token.ts";

const KEY = "clave-de-prueba";
const MATCH = "3ce3ae4b-ad87-4b87-b5ed-9d26b00365fb";
const USER = "91724116-3fb8-4a95-99f0-283a9c211154";
const OTHER = "a6d0c3cd-ae94-42f6-bf82-8c556cb25cdd";
const exp = new Date("2026-11-15T23:59:59Z");
const issued = new Date("2026-11-14T09:00:00Z").getTime();
const before = new Date("2026-11-14T10:00:00Z").getTime();
const tok = (purpose: "callup" | "poll" = "callup", e = exp, now = issued) => signToken(KEY, purpose, MATCH, USER, e, now);

test("un token recién firmado se lee y devuelve su asunto, su usuario y cuándo se emitió", () => {
  assert.deepEqual(readToken(KEY, "callup", tok(), before), { subjectId: MATCH, userId: USER, issuedAt: issued });
});

test("un token caducado no vale", () => {
  const t = tok();
  assert.equal(readToken(KEY, "callup", t, exp.getTime() + 1000), null);
  assert.notEqual(readToken(KEY, "callup", t, exp.getTime() - 1000), null);
});

test("un token de convocatoria no sirve para una votación ni al revés", () => {
  assert.equal(readToken(KEY, "poll", tok("callup"), before), null);
  assert.equal(readToken(KEY, "callup", tok("poll"), before), null);
  assert.notEqual(readToken(KEY, "poll", tok("poll"), before), null);
});

test("ningún token vive más de 15 días aunque el asunto esté más lejos", () => {
  const far = new Date(issued + 60 * 24 * 3600 * 1000);
  const t = tok("callup", far);
  assert.notEqual(readToken(KEY, "callup", t, issued + MAX_LIFETIME_MS - 1000), null);
  assert.equal(readToken(KEY, "callup", t, issued + MAX_LIFETIME_MS + 1000), null);
});

test("no se puede cambiar ninguna parte sin romper la firma", () => {
  const p = tok().split(".");
  const swap = (i: number, v: string) => p.map((x, j) => (j === i ? v : x)).join(".");
  assert.equal(readToken(KEY, "callup", swap(3, OTHER), before), null); // otro usuario
  assert.equal(readToken(KEY, "callup", swap(2, OTHER), before), null); // otro partido
  assert.equal(readToken(KEY, "callup", swap(5, String(Number(p[5]) + 86400)), before), null); // más caducidad
  assert.equal(readToken(KEY, "callup", swap(4, String(issued + 3600_000)), before), null); // otra fecha de emisión
  assert.equal(readToken(KEY, "poll", swap(1, "poll"), before), null); // otro uso
});

test("un token firmado con otra clave no vale", () => {
  assert.equal(readToken("otra-clave", "callup", tok(), before), null);
});

test("los tokens antiguos (sin uso ni fecha de emisión) ya no valen", () => {
  assert.equal(readToken(KEY, "callup", `${MATCH}.${USER}.${Math.floor(exp.getTime() / 1000)}.firma`, before), null);
});

test("lo que no tiene forma de token se rechaza sin romper nada", () => {
  for (const bad of ["", "a.b.c", "a.b.c.d", `v2.callup.${MATCH}.${USER}.abc.123.firma`, `v2.callup.${MATCH}.${USER}.1.123.`, `v2.otro.${MATCH}.${USER}.1.123.firma`, `v3.callup.${MATCH}.${USER}.1.123.firma`]) {
    assert.equal(readToken(KEY, "callup", bad, before), null, bad);
  }
  assert.equal(readToken(KEY, "callup", undefined as unknown as string, before), null);
});
