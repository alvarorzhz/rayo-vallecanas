/** Cuándo sale la pantalla para activar los avisos (sin agobiar). Puro, con pruebas. */
export type PromptMode = "ask" | "ios" | "denied";

export const PROMPT_PAUSE_DAYS = 30;
/** Tras tantos «Ahora no» ya no vuelve a salir (se pueden activar desde Mi perfil). */
export const PROMPT_MAX_TIMES = 2;

export function promptDecision(o: {
  supported: boolean;
  permission: NotificationPermission | null;
  ios: boolean;
  standalone: boolean;
  /** Última vez que se cerró la pantalla (ms) y cuántas veces. */
  lastAt: number;
  times: number;
  now: number;
}): PromptMode | null {
  if (o.permission === "granted") return null;
  if (o.times >= PROMPT_MAX_TIMES) return null;
  if (o.lastAt && o.now - o.lastAt < PROMPT_PAUSE_DAYS * 864e5) return null;
  if (o.supported) {
    if (o.permission === "default") return "ask";
    // Bloqueado: se explica cómo desbloquearlo una sola vez
    if (o.permission === "denied") return o.times === 0 ? "denied" : null;
    return null;
  }
  // En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio
  if (o.ios && !o.standalone) return "ios";
  return null;
}
