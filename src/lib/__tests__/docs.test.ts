import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** 4.31.6 · La documentación técnica no se queda atrás: cada migración, tabla y variable de entorno está apuntada. */
const root = join(import.meta.dirname, "../../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();

test("cada migración está en el registro de cambios de la base de datos", () => {
  const log = read("docs/cambios-base-de-datos.md");
  const missing = migrations.filter((f) => !log.includes(`\`${f}\``));
  assert.deepEqual(missing, [], `Apunta en docs/cambios-base-de-datos.md: ${missing.join(", ")}`);
});

test("cada tabla de las migraciones sale en docs/base-de-datos.md", () => {
  const doc = read("docs/base-de-datos.md");
  const tables = new Set<string>();
  for (const f of migrations) for (const m of read(`supabase/migrations/${f}`).matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)) tables.add(m[1]);
  const missing = [...tables].filter((t) => !new RegExp(`\\b${t}\\b`).test(doc));
  assert.deepEqual(missing, [], `Explica en docs/base-de-datos.md: ${missing.join(", ")}`);
});

test("cada variable de entorno que usa el código está en docs/variables-de-entorno.md", () => {
  const doc = read("docs/variables-de-entorno.md");
  const vars = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const p = `${dir}/${name}`;
      if (statSync(join(root, p)).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(name)) for (const m of read(p).matchAll(/process\.env\.([A-Z0-9_]+)/g)) vars.add(m[1]);
    }
  };
  for (const d of ["src", "scripts", "e2e", "tests"]) walk(d);
  const missing = [...vars].filter((v) => !doc.includes(`\`${v}\``));
  assert.deepEqual(missing, [], `Explica en docs/variables-de-entorno.md: ${missing.join(", ")}`);
  assert.ok(vars.size > 10);
});
