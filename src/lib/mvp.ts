/** Votación del MVP de cada partido: tipos y cálculos (sin dependencias de servidor, para poder probarlos). */
import { madridToUtc } from "./polls.ts";

export type MvpBoard = {
  match_id: string;
  closes_at: string;
  /** Aún se puede votar. */
  open: boolean;
  /** Ya se hizo el recuento. */
  counted: boolean;
  winner_id: string | null;
  /** Empate sin resolver: lo decide un gestor entre estos. */
  tie_ids: string[] | null;
  /** El ganador lo eligió un gestor (por empate o porque nadie votó). */
  picked: boolean;
  /** Cuántas personas han votado. */
  voters: number;
  /** Personas activas que pueden votar. */
  eligible: number;
  my_vote: string | null;
  /** Mi ficha de jugador (no me puedo votar). */
  my_player_id: string | null;
  /** Votos de cada candidato: solo cuando se ha cerrado. */
  tally: Record<string, number> | null;
  candidates: string[];
};

/** Fecha de Madrid (AAAA-MM-DD) de un instante. */
const madridDay = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(at);

/**
 * Cierre de la votación: las 23:59 (hora de Madrid) del día en que se abre.
 * Si quedan menos de 2 horas (acta guardada muy tarde), dura hasta las 23:59 del día siguiente.
 */
export function mvpClosesAt(now = new Date()): Date {
  const end = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(madridToUtc(y, m, d, 23, 59).getTime() + 59_000);
  };
  const today = end(madridDay(now));
  if (today.getTime() - now.getTime() >= 2 * 3600_000) return today;
  return end(madridDay(new Date(today.getTime() + 3600_000)));
}

/** «hasta las 23:59» o «hasta mañana a las 23:59». */
export function untilLabel(closes: string | Date, now = new Date()): string {
  const c = new Date(closes);
  return madridDay(c) === madridDay(now) ? "hasta las 23:59" : "hasta mañana a las 23:59";
}

/** Clasificación de la votación cerrada: de más a menos votos (los que no tienen votos, fuera). */
export function ranking(b: Pick<MvpBoard, "tally" | "candidates">): { id: string; votes: number }[] {
  if (!b.tally) return [];
  return b.candidates
    .map((id) => ({ id, votes: b.tally?.[id] ?? 0 }))
    .filter((r) => r.votes > 0)
    .sort((a, z) => z.votes - a.votes);
}

/** Situación de la votación para la interfaz. */
export function mvpStage(b: MvpBoard): "open" | "counting" | "winner" | "tie" | "empty" {
  if (b.open) return "open";
  if (!b.counted) return "counting";
  if (b.winner_id) return "winner";
  return b.tie_ids?.length ? "tie" : "empty";
}

export const votesLabel = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;
