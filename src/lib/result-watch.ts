/**
 * Vigilancia del resultado el día del partido (v3.19.0).
 *
 * Varias veces al día (ver vercel.json) se mira si hay un partido de liga de hoy, o de ayer,
 * que ya debería haber acabado y aún no tiene resultado. Solo entonces se lee la web de la
 * liga: en cuanto aparece el resultado se guarda y sale el aviso «Ya están los datos del partido».
 * Sin dependencias, para poder probarlo con `npm test`.
 */

/** Minutos desde el pitido a partir de los que se empieza a mirar (partido de F7 + margen). */
export const WAIT_AFTER_KICKOFF = 90;
/** Si el partido aún no tiene hora, se empieza a mirar a partir de esta hora de Madrid. */
export const NO_KICKOFF_FROM = "14:00";

export type WatchMatch = {
  id: string;
  match_date: string; // "2026-11-08"
  kickoff: string | null; // "18:30:00"
  status: string;
  competition: string;
  ext_id: string | null;
};

/** Fecha y hora de Madrid como "2026-11-08 18:30". */
export function madridNow(at: Date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const addMinutes = (date: string, hm: string, min: number) => {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m + min));
  return d.toISOString().slice(0, 16).replace("T", " ");
};

const dayBefore = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Partidos de liga de hoy o de ayer que ya deberían tener resultado y todavía no lo tienen. */
export function awaitingResult(matches: WatchMatch[], now = madridNow()) {
  const today = now.slice(0, 10);
  const yesterday = dayBefore(today);
  return matches.filter((m) => {
    if (m.competition !== "league" || !m.ext_id?.startsWith("futormes:") || m.status !== "scheduled") return false;
    if (m.match_date === yesterday) return true;
    if (m.match_date !== today) return false;
    const from = m.kickoff ? addMinutes(m.match_date, m.kickoff.slice(0, 5), WAIT_AFTER_KICKOFF) : `${m.match_date} ${NO_KICKOFF_FROM}`;
    return now >= from;
  });
}

/** Texto del aviso cuando entra el resultado. */
export function resultNotice(o: { gf: number; ga: number; home: boolean; club: string; rival: string }) {
  const { gf, ga, home, club, rival } = o;
  const score = home ? `${club} ${gf} - ${ga} ${rival}` : `${rival} ${ga} - ${gf} ${club}`;
  const title = gf > ga ? "✅ ¡Victoria! Ya están los datos del partido" : gf < ga ? "⚽ Ya están los datos del partido" : "🤝 Empate · Ya están los datos del partido";
  return { title, body: `${score}. Toca para ver el partido.` };
}
