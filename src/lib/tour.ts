import type { Session } from "@/lib/session";

/**
 * Tutorial de bienvenida: recorrido por las páginas de la app adaptado a lo que puede ver cada perfil.
 * Si se añade una sección nueva, añadir aquí su paso. Si cambia mucho el recorrido, subir TOUR_VERSION
 * para que todos lo vuelvan a ver.
 */
export const TOUR_VERSION = 2;

export type TourStep = {
  key: string;
  /** Página a la que lleva el paso (si no tiene, se queda donde está). */
  href?: string;
  /** Elemento del menú que se resalta: el valor de su atributo data-tour. */
  target?: string;
  icon: "Sparkles" | "Home" | "CalendarDays" | "Shirt" | "Ticket" | "Wallet" | "Settings" | "UserRound" | "Trophy" | "Newspaper";
  title: string;
  text: string;
  points?: string[];
};

export function buildTour(s: Session): TourStep[] {
  const first = s.profile.full_name.split(" ")[0] || s.profile.full_name;
  const manager = s.can("lottery_admin") || s.can("users") || s.can("finances");
  const steps: TourStep[] = [];

  steps.push({
    key: "hola",
    icon: "Sparkles",
    title: `¡Hola, ${first}!`,
    text: "Te damos la bienvenida a la app del Rayo Vallecañas: los partidos, la plantilla, los sorteos y todo lo del club en un mismo sitio. Te la enseñamos en un minuto.",
    points: [
      `Tu perfil es «${s.profile.role_label}»: solo verás lo que te toca.`,
      "Puedes saltarte el recorrido cuando quieras y repetirlo desde «Mi perfil».",
    ],
  });

  const home: string[] = [];
  if (s.can("matches")) home.push("El próximo partido con su cuenta atrás y tu convocatoria.");
  if (s.can("matches")) home.push("El día del partido, el Especial Matchday con el marcador en directo; después, el resultado con el MVP y las notas.");
  home.push(s.can("news") ? "Las noticias importantes de La Voz, las votaciones abiertas y los cumpleaños del día." : "Las votaciones abiertas y los cumpleaños del día.");
  if (s.can("lottery_admin") || s.can("lottery_sell")) home.push("La lotería o la rifa a la venta, con su botón para vender.");
  if (s.can("squad")) home.push("Tu temporada: tu cromo, tus goles y tus rachas.");
  steps.push({
    key: "inicio",
    href: "/",
    target: "/",
    icon: "Home",
    title: "Inicio",
    text: "Tu resumen del día. Siempre puedes volver aquí pulsando el escudo.",
    points: home,
  });

  if (s.can("matches")) {
    const p = [
      "El calendario, los resultados y la clasificación de la liga.",
      "Contesta a la convocatoria y juega la porra: adivina el resultado y suma puntos.",
      "Después del partido, vota al MVP y ponles nota del 1 al 10 a los que jugaron.",
      "Estadísticas y tu resumen de temporada para compartir.",
    ];
    if (s.can("matches", "update"))
      p.push("Como gestor: añade partidos, prepara la convocatoria, lleva el acta en vivo desde la banda y saca las imágenes para compartir.");
    steps.push({ key: "partidos", href: "/partidos", target: "/partidos", icon: "CalendarDays", title: "Partidos", text: "Todo lo que pasa en el campo.", points: p });
  }

  if (s.can("news") && !s.off("news")) {
    const p = [
      "Crónicas, previas, entrevistas y comunicados del club. Reacciona a cada noticia con ⚡ 🔥 👏 😂 😮.",
      "Si te hacen una entrevista, te llega un aviso y la contestas desde Inicio.",
    ];
    if (s.can("news", "create")) p.push("Escribe piezas con fotos. La IA te redacta el borrador con los datos del partido (solo con apodos).");
    steps.push({ key: "la-voz", href: "/la-voz", target: "/la-voz", icon: "Newspaper", title: "La Voz del Rayo", text: "El periódico del club. En el móvil, el icono del periódico de arriba.", points: p });
  }

  if (s.can("squad")) {
    const p = [
      "Los cromos de cada jugador y el cromo «En forma» del MVP de la última jornada.",
      "En cada ficha, sus estadísticas, sus logros y sus amarillas del ciclo.",
      "La historia del equipo temporada a temporada.",
    ];
    if (s.can("squad_private")) p.push("Los documentos de cada jugador (DNI, ficha, reconocimiento médico).");
    if (s.can("squad", "update")) p.push("Fichar jugadores, preparar la temporada nueva en verano y exportar a Excel.");
    steps.push({ key: "plantilla", href: "/plantilla", target: "/plantilla", icon: "Shirt", title: "Plantilla", text: "El equipo al completo.", points: p });
  }

  if ((s.can("lottery_admin") || s.can("lottery_sell")) && !s.off("lottery")) {
    const p: string[] = [];
    if (s.can("lottery_sell", "create"))
      p.push("Registra cada venta desde el móvil y mándale el justificante al comprador por WhatsApp.", "En «Mis ventas» ves lo que has vendido y apuntas lo que te paguen más tarde.");
    if (s.can("lottery_admin")) p.push("Crea campañas de lotería o rifa, reparte vendedores y talonarios y sigue el ranking de ventas.");
    if (s.can("lottery_admin", "update")) p.push("Publica la rifa para que cualquiera compruebe su número, y sortéala con el bombo.");
    steps.push({ key: "sorteos", href: "/loteria", target: "/loteria", icon: "Ticket", title: "Sorteos", text: "La lotería y las rifas del club.", points: p });
  }

  if (s.can("finances") || s.can("sponsors")) {
    const p = s.can("finances") ? ["El saldo de la temporada con los ingresos y los gastos.", "Los informes por categoría y por temporada."] : [];
    if (s.can("finances", "create")) p.splice(1, 0, "Apunta cada ingreso o gasto con la foto de su justificante.");
    if (s.can("finances")) p.push("Cuotas: lo que paga cada jugador, quién debe y el aviso a los que deben.");
    if (s.can("sponsors")) p.push("Patrocinadores: sus acuerdos, contratos y cobros.");
    steps.push({ key: "finanzas", href: "/finanzas", target: "/finanzas", icon: "Wallet", title: "Finanzas", text: "Las cuentas del club. Los jugadores no tienen acceso.", points: p });
  }

  const isSuper = s.profile.role === "superadmin";
  if (s.can("users") || s.can("lottery_admin", "update") || s.can("material") || isSuper) {
    const p: string[] = ["Arriba, «Para hoy» te dice lo que necesita atención."];
    if (s.can("users")) p.push("Equipo: da de alta a gente nueva, cambia su perfil y decide con casillas qué puede hacer cada perfil.");
    if (s.can("users", "update") || s.can("lottery_admin", "update")) p.push("Avisos: manda un aviso al móvil del equipo o lanza una votación de sí o no.");
    if (s.can("material")) p.push("Material: el inventario del club, en qué estado está cada cosa y quién la tiene.");
    if (isSuper) p.push("Control, solo para el superadministrador: el uso de la app, la auditoría y las copias de seguridad (una automática cada lunes).");
    steps.push({ key: "gestion", href: "/admin", target: "/admin", icon: "Settings", title: "Gestión", text: "El despacho del club, en cuatro cajones.", points: p });
  }

  steps.push({
    key: "perfil",
    href: "/perfil",
    target: "/perfil",
    icon: "UserRound",
    title: "Mi perfil",
    text: "Pulsa tu foto para llegar aquí.",
    points: [
      "Sube tu foto: sale en el menú y en tu cromo.",
      "Activa los avisos: convocatorias, resultados, el MVP y las noticias.",
      "Mi cuota (si juegas): lo que llevas pagado y lo que te falta. Y todas las votaciones.",
      "Desde aquí puedes repetir este tutorial cuando quieras.",
    ],
  });

  steps.push({
    key: "fin",
    href: "/",
    icon: "Trophy",
    title: "¡Listo para jugar!",
    text: manager
      ? "Ya conoces la app. Si algo no te cuadra, revisa los perfiles en Gestión o pregunta a otro gestor."
      : "Ya conoces la app. Si tienes alguna duda, pregunta a cualquier gestor.",
    points: ["Cuando la app se actualice, te contaremos las novedades al entrar. ¡Aúpa Rayo! ⚡"],
  });

  return steps;
}
