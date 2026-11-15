/**
 * Uso de la app (4.16.0): a qué «pantalla» cuenta cada dirección y cómo se
 * llama y agrupa en Gestión → Uso. Puro, sin dependencias, para poder probarlo.
 */

export type UsageGroup = "Inicio" | "Partidos" | "Plantilla" | "La Voz" | "Sorteos" | "Finanzas" | "Gestión" | "Otros";

export type UsageArea = { key: string; label: string; group: UsageGroup };

/** Todas las pantallas que se cuentan, en el orden en que se enseñan. */
export const USAGE_AREAS: UsageArea[] = [
  { key: "inicio", label: "Inicio", group: "Inicio" },
  { key: "partidos", label: "Lista de partidos", group: "Partidos" },
  { key: "partido", label: "Ficha de un partido", group: "Partidos" },
  { key: "convocatoria", label: "Convocatoria", group: "Partidos" },
  { key: "directo", label: "Acta en vivo", group: "Partidos" },
  { key: "acta", label: "Acta y notas", group: "Partidos" },
  { key: "partido_editar", label: "Crear o editar partido", group: "Partidos" },
  { key: "estadisticas", label: "Estadísticas", group: "Partidos" },
  { key: "porra", label: "Porra", group: "Partidos" },
  { key: "liga", label: "Liga y clasificación", group: "Partidos" },
  { key: "rivales", label: "Rivales", group: "Partidos" },
  { key: "resumen", label: "Resumen de temporada", group: "Partidos" },
  { key: "plantilla", label: "Cromos de la plantilla", group: "Plantilla" },
  { key: "jugador", label: "Ficha de un jugador", group: "Plantilla" },
  { key: "jugador_editar", label: "Fichar o editar jugador", group: "Plantilla" },
  { key: "cuotas", label: "Cuotas", group: "Plantilla" },
  { key: "documentos", label: "Documentos", group: "Plantilla" },
  { key: "historia", label: "Historia", group: "Plantilla" },
  { key: "temporada", label: "Preparar temporada", group: "Plantilla" },
  { key: "la_voz", label: "Portada de La Voz", group: "La Voz" },
  { key: "noticia", label: "Leer una noticia", group: "La Voz" },
  { key: "entrevista", label: "Contestar entrevista", group: "La Voz" },
  { key: "redaccion", label: "Escribir noticias", group: "La Voz" },
  { key: "sorteos", label: "Campañas de sorteos", group: "Sorteos" },
  { key: "vender", label: "Nueva venta", group: "Sorteos" },
  { key: "mis_ventas", label: "Mis ventas", group: "Sorteos" },
  { key: "finanzas", label: "Resumen de finanzas", group: "Finanzas" },
  { key: "movimientos", label: "Movimientos", group: "Finanzas" },
  { key: "informes", label: "Informes", group: "Finanzas" },
  { key: "mesa", label: "Mesa del despacho", group: "Gestión" },
  { key: "usuarios", label: "Usuarios", group: "Gestión" },
  { key: "perfiles", label: "Perfiles", group: "Gestión" },
  { key: "patrocinadores", label: "Patrocinadores", group: "Gestión" },
  { key: "avisos", label: "Avisos", group: "Gestión" },
  { key: "auditoria", label: "Auditoría", group: "Gestión" },
  { key: "copia", label: "Copia de seguridad", group: "Gestión" },
  { key: "uso", label: "Uso", group: "Gestión" },
  { key: "votaciones", label: "Votaciones", group: "Otros" },
  { key: "perfil", label: "Mi perfil", group: "Otros" },
  { key: "novedades", label: "Novedades", group: "Otros" },
];

export const AREA_BY_KEY = new Map(USAGE_AREAS.map((a) => [a.key, a]));

const SUB: Record<string, Record<string, string>> = {
  partidos: { estadisticas: "estadisticas", porra: "porra", liga: "liga", rivales: "rivales", resumen: "resumen", nuevo: "partido_editar" },
  plantilla: { cuotas: "cuotas", documentos: "documentos", historia: "historia", "nueva-temporada": "temporada", nuevo: "jugador_editar" },
  "la-voz": { nueva: "redaccion", entrevista: "entrevista" },
  finanzas: { movimientos: "movimientos", informes: "informes", nuevo: "movimientos", ajustes: "finanzas" },
  admin: { usuarios: "usuarios", perfiles: "perfiles", patrocinadores: "patrocinadores", avisos: "avisos", auditoria: "auditoria", copia: "copia", uso: "uso" },
};

