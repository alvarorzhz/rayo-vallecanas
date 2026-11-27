#!/usr/bin/env node
// =====================================================================
// 4.31.6 · Restaurar una copia de seguridad en un Supabase NUEVO (vacío)
//
// Paso a paso en docs/recuperacion.md. En resumen:
//   RESTORE_SUPABASE_URL=https://xxxx.supabase.co \
//   RESTORE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/restaurar-copia.mjs rayo-vallecanas-copia-20261130-0300.json.gz [--simular]
//
// Hace dos cosas y prepara una tercera:
//   1. Crea los usuarios con el mismo id y email, con una contraseña provisional nueva
//      (la copia no guarda contraseñas) y la obligación de cambiarla al entrar.
//   2. Sube los archivos (fotos, escudos, justificantes, documentos), si la copia los trae.
//   3. Escribe <copia>.restaurar.sql con todos los datos. Ese archivo se ejecuta en el SQL Editor del
//      proyecto nuevo (o con `npx supabase db query --remote=<url> -f`). Va como SQL porque así corre como
//      «postgres» con los disparadores apagados: si no, los guardas de la app (quién puede cambiar roles,
//      pagos que no se tocan, auditoría…) frenarían la carga o llenarían la auditoría de ruido.
//
// · Vale la copia automática de los lunes (.json.gz, con archivos) y la descargada a mano (.json, solo datos).
// · Se niega a tocar un proyecto que ya tenga usuarios, y el de producción salvo que se diga a propósito.
// · --simular: lee la copia y comprueba el destino, sin escribir nada.
// =====================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "cakmcerhielecrfxgdlk";
/** Las sesiones abiertas eran de los dispositivos de antes y apuntan a auth.sessions, que no viaja en la copia. */
const SKIP_TABLES = ["session_activity"];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--simular");
const url = (process.env.RESTORE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.RESTORE_SERVICE_ROLE_KEY ?? "";

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };
if (!file) die("Falta el archivo de la copia: node scripts/restaurar-copia.mjs <copia.json.gz>");
if (!url || !key) die("Faltan RESTORE_SUPABASE_URL y RESTORE_SERVICE_ROLE_KEY (Project Settings → API del proyecto NUEVO).");
if (url.includes(PRODUCTION_REF) && !args.includes("--es-produccion-y-esta-vacia"))
  die(`Esa dirección es la de producción (${PRODUCTION_REF}). Restaura en un proyecto nuevo. Solo si producción está vacía de verdad, añade --es-produccion-y-esta-vacia.`);

// --- La copia ---
const raw = readFileSync(file);
const backup = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"));
if (backup.app !== "rayo-vallecanas" || typeof backup.tables !== "object") die("Ese archivo no es una copia de la app.");
const tables = Object.entries(backup.tables).filter(([t]) => !SKIP_TABLES.includes(t));
const files = backup.files ?? [];
const rowCount = tables.reduce((a, [, r]) => a + r.length, 0);
console.log(`Copia del ${backup.created_at}${backup.version ? ` (app ${backup.version})` : ""}: ${tables.length} tablas, ${rowCount} filas, ${files.length} archivos.`);

// --- El destino tiene que estar vacío de usuarios ---
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
if (listError) die(`No se pudo entrar en el proyecto de destino: ${listError.message}`);
if (existing.users.length) die("El proyecto de destino ya tiene usuarios. Restaura solo en un proyecto recién creado (migraciones aplicadas, sin usuarios).");
if (dryRun) { console.log("✔ Simulación: la copia se lee bien y el destino está vacío. No se ha escrito nada."); process.exit(0); }

// --- 1. Usuarios: mismo id y email ---
const profiles = backup.tables.profiles ?? [];
const passwords = [];
for (const p of profiles) {
  // Un «Antiguo miembro» dado de baja no tiene email: se le crea un acceso que no se puede usar
  const email = p.email || `baja-${p.id}@restaurado.invalid`;
  const password = p.email ? `Rayo-${randomBytes(6).toString("base64url")}` : randomBytes(24).toString("base64url");
  const { error } = await db.auth.admin.createUser({ id: p.id, email, password, email_confirm: true, user_metadata: { full_name: p.full_name ?? "" }, ...(p.email ? {} : { ban_duration: "876000h" }) });
  if (error) die(`No se pudo crear el usuario ${email}: ${error.message}`);
  if (p.email) passwords.push([p.email, password]);
}
console.log(`✔ ${profiles.length} usuarios creados.`);

