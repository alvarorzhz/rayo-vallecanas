/**
 * Fechas en la hora del club. Todo lo que dependa de «qué día es hoy» pasa por aquí,
 * para que el servidor (en UTC) y Madrid no discrepen cerca de la medianoche.
 */
const CLUB_TZ = "Europe/Madrid";

const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: CLUB_TZ });

/** Día de Madrid (AAAA-MM-DD) de un instante; sin argumento, hoy. */
export const madridDay = (at: Date = new Date()): string => dayFmt.format(at);
