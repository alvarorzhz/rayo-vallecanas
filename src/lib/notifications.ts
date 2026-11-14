/**
 * Catálogo de los avisos al móvil que manda la app, para enseñarlo en Gestión → Avisos.
 * Al añadir un aviso nuevo en el código (sendPush), añádelo aquí también.
 */

export type NoticeArea = "manual" | "polls" | "matches" | "squad" | "news" | "lottery" | "sponsors" | "league" | "fees" | "backup";

export const AREA_LABEL: Record<NoticeArea, string> = {
  manual: "Avisos y votaciones",
  polls: "Votaciones",
  matches: "Partidos y convocatorias",
  squad: "Plantilla y cumpleaños",
  news: "La Voz del Rayo",
  lottery: "Sorteos",
  sponsors: "Patrocinadores",
  league: "Liga",
  fees: "Cuotas",
  backup: "Copia de seguridad",
};

export type NoticeKind = {
  area: NoticeArea;
  title: string;
  /** Cuándo sale. */
  when: string;
  /** A quién le llega. */
  who: string;
  /** auto = sale sola; manual = la lanza alguien con un botón; opt = sale si se deja marcada la casilla. */
  how: "auto" | "manual" | "opt";
};

export const NOTICE_CATALOG: NoticeKind[] = [
  { area: "manual", title: "Aviso al equipo", when: "Cuando lo mandas desde esta pantalla.", who: "Todo el equipo, solo jugadores o solo gestores.", how: "manual" },
  { area: "manual", title: "🗳️ Nueva votación", when: "Al lanzar una votación sí/no. Lleva los botones «Sí» y «No».", who: "Las personas a las que va dirigida.", how: "manual" },
  { area: "manual", title: "⏰ Recordatorio de votación", when: "Con «Recordar» en una votación abierta.", who: "Solo a los que aún no han votado.", how: "manual" },

  { area: "matches", title: "📅 Nuevo partido en el calendario", when: "Al crear un partido a mano, si se deja marcado «Avisar».", who: "Todo el equipo (menos quien lo crea).", how: "opt" },
  { area: "matches", title: "🔁 Cambio en el partido", when: "Si cambia la fecha o la hora: desde la liga, siempre; a mano, si se deja marcado «Avisar».", who: "Todo el equipo.", how: "auto" },
  { area: "matches", title: "⏸️ Aplazado · ⛔ Suspendido · 📅 Nueva fecha", when: "Al cambiar el estado del partido, si se deja marcado «Avisar».", who: "Todo el equipo.", how: "opt" },
  { area: "matches", title: "✅ ¡Victoria! · 🤝 Empate · ⚽ Final (con el marcador)", when: "En cuanto entra el resultado: «Ya están los datos del partido». El día del partido la app mira sola la web de la liga (14:00, 17:00, 20:00 y 22:30, y las 8:00 del día siguiente; una hora más tarde en verano), empezando hora y media después del pitido. También al sincronizar a mano o, si se deja marcado «Avisar», al ponerlo a mano o al dar el pitido final en el acta en vivo. Nunca sale dos veces para el mismo partido.", who: "Todo el equipo.", how: "auto" },
  { area: "matches", title: "⭐ Vota al MVP del partido", when: "Al guardar el acta por primera vez (o al abrir la votación a mano). Si se deja marcado «Avisar», lleva también el resultado y los goleadores.", who: "Todo el equipo (menos quien la abre).", how: "auto" },
  { area: "matches", title: "⭐ MVP del partido", when: "Al cerrarse la votación (a las 23:59), con el ganador y sus votos.", who: "Todo el equipo.", how: "auto" },
  { area: "matches", title: "⭐ Empate en el MVP: decide tú", when: "Si la votación acaba empatada a votos y a goles.", who: "Quien puede editar Partidos.", how: "auto" },
  { area: "matches", title: "📋 Acta del partido", when: "La primera vez que se guarda el acta, si se deja marcado «Avisar» y la votación del MVP ya estaba abierta.", who: "Todo el equipo.", how: "opt" },
  { area: "matches", title: "⚽ ¡Estás convocado!", when: "Al publicar la convocatoria (o al añadir a alguien después). Con botones «Voy» y «No voy».", who: "Los convocados.", how: "opt" },
  { area: "matches", title: "⏰ ¿Vas al partido?", when: "Con «Recordar» en la convocatoria.", who: "Los convocados que no han contestado.", how: "manual" },
  { area: "matches", title: "⏰ Mañana hay partido: ¿vas?", when: "Cada mañana a las 9:00 (10:00 en verano), la víspera del partido.", who: "Los convocados que no han contestado.", how: "auto" },
  { area: "matches", title: "⚽ ¡Hoy jugamos!", when: "La mañana del partido, con la hora y el sitio de quedada.", who: "Los convocados que van o dudan.", how: "auto" },
  { area: "matches", title: "⚽ Hoy jugamos: ¿vas?", when: "La mañana del partido, con la hora y el sitio de quedada. Con botones «Voy» y «No voy».", who: "Los convocados que aún no han contestado.", how: "auto" },

  { area: "squad", title: "🎂 Hoy cumple…", when: "La mañana del cumpleaños de un jugador de la plantilla (con su fecha de nacimiento en la ficha), a las 9:00 (10:00 en verano). Una vez al año.", who: "Todo el equipo menos el que cumple.", how: "auto" },
  { area: "squad", title: "🎂 ¡Feliz cumpleaños!", when: "La misma mañana de su cumpleaños.", who: "El jugador que cumple años.", how: "auto" },

  { area: "news", title: "🗞️ La Voz del Rayo", when: "Al publicar una pieza por primera vez, si se deja marcado «Avisar al equipo». Lleva el titular y el principio del texto.", who: "Todo el que puede leer La Voz del Rayo (menos quien publica).", how: "opt" },
  { area: "news", title: "🎙️ La Voz del Rayo quiere entrevistarte", when: "Al mandarle las preguntas de una entrevista (o al volver a mandárselas).", who: "El jugador entrevistado.", how: "manual" },
  { area: "news", title: "🎙️ … ha contestado la entrevista", when: "Cuando el jugador entrega sus respuestas. Dice cuántas ha contestado.", who: "Quien le mandó las preguntas.", how: "auto" },

  { area: "lottery", title: "¡Ya puedes vender! 🎟️", when: "Al abrir un sorteo.", who: "Sus vendedores.", how: "auto" },
  { area: "lottery", title: "Nueva venta 💶", when: "Con cada venta.", who: "Los gestores de sorteos que lo tienen activado en Mi perfil.", how: "auto" },
  { area: "lottery", title: "🏆 Número ganador", when: "Al registrar el número ganador.", who: "Vendedores y gestores de sorteos.", how: "auto" },

  { area: "sponsors", title: "🤝 Patrocinadores", when: "Cada mañana, si un plazo pasa de fecha sin cobrar (como mucho uno a la semana) o falta un mes para que venza un acuerdo.", who: "Quien puede editar Patrocinadores.", how: "auto" },

  { area: "league", title: "🏆 Hay liga nueva en futormes", when: "Al acabar la liga, cuando la app encuentra al Rayo en otra competición (una sola vez por competición).", who: "Quien puede editar Partidos.", how: "auto" },
  { area: "fees", title: "💶 Cuota del Rayo", when: "Con «Recordar a los que deben» en Plantilla → Cuotas (como mucho una vez al día). Dice a cada uno lo que le falta.", who: "Solo los jugadores que deben cuota esta temporada.", how: "manual" },

  { area: "backup", title: "⚠️ La copia de seguridad ha fallado", when: "Si falla la copia automática de los lunes.", who: "Los superadministradores.", how: "auto" },

  { area: "league", title: "Problema con la liga", when: "Si la importación de la liga falla o se queda a medias (como mucho uno al día por el mismo problema).", who: "Quien puede editar Partidos.", how: "auto" },
];

export const HOW_LABEL: Record<NoticeKind["how"], string> = { auto: "Automático", manual: "Con un botón", opt: "Si se marca «Avisar»" };

/** Sección de un aviso ya enviado, según adónde lleva al tocarlo. */
export function areaOf(url: string | null, tag: string | null): NoticeArea {
  const u = url ?? "/";
  if (u.startsWith("/votaciones")) return "polls";
  if (tag?.startsWith("cuota-")) return "fees";
  if (tag?.startsWith("cumple-")) return "squad";
  if (u.startsWith("/admin/copia")) return "backup";
  if (tag === "liga-sincronizacion" || u.startsWith("/partidos/liga")) return "league";
  if (u.startsWith("/partidos")) return "matches";
  if (u.startsWith("/la-voz")) return "news";
  if (u.startsWith("/loteria")) return "lottery";
  if (u.startsWith("/admin/patrocinadores")) return "sponsors";
  return "manual";
}