// --- 2. Archivos ---
if (files.length) {
  let ok = 0;
  for (const f of files) {
    const { error } = await db.storage.from(f.bucket).upload(f.path, Buffer.from(f.base64, "base64"), { contentType: f.type, upsert: true });
    if (error) console.warn(`  · ${f.bucket}/${f.path}: ${error.message}`);
    else ok++;
  }
  console.log(`✔ ${ok} de ${files.length} archivos subidos.`);
} else {
  console.log("  · Esta copia no trae archivos (la descargada a mano solo lleva datos). Las fotos y documentos están en la copia automática de los lunes.");
}

// --- 3. El SQL con los datos ---
let tag = "copia";
const all = JSON.stringify(backup.tables);
while (all.includes(`$${tag}$`) || all.includes("$restore$")) tag = `copia${randomBytes(3).toString("hex")}`;
const data = JSON.stringify(Object.fromEntries(tables));
// Una sola sentencia (un bloque DO): corre entera o no corre nada, y vale para el SQL Editor y para `supabase db query`
const sql = `-- Restauración de ${file.split("/").pop()} (copia del ${backup.created_at}). Generado por scripts/restaurar-copia.mjs.
-- Ejecutar UNA vez en el proyecto NUEVO, después de crear los usuarios con el script.
do $restore$
declare
  copia jsonb := $${tag}$${data}$${tag}$::jsonb;
  r record;
  cols text;
  seq record;
  n bigint;
begin
  -- Sin disparadores ni comprobaciones de claves ajenas mientras se carga: la copia ya es coherente
  set local session_replication_role = replica;
  for r in select key as t, value as rows from jsonb_each(copia) loop
    -- Solo las columnas que existen hoy y no se calculan solas (las «generated» se rellenan solas).
    -- Los ids numéricos (identity) se conservan tal cual: «overriding system value».
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns
     where table_schema = 'public' and table_name = r.t and is_generated = 'NEVER';
    if cols is null then
      raise notice 'La tabla % ya no existe: se salta', r.t;
      continue;
    end if;
    execute format('delete from public.%I', r.t);  -- fuera las filas por defecto que ponen las migraciones
    execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I, $1)', r.t, cols, cols, r.t) using r.rows;
    get diagnostics n = row_count;
    raise notice '% · % filas', r.t, n;
    -- Los contadores de los ids siguen por donde iban
    for seq in select column_name, pg_get_serial_sequence('public.' || quote_ident(r.t), column_name) as s
                 from information_schema.columns where table_schema = 'public' and table_name = r.t loop
      if seq.s is not null then
        execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', seq.s, seq.column_name, r.t);
      end if;
    end loop;
  end loop;
  -- Todo el mundo cambia la contraseña provisional al entrar
  update public.profiles set must_change_password = true where email is not null;
end;
$restore$;
`;
const out = file.replace(/\.json(\.gz)?$/, "") + ".restaurar.sql";
writeFileSync(out, sql);
console.log(`✔ Datos preparados en ${out} (${(sql.length / 1024).toFixed(0)} KB).`);

console.log(`
Falta un paso: ejecutar ese archivo en el proyecto nuevo.
  · SQL Editor de Supabase: pega el contenido y pulsa Run.
  · O desde aquí: npx supabase db query --remote="<cadena de conexión de Connect → Direct>" -f "${out}"

Contraseñas provisionales (dáselas a cada uno; tendrá que cambiarla al entrar):`);
for (const [email, pw] of passwords) console.log(`  ${email}  ${pw}`);
console.log("\nDespués, sigue con «Después de restaurar» en docs/recuperacion.md.");
