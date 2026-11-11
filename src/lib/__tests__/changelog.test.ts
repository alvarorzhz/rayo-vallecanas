import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_VERSION, CHANGELOG, releaseToAnnounce, type Release } from "../changelog.ts";

const r = (version: string, quiet = false): Release => ({ version, date: "2026-01-01", title: version, changes: ["x"], quiet });

test("el registro de versiones está en orden y sin repetidos", () => {
  const num = (v: string) => v.split(".").map(Number).reduce((a, n) => a * 1000 + n, 0);
  for (const rel of CHANGELOG) {
    assert.match(rel.version, /^\d+\.\d+\.\d+$/);
    assert.match(rel.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(rel.title.trim() && rel.changes.length > 0, rel.version);
  }
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.ok(num(CHANGELOG[i - 1].version) > num(CHANGELOG[i].version), `${CHANGELOG[i - 1].version} debe ir después de ${CHANGELOG[i].version}`);
    assert.ok(CHANGELOG[i - 1].date >= CHANGELOG[i].date, `la fecha de ${CHANGELOG[i - 1].version} es anterior a la de ${CHANGELOG[i].version}`);
  }
  assert.equal(APP_VERSION, CHANGELOG[0].version);
});

test("quien está al día no ve ningún aviso", () => {
  assert.equal(releaseToAnnounce("3.0.0", [r("3.0.0"), r("2.0.0")]), null);
});

test("se anuncia la versión nueva", () => {
  assert.equal(releaseToAnnounce("2.0.0", [r("3.0.0"), r("2.0.0")])?.version, "3.0.0");
});

test("una versión silenciosa no tapa el aviso de la anterior que aún no se había visto", () => {
  const log = [r("3.2.0", true), r("3.1.0"), r("3.0.0")];
  assert.equal(releaseToAnnounce("3.0.0", log)?.version, "3.1.0");
  // Si ya vio la 3.1.0, la silenciosa no enseña nada
  assert.equal(releaseToAnnounce("3.1.0", log), null);
});

test("si faltan varias, se anuncia la más reciente", () => {
  assert.equal(releaseToAnnounce("1.0.0", [r("3.0.0"), r("2.0.0"), r("1.0.0")])?.version, "3.0.0");
});

test("sin versión guardada o con una desconocida se anuncia la última con novedades", () => {
  const log = [r("3.2.0", true), r("3.1.0"), r("3.0.0")];
  assert.equal(releaseToAnnounce(null, log)?.version, "3.1.0");
  assert.equal(releaseToAnnounce("0.0.1", log)?.version, "3.1.0");
  assert.equal(releaseToAnnounce(null, [r("1.0.0", true)]), null);
  assert.equal(releaseToAnnounce(null, []), null);
});
