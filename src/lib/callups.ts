import { CLUB_NAME, hhmm, longDay, type MatchRow } from "@/lib/matches";
import { lineOf, shirtName, type Line, type Player, type SquadStatus } from "@/lib/squad";

export type Reply = "pending" | "yes" | "no" | "maybe";

export type Callup = {
  id: string;
  match_id: string;
  player_id: string;
  reply: Reply;
  reply_note: string | null;
  replied_at: string | null;
  replied_by: string | null;
  slot: number | null;
};

/** Convocado con su ficha y su dorsal/posición de la temporada del partido. */
export type CallupRow = Callup & {
  player: Player;
  number: number | null;
  position: string;
  status: SquadStatus | null;
};

export const REPLIES: { key: Exclude<Reply, "pending">; label: string; emoji: string; tone: string; on: string }[] = [
  { key: "yes", label: "Voy", emoji: "✅", tone: "bg-green-100 text-green-800", on: "bg-green-600 text-white ring-green-700" },
  { key: "maybe", label: "Duda", emoji: "🤔", tone: "bg-amber-100 text-amber-800", on: "bg-amber-500 text-negro ring-amber-600" },
  { key: "no", label: "No voy", emoji: "❌", tone: "bg-rojo/10 text-rojo", on: "bg-rojo text-white ring-rojo" },
];
export const REPLY_LABEL: Record<Reply, string> = { pending: "Sin responder", yes: "Va", maybe: "Duda", no: "No va" };
export const REPLY_TONE: Record<Reply, string> = {
  pending: "bg-black/10 text-negro/70",
  yes: "bg-green-100 text-green-800",
  maybe: "bg-amber-100 text-amber-800",
  no: "bg-rojo/10 text-rojo",
};

/** Sistemas de fútbol 7: seis jugadores de campo más el portero. */
export const FORMATIONS = ["3-2-1", "2-3-1", "3-1-2", "2-2-2", "3-3"] as const;
export const DEFAULT_FORMATION = "3-2-1";
export const isFormation = (f: string | null | undefined): f is (typeof FORMATIONS)[number] => !!f && (FORMATIONS as readonly string[]).includes(f);

export type SlotSpot = { slot: number; line: Line; label: string; x: number; y: number };

/**
 * Huecos de la alineación sobre el campo (x e y en %, portería abajo).
 * El 1 es el portero; luego cada línea de atrás adelante y de izquierda a derecha.
 */
export function slotsOf(formation: string | null | undefined): SlotSpot[] {
  const f = isFormation(formation) ? formation : DEFAULT_FORMATION;
  const lines = f.split("-").map(Number);
  const kinds: Line[] = lines.length === 2 ? ["DEF", "FWD"] : ["DEF", "MID", "FWD"];
  const ys = lines.length === 2 ? [66, 30] : [68, 46, 22];
  const labels: Record<Line, string> = { GK: "POR", DEF: "DEF", MID: "MED", FWD: "DEL" };
  const out: SlotSpot[] = [{ slot: 1, line: "GK", label: "POR", x: 50, y: 88 }];
  let n = 2;
  lines.forEach((count, i) => {
    for (let k = 0; k < count; k++) {
      out.push({ slot: n++, line: kinds[i], label: labels[kinds[i]], x: ((k + 1) * 100) / (count + 1), y: ys[i] });
    }
  });
  return out;
}

export function tally(rows: Pick<Callup, "reply">[]) {
  const t = { yes: 0, maybe: 0, no: 0, pending: 0, total: rows.length };
  for (const r of rows) t[r.reply]++;
  return t;
}

const LINE_ORDER: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
/** Por línea (portero primero) y dorsal. */
export function sortCallups<T extends { position: string; number: number | null; player: Player }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    LINE_ORDER[lineOf(a.position)] - LINE_ORDER[lineOf(b.position)]
    || (a.number ?? 999) - (b.number ?? 999)
    || shirtName(a.player).localeCompare(shirtName(b.player), "es"));
}

/** Convocatoria lista para pegar en el grupo de WhatsApp. */
export function callupShareText(m: MatchRow, rows: CallupRow[], url?: string) {
  const vs = m.is_home ? `${CLUB_NAME} vs ${m.rival.name}` : `${m.rival.name} vs ${CLUB_NAME}`;
  const list = sortCallups(rows).map((r) => `${r.number != null ? `${r.number}. ` : "• "}${shirtName(r.player)}${lineOf(r.position) === "GK" ? " (POR)" : ""}`);
  const when = `${longDay(m.match_date)}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}`;
  return [
    `⚽ *CONVOCATORIA* · ${vs}`,
    `📅 ${when.charAt(0).toUpperCase()}${when.slice(1)}`,
    m.venue ? `📍 ${m.venue}` : null,
    m.meet_time || m.meet_place ? `🕒 Quedamos${m.meet_time ? ` a las ${hhmm(m.meet_time)}` : ""}${m.meet_place ? ` en ${m.meet_place}` : ""}` : null,
    "",
    `*Convocados (${rows.length})*`,
    ...list,
    m.callup_notes ? `\n📝 ${m.callup_notes}` : null,
    url ? `\nConfirma en la app: ${url}` : null,
  ].filter((x) => x !== null).join("\n");
}
