/**
 * Lectura de las páginas de la web de la liga (futormes.com, hecha con ServerSports).
 *
 * Aquí solo hay funciones puras: reciben el HTML y devuelven datos. No piden nada
 * a internet ni tocan la base de datos, para poder probarlas con páginas guardadas
 * (src/lib/__tests__/fixtures/futormes) y detectar a tiempo si la liga cambia su web.
 *
 * Cada lector tiene su «inspector»: además de los datos, cuenta cuántas filas
 * parecían de verdad (por ejemplo, cuántas fechas hay en el calendario) y cuántas
 * no se han podido leer. Si la web cambia, la diferencia salta como incidencia.
 */

export type LeagueRow = {
  extId: string;
  round: string;
  date: string;          // "2026-11-08"
  time: string | null;   // "18:00"
  venue: string | null;  // "La Aldehuela A1"
  address: string | null;
  homeId: string;
  homeName: string;
  awayId: string;
  awayName: string;
  goalsHome: number | null;
  goalsAway: number | null;
  status: "played" | "scheduled" | "postponed" | "cancelled";
};

/** Resultado de leer una página: los datos y lo que no cuadra. */
export type Parsed<T> = { items: T[]; expected: number; skipped: number; issues: string[] };

const ENTITIES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  ordf: "ª", ordm: "º", middot: "·",
};

export const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n] ?? m)
    .replace(/\s+/g, " ").trim();

/** Número de competición a partir de la dirección que se pega ("…situation.aspx?itm=15868") o del número suelto. */
export function competitionFromUrl(input: string): string | null {
  const s = input.trim();
  if (/^\d{1,9}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)futormes\.com$/i.test(u.hostname)) return null;
    const itm = u.searchParams.get("itm");
    return itm && /^\d{1,9}$/.test(itm) ? itm : null;
  } catch {
    return null;
  }
}

