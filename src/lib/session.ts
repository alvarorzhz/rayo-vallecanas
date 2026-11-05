import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Module = "lottery_admin" | "lottery_sell" | "users" | "audit" | "finances" | "squad" | "matches";
export type Action = "read" | "create" | "update" | "delete";
export type Perms = Record<Module, Record<Action, boolean>>;

export type Session = {
  user: { id: string; email: string | null };
  profile: { id: string; full_name: string; role: string; email: string | null; phone: string | null; avatar_url: string | null };
  perms: Perms;
  can: (m: Module, a?: Action) => boolean;
};

/** Usuario, perfil y permisos efectivos. Cacheado por petición. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  // getClaims verifica el token en local (claves asimétricas): evita una llamada a Supabase Auth en cada página
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? null };

  const [{ data: profile }, { data: permRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, email, phone, active, avatar_url").eq("id", user.id).single(),
    supabase.rpc("my_permissions"),
  ]);
  if (!profile || !profile.active) {
    // Usuario deshabilitado: se le cierra la sesión en una ruta que sí puede borrar cookies
    redirect("/auth/salir?error=inactivo");
  }

  const perms = {} as Perms;
  for (const r of (permRows ?? []) as Array<{ module: Module; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }>) {
    perms[r.module] = { read: r.can_read, create: r.can_create, update: r.can_update, delete: r.can_delete };
  }
  return {
    user,
    profile,
    perms,
    can: (m, a = "read") => Boolean(perms[m]?.[a]),
  };
});

/** Corta la petición si el usuario no tiene el permiso (la BD lo vuelve a comprobar con RLS). */
export async function requirePerm(m: Module, a: Action = "read") {
  const s = await getSession();
  if (!s.can(m, a)) redirect("/?error=permiso");
  return s;
}
