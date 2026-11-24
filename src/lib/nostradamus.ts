/**
 * Nostradamus de la porra (4.30.2). Sorpresa: no sale en Novedades.
 * Quien clava el resultado exacto ve en Inicio una bola de cristal con su foto («Lo sabías»).
 * Con dos resultados clavados en la temporada, durante una semana le llamamos «Nostradamus»
 * (en el saludo de Inicio y en la clasificación de la porra). Puro, con pruebas.
 */
import { porraPoints, POINTS_EXACT, type Prediction } from "./porra.ts";

export const ORACLE_DAYS = 3;
export const NOSTRA_DAYS = 7;
export const NOSTRA_EXACT = 2;

export type PlayedMatch = { id: string; match_date: string; status: string; goals_for: number | null; goals_against: number | null; rival?: string };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

/** Partidos que cada uno ha clavado, por fecha. */
export function exactsByUser(preds: Prediction[], matches: PlayedMatch[]): Map<string, PlayedMatch[]> {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const out = new Map<string, PlayedMatch[]>();
  for (const p of preds) {
    const m = byId.get(p.match_id);
    if (!m || porraPoints(p, m) !== POINTS_EXACT) continue;
    out.set(p.user_id, [...(out.get(p.user_id) ?? []), m]);
  }
  for (const list of out.values()) list.sort((a, b) => a.match_date.localeCompare(b.match_date));
  return out;
}

/** ¿Lleva el mote? Dos o más clavados y el último hace como mucho una semana. */
export function isNostradamus(exacts: PlayedMatch[], today: string) {
  if (exacts.length < NOSTRA_EXACT) return false;
  const d = daysBetween(exacts[exacts.length - 1].match_date, today);
  return d >= 0 && d <= NOSTRA_DAYS;
}

export function nostradamusSet(preds: Prediction[], matches: PlayedMatch[], today: string): Set<string> {
  const out = new Set<string>();
  for (const [u, list] of exactsByUser(preds, matches)) if (isNostradamus(list, today)) out.add(u);
  return out;
}

export type Oracle = { matchId: string; rival: string | null; gf: number; ga: number; count: number; nostradamus: boolean };

/** La bola de cristal: el último resultado que he clavado, si fue hace como mucho tres días. */
export function oracleFor(userId: string, preds: Prediction[], matches: PlayedMatch[], today: string): Oracle | null {
  const list = exactsByUser(preds.filter((p) => p.user_id === userId), matches).get(userId) ?? [];
  const last = list[list.length - 1];
  if (!last) return null;
  const d = daysBetween(last.match_date, today);
  if (d < 0 || d > ORACLE_DAYS) return null;
  return { matchId: last.id, rival: last.rival ?? null, gf: last.goals_for!, ga: last.goals_against!, count: list.length, nostradamus: isNostradamus(list, today) };
}