/** Nombre de la competición en la portada («Situación»). */
export function parseCompetitionName(situation: string): string | null {
  return decode(situation).match(/Campeonato:(?:<\/b>)?\s*([^"<]{3,160})/)?.[1]?.trim() ?? null;
}

// ---------------------------------------------------------------- Nombres

/** "PIZA 1904-BAR KFETÍN" -> "Piza 1904-Bar Kfetín"; las siglas (CF, FC, CB…) se quedan en mayúsculas. */
export function prettyTeam(name: string) {
  const keep = /^(CF|FC|CD|UD|AD|SD|CB|RL|BZ|CP|SAD|UDS|AT|II|III|IV|F7)\.?$/i;
  return titleCase(name, keep);
}

/** Mayúscula inicial en cada palabra, salvo las partículas ("de", "del", "la") y las siglas. */
export function titleCase(name: string, keep = /^$/) {
  const small = /^(de|del|la|las|los|y|e)$/;
  return name
    .toLowerCase()
    .replace(/(^|[\s\-/(.])([\p{L}\d]+)/gu, (m, sep: string, w: string, off: number) =>
      sep + (keep.test(w) ? w.toUpperCase() : off > 0 && sep === " " && small.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .replace(/\bC\.b\b/g, "C.B");
}

// ---------------------------------------------------------------- Calendario (calendar.aspx)

const field = (row: string, key: string) => row.match(new RegExp(`_${key}"[^>]*>([^<]*)<`))?.[1];

const validDate = (y: string | undefined, m: string | undefined, d: string | undefined) => {
  if (!y || !m || !d || !/^\d{4}$/.test(y) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return null;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const t = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null;
};

export function inspectCalendar(calendar: string): Parsed<LeagueRow> {
  const items: LeagueRow[] = [];
  const issues: string[] = [];
  const sections = calendar.split(/rptCalendarioJornada_ctl\d+_lblJornada"[^>]*>/).slice(1);
  // Filas que tienen pinta de partido aunque no se puedan leer
  // (la cabecera de la web también tiene un «ctl00_lblFecha» con el día de hoy: ese no cuenta)
  const expected = (calendar.match(/_ctl\d+_lblFecha"/g) ?? []).length;
  let skipped = 0;
  for (const sec of sections) {
    const round = decode(sec.slice(0, sec.indexOf("<")));
    for (const tr of sec.split(/<tr[\s>]/).slice(1)) {
      if (!tr.includes("_lblFecha")) continue;
      const fecha = field(tr, "lblFecha");
      const local = tr.match(/_hlkLocal" title="([^"]*)" href="team\.aspx\?itm=(\d+)"/);
      const visit = tr.match(/_hlkVisitante" title="([^"]*)" href="team\.aspx\?itm=(\d+)"/);
      const id = tr.match(/_hlkPartido"[^>]*href="match\.aspx\?itm=(\d+)"/)?.[1];
      const [d, m, y] = (fecha ?? "").trim().split(".");
      const date = validDate(y, m, d);
      if (!date || !local || !visit || !id) {
        skipped++;
        continue;
      }
      const time = field(tr, "lblHora")?.trim() || null;
      const campo = tr.match(/_lblCampo" title="([^"]*)"/)?.[1];
      const parts = campo ? decode(campo).split(" · ") : [];
      const score = field(tr, "lblMarcador")?.match(/(\d+)\s*-\s*(\d+)/);
      const state = (tr.match(/_imgFinalizado" title="([^"]*)"/)?.[1] ?? "").toLowerCase();
      items.push({
        extId: id,
        round: round || "Jornada",
        date,
        time: time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : null,
        venue: parts[0] || null,
        address: parts.length > 1 ? parts.slice(1).join(", ") : null,
        homeId: local[2],
        homeName: decode(local[1]),
        awayId: visit[2],
        awayName: decode(visit[1]),
        goalsHome: score ? Number(score[1]) : null,
        goalsAway: score ? Number(score[2]) : null,
        status: state.includes("aplazado") ? "postponed" : state.includes("suspendido") ? "cancelled" : state.includes("finalizado") && score ? "played" : "scheduled",
      });
    }
  }
  if (!sections.length) issues.push("Calendario: no aparecen las jornadas (la web de la liga ha cambiado su calendario).");
  else if (!expected) issues.push("Calendario: hay jornadas pero ninguna fecha de partido (la web de la liga ha cambiado su calendario).");
  if (skipped) issues.push(`Calendario: ${skipped} de ${expected} partidos no se han podido leer (faltan fecha, equipos o enlace del partido).`);
  // Fechas que no se han contado porque cayeron fuera de una jornada
  const outside = expected - items.length - skipped;
  if (sections.length && outside > 0) issues.push(`Calendario: ${outside} partidos aparecen fuera de las jornadas.`);
  return { items, expected, skipped, issues };
}

export const parseCalendar = (calendar: string) => inspectCalendar(calendar).items;

// ---------------------------------------------------------------- Clasificación (table.aspx)

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

const n = (v: string | undefined) => (v && /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : 0);
const isInt = (v: string | undefined) => !!v && /^-?\d+$/.test(v.trim());

/** "ACCESO 4ª DIV. CLAUSURA" -> "Acceso 4ª Div. Clausura" */
export const zoneLabel = (s: string) => {
  const t = s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/ (A|De|Del|La) /g, (m) => m.toLowerCase());
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function inspectTable(html: string): Parsed<Omit<StandingRow, "form">> {
  const issues: string[] = [];
  const start = html.indexOf('id="ctl00_ContentPlaceHolder1_dgrClasificacion"');
  if (start < 0) return { items: [], expected: 0, skipped: 0, issues: ["Clasificación: no aparece la tabla (la web de la liga ha cambiado la clasificación)."] };
  const body = html.slice(start);
  const idx = [...new Set([...body.matchAll(/dgrClasificacion_(ctl\d+)_lblOrden"/g)].map((m) => m[1]))];
  const items: Omit<StandingRow, "form">[] = [];
  let skipped = 0, blankNumbers = 0;
  for (const k of idx) {
    const p = `dgrClasificacion_${k}_`;
    const lbl = (name: string) => body.match(new RegExp(`${p}${name}"[^>]*>([^<]*)<`))?.[1];
    const team = body.match(new RegExp(`${p}hlkEquipo" title="([^"]*)" href="team\\.aspx\\?itm=(\\d+)"`));
    if (!team) {
      skipped++;
      continue;
    }
    if (!["lblOrden", "lblPartidosJugados", "lblPuntos"].every((f) => isInt(lbl(f)))) blankNumbers++;
    const ind = body.match(new RegExp(`${p}pnlIndicador" title="([^"]*)" style="background-color:(#[0-9A-Fa-f]{3,6})`));
    const status = body.match(new RegExp(`${p}imgStatus" title="([^"]*)"`))?.[1] ?? "";
    const steps = n(status.match(/(\d+)/)?.[1]);
    items.push({
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
  if (!idx.length) issues.push("Clasificación: la tabla está pero no tiene filas (la web de la liga ha cambiado la clasificación).");
  if (skipped) issues.push(`Clasificación: ${skipped} de ${idx.length} equipos no se han podido leer.`);
  if (blankNumbers) issues.push(`Clasificación: ${blankNumbers} equipos sin posición, partidos o puntos.`);
  return { items: items.sort((a, b) => a.pos - b.pos), expected: idx.length, skipped, issues };
}

export const parseTable = (html: string) => inspectTable(html).items;

// ---------------------------------------------------------------- Plantilla (team.aspx y player.aspx)

export type LeaguePlayer = {
  extId: string; name: string; number: number | null; nickname: string | null; line: "POR" | "DFC" | "MCD" | "DC";
  foot: "right" | "left" | "both" | null; birth: string | null; height: number | null;
  apps: number; goals: number; conceded: number; yellows: number; reds: number;
};

/** Jugadores de la ficha del equipo (sus números en la web de la liga). */
export function inspectTeam(html: string): Parsed<string> {
  const items = [...new Set([...html.matchAll(/dgrJugadores_ctl\d+_hlkJugador"[^>]*href="player\.aspx\?itm=(\d+)"/g)].map((m) => m[1]))];
  const expected = new Set([...html.matchAll(/dgrJugadores_(ctl\d+)_hlkJugador"/g)].map((m) => m[1])).size;
  const issues: string[] = [];
  if (!items.length) issues.push("Plantilla: la ficha del equipo no muestra jugadores (la web de la liga ha cambiado la plantilla).");
  else if (expected > items.length) issues.push(`Plantilla: ${expected - items.length} de ${expected} jugadores sin enlace a su ficha.`);
  return { items, expected: Math.max(expected, items.length), skipped: Math.max(0, expected - items.length), issues };
}

export const parseTeamPlayerIds = (html: string) => inspectTeam(html).items;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const lbl = (html: string, id: string) => {
  const m = html.match(new RegExp(`id="ctl00_ContentPlaceHolder1_${id}"[^>]*>([^<]*)<`));
  return m ? decode(m[1]) : "";
};
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : null);

export function parsePlayer(extId: string, html: string): LeaguePlayer | null {
  const name = lbl(html, "lblJugadorInfoNombre");
  if (!name) return null;
  const nick = lbl(html, "lblApodo");
  const line = ({ portero: "POR", defensa: "DFC", centrocampista: "MCD", delantero: "DC" } as const)[lbl(html, "lblDemaracion").toLowerCase() as "portero"] ?? "MCD";
  const foot = ({ diestro: "right", zurdo: "left", ambidiestro: "both" } as const)[lbl(html, "lblLateralidad").toLowerCase() as "diestro"] ?? null;
  const b = lbl(html, "lblFechaNacimiento").match(/(\d{1,2}) de (\p{L}+) de (\d{4})/u);
  const mi = b ? MONTHS.indexOf(b[2].toLowerCase()) : -1;
  const height = num(lbl(html, "lblAltura"));
  return {
    extId, name: titleCase(name), number: num(lbl(html, "lblDorsal")),
    nickname: nick && !/^sin (definir|apodo)$/i.test(nick) ? nick.slice(0, 24) : null,
    line, foot,
    birth: b && mi >= 0 ? `${b[3]}-${String(mi + 1).padStart(2, "0")}-${b[1].padStart(2, "0")}` : null,
    height: height && height >= 120 && height <= 230 ? height : null,
    apps: num(lbl(html, "lblEstadisticasPartidosJugados")) ?? 0,
    goals: num(lbl(html, "lblEstadisticasGolesMarcados")) ?? 0,
    conceded: num(lbl(html, "lblEstadisticasGolesRecibidos")) ?? 0,
    yellows: num(lbl(html, "lblEstadisticasTarjetasAmarillas")) ?? 0,
    reds: num(lbl(html, "lblEstadisticasTarjetasRojas")) ?? 0,
  };
}

/** Comprueba la ficha de un jugador: que se lea el nombre y que estén los contadores de la temporada. */
export function inspectPlayer(extId: string, html: string): { player: LeaguePlayer | null; issues: string[] } {
  const player = parsePlayer(extId, html);
  if (!player) return { player, issues: ["Ficha de jugador: no aparece el nombre (la web de la liga ha cambiado las fichas)."] };
  const missing = ["lblEstadisticasPartidosJugados", "lblEstadisticasGolesMarcados"].filter((id) => !html.includes(`ctl00_ContentPlaceHolder1_${id}"`));
  return { player, issues: missing.length ? ["Ficha de jugador: no aparecen los partidos jugados ni los goles; las estadísticas de la liga se quedarían a cero."] : [] };
}

// ---------------------------------------------------------------- Ficha de un partido (match.aspx)

export type SheetRow = { extId: string; name: string; number: number | null; goals: number; conceded: number | null; yellows: number; red: boolean };

/**
 * Jugadores de un lado de la ficha: «L» local, «V» visitante.
 * Se lee fila a fila (por su «ctlNN»): a los goleadores la web les pone el número en
 * negrita (`lblGoles" style="font-weight:bold;"`) y una expresión única para toda la
 * tabla se saltaba esas filas y mezclaba al jugador con el siguiente.
 */
export function inspectSheet(html: string, side: "L" | "V"): Parsed<SheetRow> {
  const items: SheetRow[] = [];
  const keys = [...new Set([...html.matchAll(new RegExp(`dgrJugadores${side}_(ctl\\d+)_lblDorsal"`, "g"))].map((m) => m[1]))];
  let skipped = 0;
  for (const k of keys) {
    const p = `dgrJugadores${side}_${k}_`;
    const val = (f: string) => html.match(new RegExp(`${p}${f}"[^>]*>([^<]*)<`))?.[1]?.trim() ?? null;
    const player = html.match(new RegExp(`${p}hlkJugador" title="([^"]*)" href="player\\.aspx\\?itm=(\\d+)"`));
    const goals = val("lblGoles");
    const conceded = val("lblGolesRecibidos");
    if (!player || goals == null || conceded == null) {
      skipped++;
      continue;
    }
    const at = html.indexOf(`${p}pnlAmonestaciones"`);
    const close = at < 0 ? -1 : html.indexOf("</div>", at);
    const cards = close < 0 ? "" : html.slice(at, close);
    const yr = (cards.match(/card_(?:yellow_?red|double)/gi) ?? []).length;
    const reds = (cards.match(/card_red/gi) ?? []).length;
    const yellows = Math.min(2, (cards.match(/card_yellow(?!_?red)/gi) ?? []).length + yr * 2);
    const dorsal = val("lblDorsal") ?? "";
    items.push({
      extId: player[2],
      name: decode(player[1]).trim(),
      number: /^\d+$/.test(dorsal) ? Number(dorsal) : null,
      goals: /^\d+$/.test(goals) ? Number(goals) : 0,
      conceded: /^\d+$/.test(conceded) ? Number(conceded) : null,
      yellows,
      red: reds > 0 || yr > 0,
    });
  }
  const issues: string[] = [];
  const who = side === "L" ? "local" : "visitante";
  if (skipped) issues.push(`Ficha del partido: ${skipped} de ${keys.length} jugadores del equipo ${who} no se han podido leer.`);
  return { items, expected: keys.length, skipped, issues };
}

export const parseSheet = (html: string, side: "L" | "V") => inspectSheet(html, side).items;
