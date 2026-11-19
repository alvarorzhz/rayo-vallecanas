/**
 * 4.22.0 · El locutor del acta en vivo: lo que «canta» la radio cuando marca el Rayo.
 * Solo prepara las frases (puro, para poder probarlo); quien habla es la voz del propio móvil
 * (síntesis de voz del navegador, gratis y sin mandar nada fuera), en components/matches/locutor.ts.
 * Usa el nombre de camiseta (el apodo), nunca el nombre completo.
 */

/** Una frase y cómo decirla: más rápida y aguda cuanto más se grita. */
export type Line = { text: string; rate: number; pitch: number };

export type GoalCall = {
  /** Nombre de camiseta de quien marca (null si es en propia o no se apuntó). */
  scorer: string | null;
  assist: string | null;
  /** Goles que lleva hoy quien marca, contando este. */
  goalsToday: number;
  gf: number;
  ga: number;
  rival: string | null;
};

/** Los nombres que vienen en mayúsculas («CÁDIZ») la voz los deletrea: se pasan a «Cádiz». */
export function speakable(name: string): string {
  const s = name.replace(/\s+/g, " ").trim();
  if (!/\p{Lu}{2}/u.test(s) || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-.'(])(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/** Elige una de las variantes; `pick` se puede fijar en las pruebas. */
export function goalCall(c: GoalCall, pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): Line[] {
  const one = <T,>(xs: T[]) => xs[Math.min(xs.length - 1, Math.max(0, pick(xs.length)))];
  const shout = (text: string): Line => ({ text, rate: 1.05, pitch: 1.3 });
  const say = (text: string): Line => ({ text, rate: 1.1, pitch: 1.1 });
  const who = c.scorer ? speakable(c.scorer) : null;
  const rival = c.rival ? speakable(c.rival) : "el rival";
  const lines: Line[] = [shout(one(["¡Gol, gol, gol, gooooool!", "¡Gooooool! ¡Gol, gol, gol!", "¡Gol, gol, gol, gol, gol!"]))];
  lines.push(shout(one(["¡Gol del Rayo!", "¡Golazo del Rayo!", "¡Gol del Rayo Vallecañas!"])));
  if (who) {
    if (c.goalsToday === 3) lines.push(shout(`¡Triplete de ${who}!`));
    else lines.push(shout(one([`¡Gol de ${who}!`, `¡Marca ${who}!`, `¡La mete ${who}!`])));
    if (c.goalsToday === 2) lines.push(say("¡Su segundo gol del partido!"));
    else if (c.goalsToday > 3) lines.push(say(`¡Ya lleva ${c.goalsToday} goles hoy!`));
    if (c.assist) lines.push(say(`Asistencia de ${speakable(c.assist)}.`));
  }
  if (c.gf === c.ga) lines.push(say("¡Empata el Rayo!"));
  else if (c.gf - c.ga === 1 && c.gf === 1) lines.push(say("¡El Rayo se adelanta!"));
  else if (c.gf - c.ga === 1) lines.push(say("¡El Rayo se pone por delante!"));
  lines.push(say(`Rayo ${c.gf}, ${rival} ${c.ga}.`));
  return lines;
}
