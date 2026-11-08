import "server-only";
import { unstable_cache } from "next/cache";
import { decode, openSession, parseCalendar, prettyTeam } from "@/lib/league-sync";

/**
 * Clasificación de la liga (futormes · table.aspx). Solo se lee: no se guarda en
 * la base de datos. Se guarda en caché media hora y se refresca al sincronizar.
 */

export type Outcome = "W" | "D" | "L";

export type StandingRow = {
  pos: number;
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  penalty: number;           // puntos de sanción
  points: number;
  move: number;              // + sube, − baja, 0 mantiene
  zone: { label: string; color: string } | null;
  form: Outcome[];           // últimos 5, del más antiguo al más reciente
};

export type LeagueTable = { competition: string | null; rows: StandingRow[]; round: string | null; fetchedAt: string };

export const TABLE_TAG = "league-table";

const n = (v: string | undefined) => (v && /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : 0);

export function parseTable(html: string): Omit<StandingRow, "form">[] {
  const start = html.indexOf('id="ctl00_ContentPlaceHolder1_dgrClasificacion"');
  if (start < 0) return [];
  const body = html.slice(start);
  const idx = [...new Set([...body.matchAll(/dgrClasificacion_(ctl\d+)_lblOrden"/g)].map((m) => m[1]))];
  const rows: Omit<StandingRow, "form">[] = [];
  for (const k of idx) {
    const p = `dgrClasificacion_${k}_`;
    const lbl = (name: string) => body.match(new RegExp(`${p}${name}"[^>]*>([^<]*)<`))?.[1];
    const team = body.match(new RegExp(`${p}hlkEquipo" title="([^"]*)" href="team\\.aspx\\?itm=(\\d+)"`));
    if (!team) continue;
    const ind = body.match(new RegExp(`${p}pnlIndicador" title="([^"]*)" style="background-color:(#[0-9A-Fa-f]{3,6})`));
    const status = body.match(new RegExp(`${p}imgStatus" title="([^"]*)"`))?.[1] ?? "";
    const steps = n(status.match(/(\d+)/)?.[1]);
    rows.push({
      pos: n(lbl("lblOrden")),
      teamId: team[2],
      name: prettyTeam(decode(team[1])),
      played: n(lbl("lblPartidosJugados")),
      won: n(lbl("lblPartidosGanados")),
      drawn: n(lbl("lblPartidosEmpatados")),
      lost: n(lbl("lblPartidosPerdidos")),
      gf: n(lbl("lblGolesAFavor")),
      ga: n(lbl("lblGolesEnContra")),
      gd: n(lbl("lblDiferenciaGoles")),
      penalty: n(lbl("lblPuntosSancion")),
      points: n(lbl("lblPuntos")),
      move: /sube/i.test(status) ? steps : /baja/i.test(status) ? -steps : 0,
      zone: ind ? { label: zoneLabel(decode(ind[1])), color: ind[2] } : null,
    });
  }
  return rows.sort((a, b) => a.pos - b.pos);
}

/** "ACCESO 4ª DIV. CLAUSURA" -> "Acceso 4ª Div. Clausura" */
const zoneLabel = (s: string) => {
  const t = s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/ (A|De|Del|La) /g, (m) => m.toLowerCase());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

async function load(competition: string): Promise<LeagueTable> {
  const sess = await openSession(competition);
  const [table, calendar] = await Promise.all([sess.get("table.aspx"), sess.get("calendar.aspx").catch(() => "")]);
  const base = parseTable(table);
  if (!base.length) throw new Error("No se ha encontrado la clasificación en la web de la liga.");

  // Racha de cada equipo y última jornada jugada, desde el calendario
  const games = parseCalendar(calendar).filter((r) => r.status === "played" && r.goalsHome != null && r.goalsAway != null)
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
  const form = new Map<string, Outcome[]>();
  const push = (team: string, o: Outcome) => form.set(team, [...(form.get(team) ?? []), o].slice(-5));
  for (const g of games) {
    const h = g.goalsHome!, a = g.goalsAway!;
    push(g.homeId, h > a ? "W" : h < a ? "L" : "D");
    push(g.awayId, a > h ? "W" : a < h ? "L" : "D");
  }
  const comp = decode(sess.situation).match(/Campeonato:(?:<\/b>)?\s*([^"<]{3,160})/)?.[1]?.trim() ?? null;
  return {
    competition: comp,
    round: games.at(-1)?.round ?? null,
    rows: base.map((r) => ({ ...r, form: form.get(r.teamId) ?? [] })),
    fetchedAt: new Date().toISOString(),
  };
}

const cached = unstable_cache(load, ["league-table-v1"], { revalidate: 1800, tags: [TABLE_TAG] });

/** Clasificación de la competición, o null si la web de la liga no responde. */
export async function getLeagueTable(competition: string): Promise<LeagueTable | null> {
  if (!/^\d{1,9}$/.test(competition)) return null;
  try {
    return await cached(competition);
  } catch (e) {
    console.error("No se ha podido leer la clasificación:", e instanceof Error ? e.message : e);
    return null;
  }
}
