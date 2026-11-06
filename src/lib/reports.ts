import type { Player } from "@/lib/squad";

/** Acta del partido: quién jugó y qué hizo. */
export type Appearance = {
  id: string;
  match_id: string;
  player_id: string;
  started: boolean;
  goalkeeper: boolean;
  conceded: number;
  yellows: number;
  red: boolean;
};
export type MatchGoal = { id: string; match_id: string; scorer_id: string | null; assist_id: string | null; own_goal: boolean; sort: number };

/** Jugador elegible para el acta con su dorsal y posición de la temporada del partido. */
export type ReportPlayer = { player_id: string; player: Player; number: number | null; position: string };

/** Lo que edita el gestor (y lo que llega de la liga para rellenarlo). */
export type DraftApp = { started: boolean; goalkeeper: boolean; conceded: number; yellows: number; red: boolean };
export type DraftGoal = { scorer: string; assist: string };   // scorer: id, "own" (propia puerta del rival) o "" (sin apuntar)
export type ReportDraft = { apps: Record<string, DraftApp>; goals: DraftGoal[]; mvp: string };

export const emptyApp = (): DraftApp => ({ started: false, goalkeeper: false, conceded: 0, yellows: 0, red: false });

export type ReportView = {
  appearances: (Appearance & ReportPlayer)[];
  goals: (MatchGoal & { scorer: ReportPlayer | null; assist: ReportPlayer | null })[];
  mvp: ReportPlayer | null;
};
