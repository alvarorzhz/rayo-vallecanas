/**
 * Días señalados en los que la app se viste (hora de Madrid).
 * Adorno del escudo y, algunos días, un saludo al entrar (una vez al día por dispositivo).
 */
export type Fiesta = "navidad" | "nochevieja" | "anonuevo";
type Adorno = "gorro" | "purpurina";
export type DiaFiesta = { adorno: Adorno | null; saludo: Fiesta | null; year: number };

/** Mes (1-12), día y año en Madrid. */
export function madridParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

export function fiestaDe(d: Date): DiaFiesta {
  const { year, month, day } = madridParts(d);
  // Nochevieja y Año Nuevo: purpurina dorada
  if (month === 12 && day === 31) return { adorno: "purpurina", saludo: "nochevieja", year };
  if (month === 1 && day === 1) return { adorno: "purpurina", saludo: "anonuevo", year };
  // Navidad: gorro del 15 de diciembre a Reyes
  const navidad = (month === 12 && day >= 15) || (month === 1 && day <= 6);
  if (!navidad) return { adorno: null, saludo: null, year };
  return { adorno: "gorro", saludo: month === 12 && (day === 24 || day === 25) ? "navidad" : null, year };
}

/** Para probarlo sin esperar a diciembre: ?fiesta=navidad | nochevieja | anonuevo (off lo quita). */
export function fiestaForzada(nombre: string | null, now: Date): DiaFiesta | null {
  const { year, month } = madridParts(now);
  // La temporada va de septiembre a agosto: la Navidad que viene es la de este año o la del pasado
  const dic = month >= 7 ? year : year - 1;
  if (nombre === "navidad") return { adorno: "gorro", saludo: "navidad", year: dic };
  if (nombre === "nochevieja") return { adorno: "purpurina", saludo: "nochevieja", year: dic };
  if (nombre === "anonuevo") return { adorno: "purpurina", saludo: "anonuevo", year: dic + 1 };
  return null;
}

export function saludoDe(f: Fiesta, year: number): { emoji: string; title: string; text: string } {
  if (f === "navidad") return { emoji: "🎄", title: "¡Feliz Navidad, familia rayista!", text: "Que Papá Noel traiga goles, puntos y ninguna lesión. ¡Aúpa Rayo! ⚡" };
  if (f === "nochevieja") return { emoji: "🥂", title: "¡Feliz salida de año!", text: `Las doce uvas, una por cada gol que nos falta. Que el ${year + 1} venga cargado de victorias. ⚡` };
  return { emoji: "🎆", title: `¡Feliz ${year}!`, text: "Año nuevo, mismo escudo. A por todas, Rayo. ⚡" };
}
