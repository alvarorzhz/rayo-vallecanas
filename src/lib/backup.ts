import "server-only";
import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_TABLES } from "@/lib/backup-tables";
import { APP_VERSION } from "@/lib/changelog";

/**
 * Copia de seguridad automática (4.8.0).
 * Cada lunes se guarda TODO (las tablas y los archivos: fotos, escudos, justificantes y documentos) en un único
 * archivo .json.gz. Se guarda en Vercel Blob (privado, fuera de Supabase) si está configurado
 * (BLOB_READ_WRITE_TOKEN) y, si no, en un cajón privado de Supabase («backups»). Se conservan las 8 últimas.
 */

export const BACKUP_KEEP = 8;
const PREFIX = "copias/";
const BUCKET = "backups";

export type StoredBackup = { name: string; size: number; at: string; where: "blob" | "supabase" };

/** Lee todas las tablas de la copia, de 1000 en 1000. */
export async function readTables(db: SupabaseClient) {
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const [table] of BACKUP_TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await db.from(table).select("*").range(from, from + 999);
      if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
      rows.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    data[table] = rows;
  }
  return data;
}

type StoredFile = { bucket: string; path: string; type: string; base64: string };

/** Todos los archivos de Storage (menos las propias copias), en base64. */
async function readFiles(admin: SupabaseClient) {
  const files: StoredFile[] = [];
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`No se pudieron leer los archivos: ${error.message}`);
  for (const b of buckets ?? []) {
    if (b.id === BUCKET) continue;
    const walk = async (dir: string): Promise<void> => {
      for (let offset = 0; ; offset += 1000) {
        const { data: items, error: e } = await admin.storage.from(b.id).list(dir, { limit: 1000, offset });
        if (e) throw new Error(`No se pudo leer ${b.id}/${dir}: ${e.message}`);
        for (const it of items ?? []) {
          const path = dir ? `${dir}/${it.name}` : it.name;
          if (!it.id) { await walk(path); continue; } // carpeta
          const { data: blob, error: de } = await admin.storage.from(b.id).download(path);
          if (de || !blob) throw new Error(`No se pudo descargar ${b.id}/${path}`);
          files.push({ bucket: b.id, path, type: blob.type || "application/octet-stream", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") });
        }
        if (!items || items.length < 1000) break;
      }
    };
    await walk("");
  }
  return files;
}

const blobOn = () => !!process.env.BLOB_READ_WRITE_TOKEN;

async function ensureBucket(admin: SupabaseClient) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`No se pudo crear el cajón de copias: ${error.message}`);
  }
}

/** Hace la copia completa y la guarda. Devuelve dónde ha quedado. */
export async function runBackup(): Promise<StoredBackup & { tables: number; rows: number; files: number }> {
  const admin = createAdminClient();
  const [tables, files] = await Promise.all([readTables(admin), readFiles(admin)]);
  const at = new Date().toISOString();
  const body = gzipSync(JSON.stringify({ app: "rayo-vallecanas", version: APP_VERSION, created_at: at, tables, files }));
  const stamp = at.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const name = `rayo-vallecanas-copia-${stamp}.json.gz`;
  let where: StoredBackup["where"] = "supabase";
  let blobError = "";
  if (blobOn()) {
    try {
      const { put } = await import("@vercel/blob");
      await put(PREFIX + name, body, { access: "private", contentType: "application/gzip", addRandomSuffix: false, allowOverwrite: true });
      where = "blob";
    } catch (e) {
      blobError = (e as Error).message; // si Vercel Blob falla, que no se quede sin copia: va a Supabase
    }
  }
  if (where === "supabase") {
    await ensureBucket(admin);
    const { error } = await admin.storage.from(BUCKET).upload(name, body, { contentType: "application/gzip", upsert: true });
    if (error) throw new Error(`No se pudo guardar la copia${blobError ? ` (Vercel Blob: ${blobError})` : ""}: ${error.message}`);
  }
  await pruneBackups();
  const rows = Object.values(tables).reduce((a, r) => a + r.length, 0);
  return { name, size: body.length, at, where, tables: Object.keys(tables).length, rows, files: files.length };
}

/** Copias guardadas, de la más reciente a la más antigua (de los dos sitios). */
export async function listBackups(): Promise<StoredBackup[]> {
  const out: StoredBackup[] = [];
  if (blobOn()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: PREFIX, limit: 100 });
      for (const b of blobs) out.push({ name: b.pathname.slice(PREFIX.length), size: b.size, at: new Date(b.uploadedAt).toISOString(), where: "blob" });
    } catch {
      // sin acceso a Vercel Blob: se enseñan las de Supabase
    }
  }
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  for (const f of data ?? []) {
    if (!f.id || !f.name.endsWith(".json.gz")) continue;
    out.push({ name: f.name, size: Number(f.metadata?.size ?? 0), at: f.created_at ?? "", where: "supabase" });
  }
  // Por el nombre, que lleva la fecha y la hora de la copia
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

/** Deja solo las BACKUP_KEEP más recientes. */
async function pruneBackups() {
  const all = await listBackups();
  const old = all.slice(BACKUP_KEEP);
  if (!old.length) return;
  const blob = old.filter((b) => b.where === "blob").map((b) => PREFIX + b.name);
  const supa = old.filter((b) => b.where === "supabase").map((b) => b.name);
  if (blob.length) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blob);
    } catch {}
  }
  if (supa.length) await createAdminClient().storage.from(BUCKET).remove(supa);
}

export const isBackupName = (n: string) => /^rayo-vallecanas-copia-\d{8}-\d{4}\.json\.gz$/.test(n);

/** Descarga una copia guardada (ya comprobado que quien la pide es superadministrador). */
export async function readBackup(name: string, where: StoredBackup["where"]): Promise<ReadableStream<Uint8Array> | Blob | null> {
  if (!isBackupName(name)) return null;
  if (where === "blob") {
    const { get } = await import("@vercel/blob");
    const r = await get(PREFIX + name, { access: "private", useCache: false });
    return r && r.statusCode === 200 ? r.stream : null;
  }
  const { data } = await createAdminClient().storage.from(BUCKET).download(name);
  return data ?? null;
}
