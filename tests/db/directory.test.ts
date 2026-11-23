/**
 * Directorio de personas (member_directory): de aquí salen los nombres en la auditoría,
 * la rifa, Uso y Finanzas. En la 4.20.3 se quedó sin permiso y todo salía como
 * «Usuario borrado» (arreglado en la 4.28.2).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, type Who } from "./helpers.ts";

describe("directorio de personas", () => {
  for (const who of ["superadmin", "gestor", "dani"] as Who[]) {
    test(`${who} ve los nombres de los usuarios`, async () => {
      const { db, id } = await as(who);
      const rows = ok(await db.from("member_directory").select("id, full_name, role, active")) as { id: string; full_name: string }[];
      const all = ok(await admin.from("profiles").select("id")) as { id: string }[];
      assert.equal(rows.length, all.length);
      assert.ok(rows.find((r) => r.id === id)?.full_name, "su propio nombre aparece");
    });
  }

  test("sin sesión no se ve nada", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error } = await anon.from("member_directory").select("id");
    assert.ok(error || !data?.length, "un visitante sin sesión no lista usuarios");
  });
});
