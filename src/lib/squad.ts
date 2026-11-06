export type SquadStatus = "active" | "injured" | "away" | "left";
export type Foot = "right" | "left" | "both";
export type Line = "GK" | "DEF" | "MID" | "FWD";

export type Player = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  photo_url: string | null;
  foot: Foot | null;
  height_cm: number | null;
  joined_club_on: string | null;
  user_id: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  player_id: string;
  season: string;
  number: number | null;
  position: string;
  status: SquadStatus;
  armband: "captain" | "vice" | null;
  joined_on: string | null;
  left_on: string | null;
} & Stats;

/** Estadísticas de una temporada (las apuntan los gestores; en la fase 4 saldrán de las actas). */
export type Stats = {
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  yellows: number;
  reds: number;
  mvps: number;
  conceded: number;
  clean_sheets: number;
};
export const STAT_KEYS = ["apps", "starts", "goals", "assists", "yellows", "reds", "mvps", "conceded", "clean_sheets"] as const;
export const STAT_LABEL: Record<keyof Stats, { short: string; long: string }> = {
  apps: { short: "PJ", long: "Partidos jugados" },
  starts: { short: "TIT", long: "De titular" },
  goals: { short: "GOL", long: "Goles" },
  assists: { short: "ASI", long: "Asistencias" },
  yellows: { short: "TA", long: "Tarjetas amarillas" },
  reds: { short: "TR", long: "Tarjetas rojas" },
  mvps: { short: "MVP", long: "Mejor del partido" },
  conceded: { short: "GC", long: "Goles encajados" },
  clean_sheets: { short: "P0", long: "Porterías a cero" },
};
/** Las seis estadísticas del cromo: los porteros cambian goles y asistencias por porterías a cero y encajados. */
export const cardStats = (line: Line): (keyof Stats)[] =>
  line === "GK" ? ["apps", "clean_sheets", "conceded", "mvps", "yellows", "reds"] : ["apps", "goals", "assists", "mvps", "yellows", "reds"];

export function sumStats(rows: Stats[]): Stats {
  const t = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Stats;
  for (const r of rows) for (const k of STAT_KEYS) t[k] += r[k] ?? 0;
  return t;
}
/** "0,75" (dos decimales como mucho). */
export const ratio = (a: number, b: number) => (b ? (Math.round((a / b) * 100) / 100).toString().replace(".", ",") : "–");

export type PlayerPrivate = {
  player_id: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  sport_notes: string | null;
  internal_notes: string | null;
};

/** Jugador con su ficha de la temporada que se está viendo. */
export type RosterEntry = Membership & { player: Player };

/** Posiciones de fútbol 7 (abreviaturas habituales), agrupadas por línea y en orden de campo. */
export const POSITIONS: { code: string; label: string; line: Line }[] = [
  { code: "POR", label: "Portero", line: "GK" },
  { code: "LD", label: "Lateral derecho", line: "DEF" },
  { code: "DFC", label: "Central", line: "DEF" },
  { code: "LI", label: "Lateral izquierdo", line: "DEF" },
  { code: "MCD", label: "Pivote", line: "MID" },
  { code: "MD", label: "Banda derecha", line: "MID" },
  { code: "MI", label: "Banda izquierda", line: "MID" },
  { code: "MCO", label: "Mediapunta", line: "MID" },
  { code: "DC", label: "Delantero centro", line: "FWD" },
];
export const POSITION_LABEL: Record<string, string> = Object.fromEntries(POSITIONS.map((p) => [p.code, p.label]));
export const POSITION_ORDER: Record<string, number> = Object.fromEntries(POSITIONS.map((p, i) => [p.code, i]));
export const lineOf = (code: string): Line => POSITIONS.find((p) => p.code === code)?.line ?? "MID";

