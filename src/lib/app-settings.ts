/**
 * 4.31.0 · Mandos de la app: modo mantenimiento, mensaje fijo, módulos apagados y «forzar actualización».
 * Sin dependencias de servidor, para poder probarlo.
 */

export type AppModule = "lottery" | "news" | "porra" | "capsule" | "polls";
export type BannerTone = "info" | "urgent";

export type AppSettings = {
  maintenance: boolean;
  maintenance_message: string | null;
  maintenance_until: string | null;
  maintenance_public: boolean;
  banner_text: string | null;
  banner_tone: BannerTone;
  banner_until: string | null;
  modules_off: string[];
  reload_at: string | null;
  updated_at?: string | null;
};

/** Apartados que se pueden apagar, con lo que se esconde de cada uno. */
export const APP_MODULES: { key: AppModule; label: string; hint: string }[] = [
  { key: "lottery", label: "Sorteos", hint: "Sorteos y Mis ventas. La página pública de la rifa no cambia." },
  { key: "news", label: "La Voz del Rayo", hint: "El periódico dentro de la app. Las noticias públicas no cambian." },
  { key: "porra", label: "Porra", hint: "La porra de los partidos y su clasificación." },
  { key: "capsule", label: "Cápsula del tiempo", hint: "La cápsula y su aviso en Inicio." },
  { key: "polls", label: "Votaciones", hint: "Las votaciones sí/no (la del MVP sigue)." },
];
export const MODULE_KEYS = APP_MODULES.map((m) => m.key) as AppModule[];
export const moduleLabel = (k: string) => APP_MODULES.find((m) => m.key === k)?.label ?? k;

/** Si la tabla aún no existe (SQL sin ejecutar) o falla la lectura, la app sigue como siempre. */
export const DEFAULT_SETTINGS: AppSettings = {
  maintenance: false, maintenance_message: null, maintenance_until: null, maintenance_public: false,
  banner_text: null, banner_tone: "info", banner_until: null, modules_off: [], reload_at: null,
};

export function normalizeSettings(row: Partial<AppSettings> | null | undefined): AppSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    banner_tone: row.banner_tone === "urgent" ? "urgent" : "info",
    modules_off: Array.isArray(row.modules_off) ? row.modules_off.filter((m) => (MODULE_KEYS as string[]).includes(m)) : [],
  };
}

/** La franja se ve si hay texto y no ha pasado su fecha de quitarse. */
export function activeBanner(s: AppSettings, now = new Date()): { text: string; tone: BannerTone } | null {
  const text = s.banner_text?.trim();
  if (!text) return null;
  if (s.banner_until && new Date(s.banner_until).getTime() <= now.getTime()) return null;
  return { text, tone: s.banner_tone };
}

/** «datetime-local» (hora de Madrid, sin zona) → ISO UTC. Vacío o mal escrito → null. */
export function madridLocalToIso(v: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  // Prueba con +1 y +2 h y se queda con la que, vista en Madrid, da la hora escrita
  for (const off of [1, 2]) {
    const t = new Date(Date.UTC(y, mo - 1, d, h - off, mi));
    if (isoToMadridLocal(t.toISOString()) === `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`) return t.toISOString();
  }
  return null;
}

/** ISO → «2026-11-25T18:30» en hora de Madrid, para rellenar un datetime-local. */
export function isoToMadridLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** «hoy a las 18:30», «mañana a las 10:00» o «el jueves 27 a las 9:00» (hora de Madrid). */
export function backAtLabel(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= now.getTime()) return null;
  const day = (x: Date) => isoToMadridLocal(x.toISOString()).slice(0, 10);
  const time = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "numeric", minute: "2-digit" }).format(d);
  if (day(d) === day(now)) return `hoy a las ${time}`;
  if (day(d) === day(new Date(now.getTime() + 86_400_000))) return `mañana a las ${time}`;
  const wd = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric" }).format(d);
  return `el ${wd} a las ${time}`;
}

/**
 * ¿Hay que recargar para coger la última versión? `seen` es la marca guardada en el móvil
 * ("0" si cuando la guardó aún no se había forzado nunca). Sin marca guardada (primera vez en
 * ese móvil) no se recarga: acaba de cargar la última, se guarda la marca y listo.
 */
export function needsReload(seen: string | null, reloadAt: string | null): boolean {
  if (!reloadAt || !seen) return false;
  const before = seen === "0" ? 0 : new Date(seen).getTime();
  return !Number.isNaN(before) && new Date(reloadAt).getTime() > before;
}
