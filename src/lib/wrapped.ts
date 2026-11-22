/**
 * Rayo Wrapped (4.23.0): la temporada de cada jugador contada en historias, como el resumen anual
 * de Spotify. Puro, con pruebas. Los números salen de playerSummary (season-summary.ts), aquí solo
 * se añade lo que el resumen no tenía (el socio de gol, con y sin él) y se escriben los textos, que
 * son los mismos en la pantalla y en la imagen para compartir.
 */
import { playerSummary, teamSummary, type BestMatch, type PlayerSummary, type SumApp, type SumCallup, type SumGoal, type SumMatch } from "./season-summary.ts";
import { TOP_VISIBLE, fmtScore, scoreWord } from "./ratings.ts";

export type SlideKey = "intro" | "partidos" | "goles" | "porteria" | "socio" | "mejor" | "mvp" | "talisman" | "titulo";
export const SLIDE_KEYS: SlideKey[] = ["intro", "partidos", "goles", "porteria", "socio", "mejor", "mvp", "talisman", "titulo"];

/** Color de fondo de cada historia: negro con la franja, rojo o dorado. */
export type Tone = "negro" | "rojo" | "oro";

export type Slide = {
  key: SlideKey;
  tone: Tone;
  kicker: string;
  /** Lo grande: un número, un nombre o un título. */
  big: string;
  /** Si `big` es un número, para contarlo de 0 hacia arriba. */
  count?: number;
  unit?: string;
  lines: string[];
  /** Datos para el dibujo propio de cada historia. */
  extra?:
    | { kind: "calendar"; games: { result: "W" | "D" | "L"; played: boolean }[] }
    | { kind: "balls"; goals: number; assists: number }
    | { kind: "partner"; me: string; partner: string; got: number; gave: number }
    | { kind: "score"; home: string; away: string; homeGoals: number; awayGoals: number; homeUs: boolean; date: string; mvp: boolean }
    | { kind: "stars"; n: number }
    | { kind: "bars"; withPct: number; withoutPct: number | null }
    | { kind: "card" };
};

export type GoalPartner = { id: string; together: number; got: number; gave: number };

/**
 * El compañero con el que más goles ha combinado (él asiste y yo marco, o al revés).
 * Empate: el que más me ha asistido; si sigue, el primero en la lista de goles.
 */
export function goalPartner(playerId: string, goals: SumGoal[]): GoalPartner | null {
  const by = new Map<string, GoalPartner>();
  for (const g of goals) {
    let other: string | null = null;
    let got = 0, gave = 0;
    if (g.scorer_id === playerId && g.assist_id && g.assist_id !== playerId) { other = g.assist_id; got = 1; }
    else if (g.assist_id === playerId && g.scorer_id && g.scorer_id !== playerId) { other = g.scorer_id; gave = 1; }
    if (!other) continue;
    const p = by.get(other) ?? { id: other, together: 0, got: 0, gave: 0 };
    p.together++; p.got += got; p.gave += gave;
    by.set(other, p);
  }
  let best: GoalPartner | null = null;
  for (const p of by.values()) if (!best || p.together > best.together || (p.together === best.together && p.got > best.got)) best = p;
  return best;
}

/** Victorias del equipo con él en el campo y sin él. */
export function withWithout(playerId: string, matches: SumMatch[], apps: SumApp[]) {
  const played = matches.filter((m) => m.status === "played" && m.goals_for != null && m.goals_against != null);
  const mine = new Set(apps.filter((a) => a.player_id === playerId).map((a) => a.match_id));
  const r = { withW: 0, withN: 0, withoutW: 0, withoutN: 0 };
  for (const m of played) {
    const won = m.goals_for! > m.goals_against!;
    if (mine.has(m.id)) { r.withN++; if (won) r.withW++; }
    else { r.withoutN++; if (won) r.withoutW++; }
  }
  return r;
}

export type SeasonRatingOf = { avg: number; matches: number; best: number; rank: number | null };

export type WrappedInput = {
  playerId: string;
  /** El que mira es el propio jugador: se le habla de tú. */
  you: boolean;
  /** Nombre de camiseta del jugador. */
  name: string;
  /** «Apertura 2026-27» o «temporada 2026-27». */
  scope: string;
  /** El nombre del alcance en corto para el titular («Tu Apertura», «Tu temporada»). */
  scopeShort: string;
  gk: boolean;
  data: { matches: SumMatch[]; apps: SumApp[]; goals: SumGoal[]; callups: SumCallup[] };
  /** Nombres de camiseta de la plantilla, para el socio. */
  names: Map<string, string>;
  rating: SeasonRatingOf | null;
};

const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);
const ord = (n: number) => `${n}º`;
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const scoreLine = (m: BestMatch["match"]) => (m.is_home ? `Rayo ${m.goals_for}-${m.goals_against} ${m.rival}` : `${m.rival} ${m.goals_against}-${m.goals_for} Rayo`);

