/**
 * Utilidades de las pruebas contra la base de datos (npm run test:db).
 *
 * Se ejecutan contra un Supabase LOCAL con los datos de ejemplo (supabase/seed.sql), nunca
 * contra producción: si la dirección no es localhost, se paran antes de empezar.
 * La dirección y las claves salen de las variables de entorno o de .env.local
 * (lo mismo que usa la app; en la CI lo escribe el propio flujo).
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvFile() {
  try {
    for (const line of readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local: valen las variables de entorno */
  }
}
loadEnvFile();

export const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!URL_ || !ANON || !SERVICE) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY (arranca `supabase start`)");
}
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(URL_)) {
  throw new Error(`Estas pruebas escriben en la base de datos: solo se ejecutan contra un Supabase local, no contra ${URL_}`);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Cliente con la clave de servicio: prepara datos saltándose los permisos. */
export const admin = createClient(URL_, SERVICE, opts);

/** Personas de los datos de ejemplo. */
export const PEOPLE = {
  superadmin: "alvaro@rayo.test",
  gestor: "ruben@rayo.test",
  dani: "dani@rayo.test",
  javi: "javi@rayo.test",
} as const;
export type Who = keyof typeof PEOPLE;

const sessions = new Map<Who, Promise<{ db: SupabaseClient; id: string }>>();

/** Cliente con la sesión iniciada de una persona de los datos de ejemplo (como en la app). */
export function as(who: Who) {
  if (!sessions.has(who)) {
    sessions.set(who, (async () => {
      const db = createClient(URL_, ANON, opts);
      // Justo después de arrancar (o de `supabase db reset`) el servicio de sesiones tarda unos segundos
      for (let i = 1; ; i++) {
        const { data, error } = await db.auth.signInWithPassword({ email: PEOPLE[who], password: "Rayo1234!" });
        if (!error) return { db, id: data.user.id };
        if (i >= 10 || error.status === 400) throw new Error(`No se ha podido entrar como ${PEOPLE[who]}: ${error.message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    })());
  }
  return sessions.get(who)!;
}

/** Devuelve los datos o lanza el error de Supabase con su mensaje. */
export function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Espera que la llamada falle con un mensaje que encaje con el patrón. */
export async function rejects(p: PromiseLike<{ error: { message: string } | null }>, pattern: RegExp) {
  const { error } = await p;
  if (!error) throw new Error(`Se esperaba un error /${pattern.source}/ y ha funcionado`);
  if (!pattern.test(error.message)) throw new Error(`Se esperaba un error /${pattern.source}/ y ha salido: ${error.message}`);
}

/** Un nombre distinto en cada prueba, para no chocar con otras ejecuciones. */
export const tag = (s: string) => `${s} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
