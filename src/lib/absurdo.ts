/**
 * Departamento de Estadística Absurda del Rayo (4.30.2). Sorpresa: no sale en Novedades.
 * En la previa, de vez en cuando, un dato con pinta de serio y sin ningún sentido, sacado de los partidos
 * de verdad: «Cuando Pitu contesta "Voy" el primero, el Rayo no pierde: 3 de 3». Si la condición se cumple
 * también en el próximo partido, lo dice («Y esta vez Pitu ya ha contestado el primero 👀»).
 * Puro, con pruebas.
 */

export type HistMatch = {
  id: string;
  date: string; // AAAA-MM-DD
  kickoff: string | null; // "18:30:00"
  rival: string;
  gf: number;
  ga: number;
  /** Primer jugador que contestó «Voy». */
  firstYes: string | null;
  /** Quién abrió el marcador (si fue nuestro). */
  firstScorer: string | null;
  assisters: string[];
};

export type Upcoming = { id: string; date: string; kickoff: string | null; rival: string; firstYes: string | null };
export type Dato = { text: string; now: string | null };

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const dayOfMonth = (date: string) => Number(date.slice(8, 10));
const month = (date: string) => Number(date.slice(5, 7));
// Los meses con erre, como el marisco
const MONTHS_R = new Set([1, 2, 3, 4, 9, 10, 11, 12]);
const VOWELS = /^[aeiouáéíóú]/i;
const cleanRival = (r: string) => r.replace(/^(C\.?D\.?|C\.?F\.?|U\.?D\.?|A\.?D\.?|S\.?D\.?|Club|Atlético|Real|Deportivo)\s+/i, "").trim();
const halfPast = (k: string | null) => (k ? Number(k.slice(3, 5)) >= 15 && Number(k.slice(3, 5)) < 45 : null);

type Cond = {
  key: string;
  /** Empieza en minúscula: «cuando…», «en los partidos…». */
  label: string;
  /** Se basa en una persona: nunca se le echa la culpa de las derrotas. */
  person: boolean;
  test: (m: HistMatch) => boolean | null;
  /** Qué se dice si también se cumple en el próximo partido (null: no se sabe o no se cumple). */
  now: (u: Upcoming) => string | null;
};

function conditions(hist: HistMatch[], names: Map<string, string>): Cond[] {
  const out: Cond[] = [];
  for (let d = 0; d < 7; d++) {
    out.push({ key: `dia-${d}`, label: `los ${DAYS[d]}${d === 0 || d === 6 ? "s" : ""}`, person: false, test: (m) => weekday(m.date) === d, now: (u) => (weekday(u.date) === d ? `Y el próximo es ${DAYS[d]} 👀` : null) });
  }
  out.push({ key: "par", label: "en los días pares del mes", person: false, test: (m) => dayOfMonth(m.date) % 2 === 0, now: (u) => (dayOfMonth(u.date) % 2 === 0 ? `Y el próximo cae en día ${dayOfMonth(u.date)} 👀` : null) });
  out.push({ key: "impar", label: "en los días impares del mes", person: false, test: (m) => dayOfMonth(m.date) % 2 === 1, now: (u) => (dayOfMonth(u.date) % 2 === 1 ? `Y el próximo cae en día ${dayOfMonth(u.date)} 👀` : null) });
  out.push({ key: "erre", label: "en los meses con erre, como el marisco", person: false, test: (m) => MONTHS_R.has(month(m.date)), now: (u) => (MONTHS_R.has(month(u.date)) ? "Y el próximo es en mes con erre 👀" : null) });
  out.push({ key: "sin-erre", label: "en los meses sin erre", person: false, test: (m) => !MONTHS_R.has(month(m.date)), now: (u) => (!MONTHS_R.has(month(u.date)) ? "Y el próximo es en mes sin erre 👀" : null) });
  out.push({ key: "media", label: "cuando el partido empieza a y media", person: false, test: (m) => halfPast(m.kickoff), now: (u) => (halfPast(u.kickoff) ? "Y el próximo empieza a y media 👀" : null) });
  out.push({ key: "punto", label: "cuando el partido empieza en punto", person: false, test: (m) => (halfPast(m.kickoff) == null ? null : !halfPast(m.kickoff)), now: (u) => (halfPast(u.kickoff) === false ? "Y el próximo empieza en punto 👀" : null) });
  out.push({ key: "vocal", label: "contra equipos que empiezan por vocal", person: false, test: (m) => VOWELS.test(cleanRival(m.rival)), now: (u) => (VOWELS.test(cleanRival(u.rival)) ? `Y ${u.rival} empieza por vocal 👀` : null) });
  out.push({ key: "largo", label: "contra rivales con nombre de más de 12 letras", person: false, test: (m) => m.rival.replace(/[^\p{L}]/gu, "").length > 12, now: (u) => (u.rival.replace(/[^\p{L}]/gu, "").length > 12 ? `Y ${u.rival} tiene ${u.rival.replace(/[^\p{L}]/gu, "").length} letras 👀` : null) });

  const people = new Set<string>();
  for (const m of hist) {
    if (m.firstYes) people.add(m.firstYes);
    if (m.firstScorer) people.add(m.firstScorer);
    for (const a of m.assisters) people.add(a);
  }
  for (const id of people) {
    const n = names.get(id);
    if (!n) continue;
    out.push({ key: `voy-${id}`, label: `cuando ${n} contesta «Voy» el primero`, person: true, test: (m) => (m.firstYes ? m.firstYes === id : null), now: (u) => (u.firstYes === id ? `Y esta vez ${n} ya ha contestado el primero 👀` : null) });
    out.push({ key: `abre-${id}`, label: `cuando ${n} abre el marcador`, person: true, test: (m) => (m.gf > 0 ? m.firstScorer === id : null), now: () => null });
    out.push({ key: `asis-${id}`, label: `cuando ${n} da una asistencia`, person: true, test: (m) => m.assisters.includes(id), now: () => null });
  }
  return out;
}

