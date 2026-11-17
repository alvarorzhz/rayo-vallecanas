/**
 * 4.20.0 · «Lo que queda»: cuántos partidos y puntos faltan, y qué necesitamos para cada objetivo
 * (ser primeros, la zona de arriba, librarnos de la de abajo). Funciones puras para poder probarlas.
 *
 * Las cuentas son prudentes: se supone que cada rival puede ganar todo lo que le queda (aunque
 * jueguen entre ellos) y un empate a puntos no cuenta como conseguido. Así, «está hecho» es seguro.
 */
import type { LeagueRow, StandingRow } from "./league-parse";

/** Si la web de la liga no marca las zonas, las de este Apertura: suben 6 y bajan 6. */
export const DEFAULT_UP = 6;
export const DEFAULT_DOWN = 6;

export type Goal = {
  key: "first" | "up" | "safe";
  label: string;
  /** Puestos que cuentan (los k primeros). */
  top: number;
  state: "hecho" | "depende-de-nosotros" | "depende-de-otros" | "imposible";
  /** Puntos que hacen falta para tenerlo asegurado pase lo que pase (si depende de nosotros). */
  need: number | null;
};

export type Outlook = { left: number; atStake: number; max: number; points: number; pos: number; goals: Goal[] };

/** Partidos que le quedan a cada equipo, según el calendario de la liga. */
export function remainingByTeam(calendar: LeagueRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of calendar) {
    if (r.status !== "scheduled" && r.status !== "postponed") continue;
    for (const t of [r.homeId, r.awayId]) out.set(t, (out.get(t) ?? 0) + 1);
  }
  return out;
}

/** Cuántos de arriba y de abajo forman cada zona: por las marcas de la web de la liga o, si no hay, 6 y 6. */
export function zones(rows: StandingRow[]): { up: number; upLabel: string | null; down: number; downLabel: string | null } {
  const sorted = [...rows].sort((a, b) => a.pos - b.pos);
  const run = (list: StandingRow[]) => {
    const z = list[0]?.zone?.label;
    if (!z) return { n: 0, label: null };
    let n = 0;
    while (n < list.length && list[n].zone?.label === z) n++;
    return { n, label: z };
  };
  const top = run(sorted);
  const bottom = run([...sorted].reverse());
  const isDown = (l: string | null) => !!l && /descen|baja/i.test(l);
  const up = top.n && !isDown(top.label) && top.n < sorted.length ? top : { n: Math.min(DEFAULT_UP, sorted.length - 1), label: null };
  const down = bottom.n && bottom.label !== up.label && bottom.n < sorted.length ? bottom : { n: Math.min(DEFAULT_DOWN, Math.max(0, sorted.length - up.n)), label: null };
  return { up: up.n, upLabel: up.label, down: down.n, downLabel: down.label };
}

/** Estado de «acabar entre los `top` primeros». */
export function goalState(us: { points: number; left: number }, others: { points: number; left: number }[], top: number): Pick<Goal, "state" | "need"> {
  const myMax = us.points + 3 * us.left;
  // Imposible: ya hay `top` equipos por encima de lo máximo que podemos sacar
  if (others.filter((o) => o.points > myMax).length >= top) return { state: "imposible", need: null };
  // Lo mínimo para que, aunque todos ganen todo, como mucho top-1 rivales lleguen a nuestros puntos
  for (let x = 0; x <= 3 * us.left; x++) {
    const final = us.points + x;
    const reach = others.filter((o) => o.points + 3 * o.left >= final).length;
    if (reach <= top - 1) return { state: x === 0 ? "hecho" : "depende-de-nosotros", need: x };
  }
  return { state: "depende-de-otros", need: null };
}

/** «10 puntos (3 victorias y 1 empate)» */
export function needLabel(points: number): string {
  const w = Math.floor(points / 3), d = points % 3;
  const parts = [w && `${w} ${w === 1 ? "victoria" : "victorias"}`, d && `${d} ${d === 1 ? "empate" : "empates"}`].filter(Boolean);
  return `${points} ${points === 1 ? "punto" : "puntos"}${parts.length ? ` (${parts.join(" y ")})` : ""}`;
}

export function leagueOutlook(rows: StandingRow[], us: string, left: Map<string, number>): Outlook | null {
  const me = rows.find((r) => r.teamId === us);
  if (!me || rows.length < 3) return null;
  const myLeft = left.get(us) ?? 0;
  const others = rows.filter((r) => r.teamId !== us).map((r) => ({ points: r.points, left: left.get(r.teamId) ?? 0 }));
  const mine = { points: me.points, left: myLeft };
  const z = zones(rows);
  const goals: Goal[] = [{ key: "first", label: "Ser primeros", top: 1, ...goalState(mine, others, 1) }];
  if (z.up > 1) goals.push({ key: "up", label: z.upLabel ? `${z.upLabel} (los ${z.up} primeros)` : `Acabar entre los ${z.up} primeros`, top: z.up, ...goalState(mine, others, z.up) });
  // La salvación solo se enseña si estamos en la mitad de abajo o aún no está hecha
  const safeTop = rows.length - z.down;
  // (si la zona de abajo empieza justo donde acaba la de arriba, librarse es lo mismo que subir: no se repite)
  if (z.down > 0 && safeTop > 0 && safeTop !== z.up) {
    const safe = goalState(mine, others, safeTop);
    if (safe.state !== "hecho" || me.pos > rows.length / 2) goals.push({ key: "safe", label: z.downLabel ? `Librarse de «${z.downLabel}»` : `No acabar en los ${z.down} últimos`, top: safeTop, ...safe });
  }
  return { left: myLeft, atStake: 3 * myLeft, max: me.points + 3 * myLeft, points: me.points, pos: me.pos, goals };
}
