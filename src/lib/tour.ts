import type { Session } from "@/lib/session";

/**
 * Tutorial de bienvenida: recorrido por las páginas de la app adaptado a lo que puede ver cada perfil.
 * Si se añade una sección nueva, añadir aquí su paso. Si cambia mucho el recorrido, subir TOUR_VERSION
 * para que todos lo vuelvan a ver.
 */
export const TOUR_VERSION = 1;

export type TourStep = {
  key: string;
  /** Página a la que lleva el paso (si no tiene, se queda donde está). */
  href?: string;
  /** Elemento del menú que se resalta: el valor de su atributo data-tour. */
  target?: string;
  icon: "Sparkles" | "Home" | "CalendarDays" | "Shirt" | "Ticket" | "Wallet" | "Settings" | "UserRound" | "Trophy";
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
  if (s.can("matches")) home.push("El próximo partido con su cuenta atrás y tu convocatoria para contestar.");
  if (s.can("matches")) home.push("La víspera y el día del partido, Inicio se convierte en el Especial Matchday, y después el resultado se queda dos días en portada con el MVP y lo que hiciste tú.");
  if (s.can("lottery_admin") || s.can("lottery_sell")) home.push("El sorteo que está abierto y cómo va la venta.");
  if (s.can("finances")) home.push("El saldo del club de un vistazo.");
  if (s.can("squad")) home.push("Tu temporada: tu cromo, tus goles, tus rachas y tus últimos partidos.");
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
      "El calendario de la temporada, los resultados y la racha del equipo.",
      "Si te convocan, contesta «Voy», «Duda» o «No voy» desde el partido.",
      "Actas, goleadores, MVP y la página de estadísticas con el pichichi y el zamora.",
    ];
    if (s.can("matches", "update"))
      p.push("Como gestor: añade partidos, sincroniza con la liga, prepara la convocatoria con la alineación y rellena el acta.");
    steps.push({ key: "partidos", href: "/partidos", target: "/partidos", icon: "CalendarDays", title: "Partidos", text: "Todo lo que pasa en el campo.", points: p });
  }

  if (s.can("squad")) {
    const p = ["Los cromos de cada jugador con su foto y sus estadísticas, el campo y la lista.", "Entra en tu ficha para subir tu foto y revisar tus datos.", "La historia del equipo temporada a temporada."];
    if (s.can("squad_private")) p.push("Las cuotas de cada jugador y sus documentos (DNI, ficha, reconocimiento médico).");
    if (s.can("squad", "update")) p.push("Fichar jugadores, preparar la temporada nueva y exportar la plantilla a Excel.");
    steps.push({ key: "plantilla", href: "/plantilla", target: "/plantilla", icon: "Shirt", title: "Plantilla", text: "El equipo al completo.", points: p });
  }

  if (s.can("lottery_admin") || s.can("lottery_sell")) {
    const p: string[] = [];
    if (s.can("lottery_sell", "create"))
      p.push("Registra cada venta desde el móvil: el número se asigna solo y le mandas el justificante al comprador por WhatsApp.", "En «Mis ventas» ves lo que has vendido y apuntas lo que te paguen más tarde.");
    if (s.can("lottery_admin")) p.push("Crea campañas de lotería o rifa, reparte vendedores y talonarios y sigue el ranking de ventas.");
    if (s.can("lottery_admin", "update")) p.push("Cuando toque, haz el sorteo y apunta el número ganador.");
    steps.push({ key: "sorteos", href: "/loteria", target: "/loteria", icon: "Ticket", title: "Sorteos", text: "La lotería y las rifas del club.", points: p });
  }

  if (s.can("finances")) {
    const p = ["El saldo de la temporada con los ingresos y los gastos.", "Los informes por categoría y por temporada."];
    if (s.can("finances", "create")) p.splice(1, 0, "Apunta cada ingreso o gasto con la foto de su justificante.");
    steps.push({ key: "finanzas", href: "/finanzas", target: "/finanzas", icon: "Wallet", title: "Finanzas", text: "Las cuentas del club. Los jugadores no tienen acceso.", points: p });
  }

  const isSuper = s.profile.role === "superadmin";
  if (s.can("users") || s.can("lottery_admin", "update") || s.can("sponsors") || isSuper) {
    const p: string[] = [];
    if (s.can("users")) p.push("Usuarios: da de alta a gente nueva y cambia su perfil.", "Perfiles: decide con casillas qué puede hacer cada perfil.");
    if (s.can("sponsors")) p.push("Patrocinadores: sus acuerdos, contratos y cobros.");
    if (s.can("users", "update") || s.can("lottery_admin", "update")) p.push("Avisos: manda un aviso al móvil de todo el equipo.");
    if (isSuper) p.push("Auditoría y copia de seguridad (solo superadministrador).");
    steps.push({ key: "gestion", href: "/admin", target: "/admin", icon: "Settings", title: "Gestión", text: "El panel de control del club.", points: p });
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
      "Activa los avisos para enterarte de convocatorias, resultados y sorteos.",
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
