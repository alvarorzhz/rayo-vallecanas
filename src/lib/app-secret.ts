import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const cache = new Map<string, string>();

/**
 * Clave secreta de la app guardada en la tabla app_secrets. La primera vez se crea sola
 * (si dos peticiones coinciden, gana la primera y las dos leen la misma).
 */
export async function appSecret(name: string): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;
  const admin = createAdminClient();
  const read = async () => (await admin.from("app_secrets").select("value").eq("name", name).maybeSingle()).data?.value as string | undefined;
  let v = await read();
  if (!v) {
    await admin.from("app_secrets").upsert([{ name, value: randomBytes(32).toString("base64url") }], { onConflict: "name", ignoreDuplicates: true });
    v = await read();
  }
  if (!v) throw new Error(`No se pudo crear la clave «${name}»`);
  cache.set(name, v);
  return v;
}
