import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../safe-next.ts";

test("después de entrar solo se va a páginas de la propia app", () => {
  assert.equal(safeNext("/partidos"), "/partidos");
  assert.equal(safeNext("/loteria/abc?x=1#y"), "/loteria/abc?x=1#y");
  assert.equal(safeNext("/"), "/");
});

test("los enlaces que llevarían a otra web se cambian por el inicio", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/a b", "/a\\b", "", null, undefined, 5]) {
    assert.equal(safeNext(bad), "/", String(bad));
  }
  assert.equal(safeNext("//evil.com", "/perfil"), "/perfil");
});