/** «7 nov» */
function day(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
}

/** Las historias de un jugador, en orden. Las que no tienen nada que contar no salen. */
export function wrappedSlides(i: WrappedInput): { slides: Slide[]; summary: PlayerSummary } {
  const s = playerSummary(i.playerId, i.data);
  const team = teamSummary(i.data.matches);
  // Hablar de tú al propio jugador y en tercera persona a los demás
  const v = (you: string, other: string) => (i.you ? you : other);
  const slides: Slide[] = [];

  slides.push({
    key: "intro", tone: "negro", kicker: "RAYO WRAPPED",
    big: v(`Tu ${i.scopeShort}`, i.name),
    lines: [v(`Lo que ha dado de sí ${i.scope.startsWith("temporada") ? "la" : "el"} ${i.scope}. Dale.`, `Así fue ${i.scope.startsWith("temporada") ? "la" : "el"} ${i.scope} de ${i.name}.`)],
  });

  // Partidos jugados, con el calendario del equipo
  const played = i.data.matches.filter((m) => m.status === "played" && m.goals_for != null && m.goals_against != null);
  const mineIds = new Set(i.data.apps.filter((a) => a.player_id === i.playerId).map((a) => a.match_id));
  const partidos: string[] = [];
  if (s.apps === 0) partidos.push(v("Esta vez te tocó animar desde la banda.", "Esta vez le tocó animar desde la banda."));
  else {
    partidos.push(s.apps === team.played ? `Todos los que jugó el equipo (${team.played})` : `De los ${team.played} que jugó el equipo`);
    if (s.appsRank === 1 && s.apps < team.played) partidos.push(v("Nadie jugó más que tú", "Nadie jugó más"));
    else if (s.appsRank && s.appsRank > 1 && s.appsRank <= 3) partidos.push(`El ${ord(s.appsRank)} que más jugó`);
  }
  if (s.called) partidos.push(v(`Dijiste «Voy» a ${s.said_yes} de ${s.called} ${pl(s.called, "convocatoria", "convocatorias")}`, `Dijo «Voy» a ${s.said_yes} de ${s.called} ${pl(s.called, "convocatoria", "convocatorias")}`));
  slides.push({
    key: "partidos", tone: "rojo", kicker: "SOBRE EL CÉSPED", big: String(s.apps), count: s.apps, unit: pl(s.apps, "partido", "partidos"), lines: partidos,
    extra: { kind: "calendar", games: played.map((m) => ({ result: m.goals_for! > m.goals_against! ? "W" : m.goals_for! < m.goals_against! ? "L" : "D", played: mineIds.has(m.id) })) },
  });

  // Goles y asistencias (los porteros, si no marcan, tienen la suya)
  if (s.goals + s.assists > 0) {
    const lead = s.goals > 0;
    const lines: string[] = [];
    if (lead && s.assists) lines.push(`y ${s.assists} ${pl(s.assists, "asistencia", "asistencias")}`);
    if (s.goalsRank === 1) lines.push("Máximo goleador del equipo");
    else if (s.goalsRank) lines.push(`${ord(s.goalsRank)} goleador del equipo`);
    else if (s.assistsRank === 1) lines.push("Nadie dio más pases de gol");
    if (team.gf) lines.push(v(`Metiste mano en el ${pct(s.goals + s.assists, team.gf)} % de los goles del Rayo`, `Metió mano en el ${pct(s.goals + s.assists, team.gf)} % de los goles del Rayo`));
    slides.push({
      key: "goles", tone: "negro", kicker: lead ? "GOLES" : "PASES DE GOL",
      big: String(lead ? s.goals : s.assists), count: lead ? s.goals : s.assists,
      unit: lead ? pl(s.goals, "gol", "goles") : pl(s.assists, "asistencia", "asistencias"), lines,
      extra: { kind: "balls", goals: s.goals, assists: s.assists },
    });
  }

  if (s.gkApps > 0 && (i.gk || s.gkApps >= 2)) {
    const zero = s.cleanSheets > 0;
    slides.push({
      key: "porteria", tone: "oro", kicker: "BAJO PALOS",
      big: String(zero ? s.cleanSheets : s.gkApps), count: zero ? s.cleanSheets : s.gkApps,
      unit: zero ? pl(s.cleanSheets, "portería a cero", "porterías a cero") : pl(s.gkApps, "partido de portero", "partidos de portero"),
      lines: [
        ...(zero ? [`En ${s.gkApps} ${pl(s.gkApps, "partido", "partidos")} de portero`] : []),
        `${s.conceded} ${pl(s.conceded, "gol encajado", "goles encajados")} · ${fmtScore(s.conceded / s.gkApps, 1)} por partido`,
      ],
    });
  }

  const partner = goalPartner(i.playerId, i.data.goals.filter((g) => played.some((m) => m.id === g.match_id)));
  const pName = partner ? i.names.get(partner.id) : null;
  if (partner && pName) {
    const parts = [
      partner.got ? v(`${pName} te dio ${partner.got} ${pl(partner.got, "pase de gol", "pases de gol")}`, `${pName} le dio ${partner.got} ${pl(partner.got, "pase de gol", "pases de gol")}`) : null,
      partner.gave ? v(`tú le diste ${partner.gave}`, `${i.name} le dio ${partner.gave}`) : null,
    ].filter(Boolean) as string[];
    slides.push({
      key: "socio", tone: "rojo", kicker: v("TU SOCIO DE GOL", "SU SOCIO DE GOL"), big: pName,
      lines: [`${partner.together} ${pl(partner.together, "gol juntos", "goles juntos")}`, parts.join(parts.length > 1 && i.you ? " y " : " · ")],
      extra: { kind: "partner", me: i.name, partner: pName, got: partner.got, gave: partner.gave },
    });
  }

  const b = s.best && (s.best.goals || s.best.assists || s.best.mvp) ? s.best : null;
  if (b) {
    const m = b.match;
    slides.push({
      key: "mejor", tone: "negro", kicker: v("TU MEJOR PARTIDO", "SU MEJOR PARTIDO"), big: scoreLine(m),
      lines: [b.goals || b.assists
        ? [b.goals ? `${b.goals} ${pl(b.goals, "gol", "goles")}` : null, b.assists ? `${b.assists} ${pl(b.assists, "asistencia", "asistencias")}` : null, b.mvp ? "MVP" : null].filter(Boolean).join(" · ")
        : "Elegido MVP del partido"],
      extra: {
        kind: "score", home: m.is_home ? "Rayo" : m.rival, away: m.is_home ? m.rival : "Rayo",
        homeGoals: m.is_home ? m.goals_for! : m.goals_against!, awayGoals: m.is_home ? m.goals_against! : m.goals_for!, homeUs: m.is_home, date: day(m.match_date), mvp: b.mvp,
      },
    });
  }

  // El vestuario: MVP votados y la nota media
  const r = i.rating;
  if (s.mvps > 0 || r) {
    const lines: string[] = [];
    if (s.mvps > 0 && r) lines.push(`Nota media ${fmtScore(r.avg, 1)} · ${scoreWord(r.avg)}`);
    if (r?.rank === 1) lines.push("La mejor nota del equipo");
    else if (r?.rank && r.rank <= TOP_VISIBLE) lines.push(`${ord(r.rank)} mejor nota del equipo`); // solo el podio (4.28.1)
    if (s.mvps === 0 && r) lines.push(v(`Tu mejor nota en un partido: ${fmtScore(r.best, 1)}`, `Su mejor nota en un partido: ${fmtScore(r.best, 1)}`));
    slides.push(s.mvps > 0
      ? { key: "mvp", tone: "oro", kicker: "EL VESTUARIO HABLA", big: String(s.mvps), count: s.mvps, unit: pl(s.mvps, "vez MVP", "veces MVP"), lines: [v("Elegido por tus compañeros", "Elegido por sus compañeros"), ...lines], extra: { kind: "stars", n: s.mvps } }
      : { key: "mvp", tone: "oro", kicker: "EL VESTUARIO HABLA", big: fmtScore(r!.avg, 1), unit: "de nota media", lines: [`${scoreWord(r!.avg)} · ${v("te puntuaron", "le puntuaron")} en ${r!.matches} ${pl(r!.matches, "partido", "partidos")}`, ...lines] });
  }

  // Talismán: cómo le fue al equipo con él y sin él
  const ww = withWithout(i.playerId, i.data.matches, i.data.apps);
  if (ww.withW > 0) {
    const withPct = pct(ww.withW, ww.withN);
    const withoutPct = ww.withoutN ? pct(ww.withoutW, ww.withoutN) : null;
    slides.push({
      key: "talisman", tone: "negro", kicker: "TALISMÁN", big: `${withPct} %`, count: withPct, unit: v("de victorias contigo en el campo", "de victorias con él en el campo"),
      lines: [
        `${ww.withW} ${pl(ww.withW, "victoria", "victorias")} en ${ww.withN} ${pl(ww.withN, "partido", "partidos")}`,
        withoutPct === null ? v("Estuviste en todos", "Estuvo en todos") : v(`Sin ti: ${withoutPct} % (${ww.withoutW} de ${ww.withoutN})`, `Sin él: ${withoutPct} % (${ww.withoutW} de ${ww.withoutN})`),
      ],
      extra: { kind: "bars", withPct, withoutPct },
    });
  }

  slides.push({ key: "titulo", tone: "oro", kicker: v("TU TÍTULO", "SU TÍTULO"), big: s.badge.title, lines: [s.badge.line], extra: { kind: "card" } });
  return { slides, summary: s };
}
