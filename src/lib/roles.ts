import type { Act } from "@/lib/role-guide";
import { ROLE_LABEL } from "@/lib/format";

/** Perfiles: los tres de siempre (superadministrador, gestor y jugador) y los creados a medida. */
export type Base = "superadmin" | "admin" | "player";
export type PermSet = Record<string, Partial<Record<Act, boolean>>>;
export type ProfileDef = {
  key: string;            // "superadmin" | "admin" | "player" | id del perfil a medida
  name: string;
  description: string;
  base: Base;
  custom: boolean;
  perms: PermSet;
};
type Row = { module: string; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean };
type DB = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export const ACTS: Act[] = ["read", "create", "update", "delete"];
/** Módulos que se pueden configurar (la auditoría es siempre y solo del superadministrador). */
export const EDITABLE_MODULES = ["lottery_admin", "lottery_sell", "users", "finances", "squad", "squad_private", "matches", "sponsors"];
/** Reglas fijas del club: los jugadores nunca ven Finanzas, los patrocinios ni datos personales de otros. */
export const PLAYER_BLOCKED = ["finances", "squad_private", "sponsors"];
export const blocked = (base: Base, module: string) => base === "player" && PLAYER_BLOCKED.includes(module);

const toSet = (rows: Row[]): PermSet =>
  Object.fromEntries(rows.map((r) => [r.module, { read: r.can_read, create: r.can_create, update: r.can_update, delete: r.can_delete }]));

/** Lo que de verdad puede hacer un perfil (igual que la función has_perm de la base de datos). */
export function allows(def: Pick<ProfileDef, "base" | "perms">, module: string, act: Act) {
  if (def.base === "superadmin") return true;
  if (module === "audit" || blocked(def.base, module)) return false;
  return Boolean(def.perms[module]?.[act]);
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function fetchProfileDefs(supabase: DB): Promise<ProfileDef[]> {
  const [{ data: rolePerms }, { data: customs }, { data: customPerms }] = await Promise.all([
    supabase.from("role_permissions").select("*"),
    supabase.from("custom_roles").select("id, name, description, base").order("name"),
    supabase.from("custom_role_permissions").select("*"),
  ]);
  const rp = (rolePerms ?? []) as (Row & { role: string })[];
  const cp = (customPerms ?? []) as (Row & { role_id: string })[];
  return [
    { key: "superadmin", name: ROLE_LABEL.superadmin, description: "", base: "superadmin", custom: false, perms: {} },
    { key: "admin", name: ROLE_LABEL.admin, description: "", base: "admin", custom: false, perms: toSet(rp.filter((r) => r.role === "admin")) },
    { key: "player", name: ROLE_LABEL.player, description: "", base: "player", custom: false, perms: toSet(rp.filter((r) => r.role === "player")) },
    ...((customs ?? []) as { id: string; name: string; description: string; base: Base }[]).map((c) => ({
      key: c.id, name: c.name, description: c.description, base: c.base, custom: true, perms: toSet(cp.filter((r) => r.role_id === c.id)),
    })),
  ];
}

/** Clave del perfil de una persona: su perfil a medida o su rol. */
export const profileKey = (p: { role: string; custom_role_id?: string | null }) => p.custom_role_id ?? p.role;