type Rec = { w: number; d: number; l: number; n: number };
const rec = (ms: HistMatch[]): Rec => {
  const r = { w: 0, d: 0, l: 0, n: ms.length };
  for (const m of ms) {
    if (m.gf > m.ga) r.w++;
    else if (m.gf === m.ga) r.d++;
    else r.l++;
  }
  return r;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function hash(s: string) {
  let x = 0;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x;
}

/** Todos los datos que salen con los partidos que hay, del más gracioso al menos. Mínimo 3 partidos. */
export function datosAbsurdos(hist: HistMatch[], up: Upcoming, names: Map<string, string>): (Dato & { key: string; score: number })[] {
  const out: (Dato & { key: string; score: number })[] = [];
  for (const c of conditions(hist, names)) {
    const known = hist.filter((m) => c.test(m) != null);
    const yes = known.filter((m) => c.test(m));
    const no = known.filter((m) => !c.test(m));
    if (yes.length < 3 || !no.length) continue;
    const r = rec(yes);
    const rest = rec(no);
    let text: string | null = null;
    // Solo vale si fuera de la condición la cosa cambia (si no, no es dato, es la temporada)
    if (r.w === r.n && rest.w < rest.n) text = `${cap(c.label)}, el Rayo gana siempre: ${r.w} de ${r.n}.`;
    else if (r.l === 0 && r.w > 0 && rest.l > 0) text = `${cap(c.label)}, el Rayo no conoce la derrota: ${pl(r.w, "victoria", "victorias")} y ${pl(r.d, "empate", "empates")} en ${r.n} partidos.`;
    else if (!c.person && r.w === 0 && rest.w > 0) text = `${cap(c.label)}, el Rayo no ha ganado nunca: ${r.n} partidos, ${pl(r.l, "derrota", "derrotas")} y ${pl(r.d, "empate", "empates")}. Mala suerte, no hay otra explicación.`;
    if (!text) continue;
    const now = c.now(up);
    const score = r.n + (now ? 10 : 0) + (c.person ? 3 : 0) + (r.w === r.n ? 2 : 0);
    out.push({ key: c.key, text, now, score });
  }
  return out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/**
 * El dato de la previa de este partido, o null. De vez en cuando: sale en dos de cada tres partidos
 * (siempre si la condición se cumple ahora). Entre los mejores, cambia de un partido a otro.
 */
export function datoAbsurdo(hist: HistMatch[], up: Upcoming, names: Map<string, string>): Dato | null {
  const all = datosAbsurdos(hist, up, names);
  if (!all.length) return null;
  const h = hash(up.id);
  if (!all[0].now && h % 3 === 0) return null;
  const pool = all[0].now ? all.filter((x) => x.now) : all.slice(0, 3);
  const pick = pool[h % pool.length];
  return { text: pick.text, now: pick.now };
}