/** Pantalla a la que cuenta una dirección de la app, o null si no se cuenta. */
export function usageArea(pathname: string): string | null {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  const [top, second, third] = parts;
  if (!top) return "inicio";
  switch (top) {
    case "partidos":
      if (!second) return "partidos";
      if (SUB.partidos[second]) return SUB.partidos[second];
      if (third === "convocatoria") return "convocatoria";
      if (third === "directo") return "directo";
      if (third === "acta") return "acta";
      if (third === "editar") return "partido_editar";
      return "partido";
    case "plantilla":
      if (!second) return "plantilla";
      if (SUB.plantilla[second]) return SUB.plantilla[second];
      return third === "editar" ? "jugador_editar" : "jugador";
    case "la-voz":
      if (!second) return "la_voz";
      if (SUB["la-voz"][second]) return SUB["la-voz"][second];
      return third === "editar" ? "redaccion" : "noticia";
    case "loteria":
      return third === "vender" ? "vender" : "sorteos";
    case "mis-ventas":
      return "mis_ventas";
    case "finanzas":
      if (!second) return "finanzas";
      return SUB.finanzas[second] ?? "movimientos";
    case "admin":
      if (!second) return "mesa";
      return SUB.admin[second] ?? null;
    case "votaciones":
    case "perfil":
    case "novedades":
      return top;
    default:
      return null;
  }
}

/** Tipo de dispositivo a partir del navegador (lo bastante fino para saber móvil u ordenador). */
export function deviceKind(ua: string, touchPoints = 0): "movil" | "tablet" | "ordenador" {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  // iPad moderno se presenta como Mac con pantalla táctil
  if (/Macintosh/i.test(ua) && touchPoints > 1) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "movil";
  return "ordenador";
}

export type UsageRow = { day: string; user_id: string; area: string; hits: number };

export type AreaStat = UsageArea & { hits: number; people: number };

/** Visitas y personas distintas por pantalla, de más a menos usada (incluye las que nadie abrió, con 0). */
export function areaStats(rows: UsageRow[], visible: (key: string) => boolean = () => true): AreaStat[] {
  const hits = new Map<string, number>();
  const people = new Map<string, Set<string>>();
  for (const r of rows) {
    hits.set(r.area, (hits.get(r.area) ?? 0) + r.hits);
    if (!people.has(r.area)) people.set(r.area, new Set());
    people.get(r.area)!.add(r.user_id);
  }
  const order = new Map(USAGE_AREAS.map((a, i) => [a.key, i]));
  return USAGE_AREAS.filter((a) => visible(a.key) || hits.has(a.key))
    .map((a) => ({ ...a, hits: hits.get(a.key) ?? 0, people: people.get(a.key)?.size ?? 0 }))
    .sort((a, b) => b.people - a.people || b.hits - a.hits || order.get(a.key)! - order.get(b.key)!);
}

export type PersonStat = { user_id: string; days: number; hits: number; top: string | null; last: string | null };

/** Por persona: días que entró, pantallas abiertas, la que más usa y el último día. */
export function personStats(rows: UsageRow[]): Map<string, PersonStat> {
  const out = new Map<string, PersonStat & { daySet: Set<string>; byArea: Map<string, number> }>();
  for (const r of rows) {
    let p = out.get(r.user_id);
    if (!p) {
      p = { user_id: r.user_id, days: 0, hits: 0, top: null, last: null, daySet: new Set(), byArea: new Map() };
      out.set(r.user_id, p);
    }
    p.daySet.add(r.day);
    p.hits += r.hits;
    p.byArea.set(r.area, (p.byArea.get(r.area) ?? 0) + r.hits);
    if (!p.last || r.day > p.last) p.last = r.day;
  }
  const res = new Map<string, PersonStat>();
  for (const [id, p] of out) {
    let top: string | null = null;
    let best = 0;
    for (const [a, n] of p.byArea) if (n > best && a !== "inicio") { best = n; top = a; }
    res.set(id, { user_id: id, days: p.daySet.size, hits: p.hits, top, last: p.last });
  }
  return res;
}

/** Personas distintas por día (para la gráfica), de los últimos `days` días hasta `today` (AAAA-MM-DD). */
export function dailyPeople(rows: UsageRow[], today: string, days: number): { day: string; people: number }[] {
  const per = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!per.has(r.day)) per.set(r.day, new Set());
    per.get(r.day)!.add(r.user_id);
  }
  const out: { day: string; people: number }[] = [];
  const end = Date.parse(today + "T12:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * 86400_000).toISOString().slice(0, 10);
    out.push({ day: d, people: per.get(d)?.size ?? 0 });
  }
  return out;
}
