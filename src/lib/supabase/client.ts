"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase en el navegador (subidas de archivos y poco más).
 * 4.30.4 · No renueva la sesión por su cuenta: de eso se encarga el servidor en cada petición (src/proxy.ts).
 * Si los dos la renovaban a la vez y el móvil se dormía a medias, Supabase veía un token «ya usado», lo tomaba
 * por un robo y cerraba la sesión del todo.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false } },
  );
}
