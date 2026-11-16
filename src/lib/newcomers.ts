/**
 * Jugadores nuevos en la liga (v4.17.0).
 *
 * La app mira la plantilla del Rayo en futormes y apunta a quien aparece allí y no está en la
 * plantilla de la temporada en la app. No los añade sola: un gestor los revisa en Plantilla y
 * pulsa «Añadir» o «Ignorar». Aquí está lo que se decide sin internet ni base de datos, para
 * poder probarlo con `npm test`.
 */
import type { LeaguePlayer } from "./league-parse.ts";

/** Un jugador de futormes que falta en la plantilla. Si ya tenía ficha en la app (de otra temporada), `playerId`. */
export type Newcomer = LeaguePlayer & { playerId: string | null; seenAt: string };
/** Jugadores que un gestor ha dicho que no son de los nuestros: por su número en la liga y por el nombre. */
export type IgnoredPlayer = { ext: string; name: string };

type AppPlayer = { id: string; first_name: string; last_name: string; ext_id: string | null };

export const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Nombre y apellidos: las dos últimas palabras son los apellidos. */
export const splitName = (full: string) => {
  const w = full.trim().split(/\s+/);
  return w.length <= 2 ? { first_name: w[0], last_name: w.slice(1).join(" ") } : { first_name: w.slice(0, -2).join(" "), last_name: w.slice(-2).join(" ") };
};

/**
 * ¿Quién es en la app este jugador de la liga? Por su enlace con la liga, por el nombre completo
 * (o el de la app al principio del de la liga) o por el dorsal de esta temporada con el mismo nombre de pila.
 */
export function matchPlayer<P extends AppPlayer>(players: P[], numberOf: Map<string, number | null>, lp: Pick<LeaguePlayer, "extId" | "name" | "number">): P | undefined {
  const ext = `futormes:${lp.extId}`;
  const full = normName(lp.name);
  return players.find((x) => x.ext_id === ext)
    ?? players.find((x) => { const n = normName(`${x.first_name} ${x.last_name}`); return n === full || (n.split(" ").length >= 2 && full.startsWith(n + " ")); })
    ?? players.find((x) => lp.number != null && numberOf.get(x.id) === lp.number && normName(x.first_name) === normName(splitName(lp.name).first_name));
}

export const isIgnored = (ignored: IgnoredPlayer[], lp: Pick<LeaguePlayer, "extId" | "name">) =>
  ignored.some((i) => i.ext === lp.extId || normName(i.name) === normName(lp.name));

const sameOne = (a: Pick<LeaguePlayer, "extId" | "name">, b: Pick<LeaguePlayer, "extId" | "name">) => a.extId === b.extId || normName(a.name) === normName(b.name);

/**
 * Lista de pendientes a partir de los que faltan ahora. Se rehace entera en cada lectura: quien
 * ya se ha fichado a mano o ha desaparecido de la liga sale solo. `fresh` son los que no estaban
 * en la lista anterior (los únicos que se avisan).
 */
export function mergeNewcomers(p: { missing: (LeaguePlayer & { playerId: string | null })[]; prev: Newcomer[]; ignored: IgnoredPlayer[]; now: string }) {
  const list: Newcomer[] = [];
  const fresh: Newcomer[] = [];
  for (const lp of p.missing) {
    if (isIgnored(p.ignored, lp) || list.some((x) => sameOne(x, lp))) continue;
    const before = p.prev.find((x) => sameOne(x, lp));
    const n: Newcomer = { ...lp, seenAt: before?.seenAt ?? p.now };
    list.push(n);
    if (!before) fresh.push(n);
  }
  list.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es"));
  return { list, fresh };
}

/** Lee la lista guardada en league_sync.last_summary (descarta lo que no tenga forma). */
export function storedNewcomers(summary: Record<string, unknown> | null | undefined): { newcomers: Newcomer[]; ignored: IgnoredPlayer[] } {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    newcomers: arr(summary?.newcomers).filter((n): n is Newcomer => !!n && typeof n === "object" && typeof n.extId === "string" && typeof n.name === "string"),
    ignored: arr(summary?.ignoredPlayers).filter((n): n is IgnoredPlayer => !!n && typeof n === "object" && typeof n.ext === "string" && typeof n.name === "string"),
  };
}

/** Nombre corto para el aviso: nombre de pila y primer apellido. */
const shortName = (full: string) => { const s = splitName(full); return [s.first_name, s.last_name.split(" ")[0]].filter(Boolean).join(" "); };

/** Texto del aviso al móvil. */
export function newcomersText(fresh: Pick<LeaguePlayer, "name" | "number">[]) {
  if (fresh.length === 1) {
    const n = fresh[0];
    return { title: "🆕 Jugador nuevo en la liga", body: `${shortName(n.name)}${n.number != null ? ` (dorsal ${n.number})` : ""} está en la plantilla de futormes y no en la app. Toca para revisarlo.` };
  }
  const names = fresh.slice(0, 3).map((n) => shortName(n.name));
  const list = fresh.length > 3 ? `${names.join(", ")} y ${fresh.length - 3} más` : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  return { title: `🆕 ${fresh.length} jugadores nuevos en la liga`, body: `${list} están en futormes y no en la app. Toca para revisarlos.` };
}