export const LINES: { key: Line; label: string; plural: string; slug: string }[] = [
  { key: "GK", label: "Portero", plural: "Porteros", slug: "porteros" },
  { key: "DEF", label: "Defensa", plural: "Defensas", slug: "defensas" },
  { key: "MID", label: "Centrocampista", plural: "Centrocampistas", slug: "medios" },
  { key: "FWD", label: "Delantero", plural: "Delanteros", slug: "delanteros" },
];
export const LINE_LABEL = Object.fromEntries(LINES.map((l) => [l.key, l.label])) as Record<Line, string>;
export const lineFromSlug = (s?: string | null) => LINES.find((l) => l.slug === s)?.key ?? null;

/** Color de cada línea (el código de color habitual en las apps de fútbol). */
export const LINE_TONE: Record<Line, { chip: string; dot: string; hex: string }> = {
  GK: { chip: "bg-amber-400 text-negro", dot: "bg-amber-400", hex: "#F59E0B" },
  DEF: { chip: "bg-sky-600 text-white", dot: "bg-sky-600", hex: "#0284C7" },
  MID: { chip: "bg-emerald-600 text-white", dot: "bg-emerald-600", hex: "#059669" },
  FWD: { chip: "bg-rojo text-white", dot: "bg-rojo", hex: "#D20D17" },
};

export const STATUSES: { key: SquadStatus; label: string; slug: string }[] = [
  { key: "active", label: "Activo", slug: "activos" },
  { key: "injured", label: "Lesionado", slug: "lesionados" },
  { key: "away", label: "Baja temporal", slug: "baja-temporal" },
  { key: "left", label: "Baja definitiva", slug: "bajas" },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label])) as Record<SquadStatus, string>;
export const statusFromSlug = (s?: string | null) => STATUSES.find((x) => x.slug === s)?.key ?? null;
export const STATUS_TONE: Record<SquadStatus, string> = {
  active: "bg-green-100 text-green-800",
  injured: "bg-rojo/10 text-rojo",
  away: "bg-amber-100 text-amber-800",
  left: "bg-black/10 text-negro/60",
};

export const FOOT_LABEL: Record<Foot, string> = { right: "Diestro", left: "Zurdo", both: "Ambidiestro" };
export const ARMBAND_LABEL = { captain: "Capitán", vice: "Segundo capitán" } as const;

export const fullName = (p: Pick<Player, "first_name" | "last_name">) => `${p.first_name} ${p.last_name}`.trim();
/** Nombre corto para la camiseta y los cromos: el apodo o el primer apellido. */
export const shirtName = (p: Pick<Player, "first_name" | "last_name" | "nickname">) =>
  p.nickname?.trim() || p.last_name.split(/\s+/)[0] || p.first_name;

export function ageOf(birth: string | null | undefined, on = new Date()): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split("-").map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

const LINE_ORDER: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/** Orden de la plantilla: por línea (portero → delantero), luego dorsal y nombre. */
export function sortRoster<T extends { position: string; number: number | null; player: Player }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      LINE_ORDER[lineOf(a.position)] - LINE_ORDER[lineOf(b.position)] ||
      (a.number ?? 100) - (b.number ?? 100) ||
      fullName(a.player).localeCompare(fullName(b.player), "es"),
  );
}

/** Temporada en la URL: "2026/27" <-> "2026-27". */
export const seasonSlug = (s: string) => s.replace("/", "-");
export const seasonFromSlug = (s?: string | null) => (s && /^\d{4}-\d{2}$/.test(s) ? s.replace("-", "/") : null);

/** "2026/27" -> "2027/28" */
export const nextSeason = (s: string) => {
  const y = Number(s.slice(0, 4)) + 1;
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
};
/** "2026/27" -> "2025/26" */
export const prevSeason = (s: string) => {
  const y = Number(s.slice(0, 4)) - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
};
/** Primer día de la temporada: "2026/27" -> "2026-09-01" */
export const seasonStart = (s: string) => `${s.slice(0, 4)}-09-01`;
