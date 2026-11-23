/**
 * Sorpresa de madrugada (4.30.1). Secreta: no sale en Novedades.
 * Quien abre la app entre la 1:00 y las 5:59 (hora de Madrid) se lleva una amarilla «por trasnochar»
 * con un parte que sabe si mañana hay partido, si estás convocado o si anoche marcaste.
 * Aquí solo va lo puro (horas y frases), para poder probarlo sin navegador.
 */
import type { Reply } from "./callups.ts";

export const NOCHE_DESDE = 1;
export const NOCHE_HASTA = 6; // sin incluir: hasta las 5:59

export type Reloj = { h: number; m: number; day: string };

const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });

/** Hora, minuto y día de Madrid de un instante. */
export function relojMadrid(at: Date): Reloj {
  const [h, m] = clockFmt.format(at).split(":").map(Number);
  return { h, m, day: dayFmt.format(at) };
}

export const esMadrugada = (r: Pick<Reloj, "h">) => r.h >= NOCHE_DESDE && r.h < NOCHE_HASTA;

/** «Para probar»: ?madrugada=1 (hora real) o ?madrugada=3:12 (hora fingida). Devuelve la hora fingida o null. */
export function horaForzada(valor: string | null, real: Reloj): Reloj | null {
  if (!valor) return null;
  const m = /^(\d{1,2})[:.h](\d{2})$/.exec(valor.trim());
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return { h: Number(m[1]), m: Number(m[2]), day: real.day };
  return { ...real, h: esMadrugada(real) ? real.h : 3, m: esMadrugada(real) ? real.m : 12 };
}

/** Lo que el servidor sabe de ti esta noche. */
export type NightCtx = {
  /** Apodo o nombre de pila. */
  name: string | null;
  /** Tiene ficha de jugador. */
  player: boolean;
  /** Partido que viene (hoy más tarde o mañana). */
  next: { date: string; kickoff: string | null; meet: string | null; rival: string; reply: Reply | null } | null;
  /** Partido que se jugó ayer (la noche de después). */
  last: { date: string; gf: number; ga: number; rival: string; goals: number; mvp: boolean; played: boolean } | null;
};

export type Parte = {
  card: "yellow" | "red";
  /** Motivo, en grande. */
  title: string;
  text: string;
  /** Nota a pie del acta (rachas de madrugadas). */
  foot: string | null;
};

