import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_SKIPPED, BACKUP_TABLES } from "../backup-tables.ts";

test("la copia de seguridad lleva todas las tablas de las migraciones", () => {
  const dir = join(import.meta.dirname, "../../../supabase/migrations");
  const tables = new Set<string>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    for (const m of readFileSync(join(dir, f), "utf8").matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)) tables.add(m[1]);
  }
  const covered = new Set([...BACKUP_TABLES.map(([t]) => t), ...BACKUP_SKIPPED]);
  const missing = [...tables].filter((t) => !covered.has(t));
  assert.deepEqual(missing, [], `Faltan en src/lib/backup-tables.ts: ${missing.join(", ")}`);
  assert.ok(tables.size > 40);
});

test("las hojas del Excel no pasan de 31 letras ni se repiten", () => {
  const labels = BACKUP_TABLES.map(([, l]) => l.slice(0, 31));
  assert.equal(new Set(labels).size, labels.length);
});
