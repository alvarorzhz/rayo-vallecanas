import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkCron, cronDenied } from "../cron.ts";

const req = (auth?: string) =>
  new Request("https://rayo.test/api/cron/copia", auth === undefined ? {} : { headers: { authorization: auth } });

test("sin CRON_SECRET no se ejecuta ninguna tarea, ni con cabecera ni sin ella", () => {
  for (const secret of [undefined, "", "   ", "\n"]) {
    for (const auth of [null, "", "Bearer ", "Bearer undefined", "Bearer   ", "cualquier cosa"]) {
      const r = checkCron(secret, auth);
      assert.equal(r.ok, false, `secreto ${JSON.stringify(secret)} con cabecera ${JSON.stringify(auth)}`);
      if (!r.ok) assert.equal(r.status, 503);
    }
  }
});

test("con CRON_SECRET solo pasa la cabecera exacta", () => {
  assert.deepEqual(checkCron("s3cr3t", "Bearer s3cr3t"), { ok: true });
  for (const auth of [null, "", "s3cr3t", "Bearer s3cr3", "Bearer s3cr3tt", "bearer s3cr3t", "Bearer  s3cr3t", "Basic s3cr3t"]) {
    const r = checkCron("s3cr3t", auth);
    assert.equal(r.ok, false, JSON.stringify(auth));
    if (!r.ok) assert.equal(r.status, 401);
  }
});

test("los espacios alrededor de la clave en Vercel no la rompen", () => {
  assert.deepEqual(checkCron("  s3cr3t\n", "Bearer s3cr3t"), { ok: true });
});

test("cronDenied responde 503 sin clave, 401 con clave mala y deja pasar la buena", async () => {
  const before = process.env.CRON_SECRET;
  const errors = console.error;
  console.error = () => {};
  try {
    delete process.env.CRON_SECRET;
    let res = cronDenied(req());
    assert.equal(res?.status, 503);
    assert.match((await res!.json()).error, /CRON_SECRET/);
    process.env.CRON_SECRET = "";
    assert.equal(cronDenied(req("Bearer "))?.status, 503);

    process.env.CRON_SECRET = "s3cr3t";
    res = cronDenied(req());
    assert.equal(res?.status, 401);
    assert.equal(cronDenied(req("Bearer otra"))?.status, 401);
    assert.equal(cronDenied(req("Bearer s3cr3t")), null);
  } finally {
    console.error = errors;
    if (before === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = before;
  }
});

test("todas las rutas de /api/cron comprueban la clave antes de hacer nada", () => {
  const dir = join(import.meta.dirname, "../../app/api/cron");
  const routes = readdirSync(dir);
  assert.ok(routes.length >= 7, "deberían estar las 7 tareas");
  for (const name of routes) {
    const src = readFileSync(join(dir, name, "route.ts"), "utf8");
    const body = src.slice(src.indexOf("export async function GET"));
    assert.match(body, /^export async function GET\(req: Request\) \{\s*const denied = cronDenied\(req\);\s*if \(denied\) return denied;/, name);
  }
});
