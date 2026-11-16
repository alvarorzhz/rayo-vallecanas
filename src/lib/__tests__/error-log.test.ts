import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMessage, cleanPath, isNoise, kindOf } from "../error-log.ts";

test("el 418 de React cuenta como repintado; lo demás como fallo de JavaScript", () => {
  assert.equal(kindOf("Minified React error #418; visit https://react.dev/errors/418?args[]=text"), "repintado");
  assert.equal(kindOf("Hydration failed because the server rendered HTML didn't match the client."), "repintado");
  assert.equal(kindOf("Cannot read properties of undefined (reading 'name')"), "js");
  assert.equal(kindOf("Minified React error #4180"), "js");
});

test("el ruido no se apunta", () => {
  assert.ok(isNoise("Script error."));
  assert.ok(isNoise("ResizeObserver loop completed with undelivered notifications."));
  assert.ok(isNoise("TypeError: Failed to fetch"));
  assert.ok(isNoise("Load failed"));
  assert.ok(isNoise("ChunkLoadError: Loading chunk 123 failed."));
  assert.ok(isNoise("x is undefined", "chrome-extension://abc/content.js"));
  assert.ok(isNoise("   "));
  assert.ok(!isNoise("TypeError: x is undefined", "https://rayo-vallecanas.vercel.app/_next/static/chunks/a.js"));
  assert.ok(!isNoise("Minified React error #418"));
});

test("el texto se limpia y se acorta", () => {
  assert.equal(cleanMessage("Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message"), "Minified React error #418 for the full message");
  assert.equal(cleanMessage("a\n   b"), "a b");
  assert.equal(cleanMessage("x".repeat(500)).length, 400);
});

test("las fichas de distintos jugadores cuentan como la misma pantalla", () => {
  assert.equal(cleanPath("/plantilla/3f2b6c1e-1234-4abc-9def-0123456789ab?tab=1"), "/plantilla/…");
  assert.equal(cleanPath(""), "/");
  assert.equal(cleanPath("/partidos#acta"), "/partidos");
});

test("el mismo fallo de varias personas se junta, y los de pantalla de error van primero", async () => {
  const { groupErrors } = await import("../error-log.ts");
  const base = { path: "/", digest: null, device: "movil", day: "2026-11-16" };
  const g = groupErrors([
    { ...base, user_id: "a", sig: "r", kind: "repintado", message: "418", version: "4.19.0", hits: 3, last_at: "2026-11-16T10:00:00Z" },
    { ...base, user_id: "b", sig: "r", kind: "repintado", message: "418", version: "4.18.3", hits: 1, last_at: "2026-11-16T12:00:00Z" },
    { ...base, user_id: "a", sig: "p", kind: "pantalla", message: "boom", version: "4.19.0", hits: 1, last_at: "2026-11-15T09:00:00Z", digest: "123" },
  ]);
  assert.deepEqual(g.map((x) => x.sig), ["p", "r"]);
  assert.equal(g[1].hits, 4);
  assert.deepEqual(g[1].people, ["a", "b"]);
  assert.deepEqual(g[1].versions, ["4.19.0", "4.18.3"]);
  assert.equal(g[1].last_at, "2026-11-16T12:00:00Z");
});