const hm = (r: Pick<Reloj, "h" | "m">) => `${r.h}:${String(r.m).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const short = (t: string) => t.slice(0, 5).replace(/^0/, "");
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export function duracion(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Minutos de sueño que quedan hasta la hora de levantarse (la quedada, o una hora antes del partido). */
export function suenoHasta(now: Reloj, next: NonNullable<NightCtx["next"]>): { min: number; alarm: string; why: "quedada" | "partido" } | null {
  if (!next.kickoff) return null;
  const meet = next.meet ? toMin(next.meet) : null;
  // Levantarse: media hora antes de la quedada o, si no hay quedada, una hora antes del partido
  const target = meet != null ? meet - 30 : toMin(next.kickoff) - 60;
  const min = dayDiff(now.day, next.date) * 1440 + target - (now.h * 60 + now.m);
  if (min <= 0) return null;
  const a = ((target % 1440) + 1440) % 1440;
  return { min, alarm: `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`, why: meet != null ? "quedada" : "partido" };
}

/** Coletilla según lo que vas a dormir. */
function coletilla(min: number) {
  if (min < 240) return "Eso no es dormir, es una siesta con pijama.";
  if (min < 360) return "Justito, como un 1-0 en el descuento.";
  if (min < 450) return "Todavía llegas fresco al calentamiento. Todavía.";
  return "Aún te da para dormir como un central veterano.";
}

/** Frases de vestuario para una noche sin nada especial. Rotan según la noche. */
export const FRASES_GENERICAS: { title: string; text: string }[] = [
  { title: "¿Tú no tenías partido mañana?", text: "Ah, que no hay. Pues a dormir igual, que el cuerpo no distingue." },
  { title: "Los focos ya están apagados", text: "El campo cerró a las once. El balón duerme en el almacén. Solo quedas tú." },
  { title: "La clasificación no se mueve", text: "La he mirado yo por ti: a estas horas no juega nadie. Puedes soltar el móvil." },
  { title: "Mercado de fichajes cerrado", text: "A estas horas no ficha nadie, ni el Rayo. Vuelve con luz natural." },
  { title: "El míster ha visto la luz encendida", text: "Y no es la del vestuario. Es la de tu móvil. Apágala." },
  { title: "Entrenamiento de madrugada no existe", text: "Lo hemos buscado en el calendario. No sale. Cama." },
  { title: "Ni Don Rayo está despierto", text: "El presidente ronca desde las doce. Y eso que tiene rueda de prensa pendiente." },
];

/** Índice estable para la noche (el mismo toda la noche, otro distinto la siguiente). */
export function semilla(day: string, n: number) {
  let x = 0;
  for (const c of day) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x % n;
}

/**
 * Parte del árbitro.
 * visita: cuántas veces se ha abierto la app esta noche (1 = la primera).
 * noches: madrugadas distintas este mes contando esta.
 */
export function parte(ctx: NightCtx | null, now: Reloj, visita: number, noches: number): Parte {
  const name = ctx?.name ?? null;
  const foot = noches >= 3
    ? `${noches}.ª madrugada este mes. Vas lanzado a por el Búho de Oro 🦉`
    : noches === 2 ? "Segunda madrugada este mes. El árbitro toma nota." : null;

  if (visita >= 3) {
    return { card: "red", title: "Al Comité de Competición", text: `${visita} veces esta noche${name ? `, ${name}` : ""}. Tu caso pasa al Comité. Sanción propuesta: ocho horas de sueño sin derecho a recurso.`, foot };
  }
  if (visita === 2) {
    return { card: "red", title: "Roja directa por reincidir", text: `Ya te saqué la amarilla esta noche y has vuelto a las ${hm(now)}. Al vestuario… o sea, a la cama.`, foot };
  }

  const c = { card: "yellow" as const, foot };
  const next = ctx?.next ?? null;
  const last = ctx?.last ?? null;

  // La noche de después del partido
  if (last && !next) {
    const res = `${last.gf}-${last.ga}`;
    if (last.mvp) return { ...c, title: "El MVP no duerme, se deja admirar", text: `Lo tuyo contra ${last.rival} fue de cine${name ? `, ${name}` : ""}. Pero hasta las leyendas cierran los ojos. El trofeo seguirá ahí mañana.` };
    if (last.goals >= 2) return { ...c, title: "¿Viendo tus goles en bucle?", text: `${last.goals} goles contra ${last.rival}, sí. Siguen valiendo lo mismo con los ojos cerrados. Prometido.` };
    if (last.goals === 1) return { ...c, title: "¿Repasando tu gol otra vez?", text: `Fue bonito, lo vimos todos. Contra ${last.rival} y para siempre. Ya puedes dormir tranquilo.` };
    if (last.gf > last.ga) return { ...c, title: "Celebrando hasta las tantas", text: `El ${res} contra ${last.rival} ya está en la saca y los tres puntos no se escapan por la noche. A la cama.` };
    if (last.gf === last.ga) return { ...c, title: "¿Contando las ocasiones falladas?", text: `${res} contra ${last.rival}. Cuenta ovejas, que salen más que las ocasiones.` };
    return { ...c, title: "Dándole vueltas al partido", text: `El ${res} contra ${last.rival} no se arregla mirando el móvil a las ${hm(now)}. Se arregla durmiendo y entrenando. En ese orden.` };
  }

  // La noche de antes
  if (next) {
    const today = next.date === now.day;
    const cuando = today ? "hoy" : "mañana";
    const hora = next.kickoff ? ` a las ${short(next.kickoff)}` : "";
    const s = suenoHasta(now, next);
    const sleep = s ? ` Si te duermes ya, te quedan ${duracion(s.min)} hasta que suene el despertador (${s.alarm}${s.why === "quedada" ? ", media hora antes de la quedada" : ""}). ${coletilla(s.min)}` : "";
    // A las tres de la mañana, el partido de «hoy» sigue siendo el de «mañana»
    const title = "¿Tú no tenías partido mañana?";
    if (!ctx?.player) {
      return { ...c, title, text: `El Rayo juega ${cuando}${hora} contra ${next.rival}. Tú no te calzas las botas, pero alguien tiene que llevar el acta despierto. A dormir.` };
    }
    switch (next.reply) {
      case "yes":
        return { ...c, title, text: `Dijiste «Voy» para jugar ${cuando}${hora} contra ${next.rival}, y son las ${hm(now)}.${sleep}` };
      case "maybe":
        return { ...c, title: "«Quizás», dijiste", text: `A las ${hm(now)}, un «quizás» para jugar ${cuando} contra ${next.rival} ya es un «no» con ojeras. Decídete y a la cama.` };
      case "no":
        return { ...c, title: "Tú no juegas, pero aquí estás", text: `Dijiste que no vienes ${cuando} contra ${next.rival}… y a las ${hm(now)} sigues pendiente del Rayo. Se agradece, pero duerme.` };
      case "pending":
        return { ...c, title: "Convocatoria sin contestar", text: `Para contestar si vienes ${cuando} contra ${next.rival} no hubo tiempo, pero para abrir la app a las ${hm(now)} sí. Contesta y a la cama.` };
      default:
        return { ...c, title, text: `El Rayo juega ${cuando}${hora} contra ${next.rival}. No estás en la lista, pero eso no es excusa para trasnochar.` };
    }
  }

  const f = FRASES_GENERICAS[semilla(now.day, FRASES_GENERICAS.length)];
  return { ...c, title: f.title, text: name && f === FRASES_GENERICAS[0] ? `${f.text} Buenas noches, ${name}.` : f.text };
}

/** Lo que dice el árbitro al pulsar «Cinco minutos más». */
export const SEGUNDA_AMARILLA = { title: "¡Segunda amarilla!", text: "Expulsado. Te doy cinco minutos de descuento, ni uno más." };
/** Al acabarse el descuento. */
export const FINAL_DESCUENTO = { title: "Final del partido", text: "Se acabó el descuento. El árbitro se va a casa y tú, a la cama." };
