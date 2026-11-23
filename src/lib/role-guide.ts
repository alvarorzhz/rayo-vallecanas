/** Explicación en lenguaje llano de qué permite cada permiso (para la guía de perfiles). */
export type Act = "read" | "create" | "update" | "delete";

export const ROLE_INFO: Record<string, { summary: string; who: string }> = {
  superadmin: {
    who: "Quien administra la app (por ejemplo, el presidente o el responsable de la app).",
    summary: "Puede hacerlo todo, sin excepciones. Es el único que puede archivar o eliminar campañas, nombrar a otros superadministradores y modificarlos, hacer públicas las noticias de La Voz y ver la auditoría y las copias de seguridad.",
  },
  admin: {
    who: "Quienes llevan el día a día del club: partidos, sorteos, cuentas y usuarios.",
    summary: "Lleva los partidos (convocatorias, acta en vivo, liga), la plantilla y La Voz del Rayo; gestiona los sorteos (lotería y rifas) de principio a fin, lleva las cuentas, las cuotas y los patrocinadores, manda avisos y votaciones, y da de alta y gestiona usuarios.",
  },
  player: {
    who: "Jugadores del equipo.",
    summary: "Vende lotería y rifas en las campañas en las que está asignado y ve solo sus propias ventas. Ve la plantilla, los partidos y La Voz del Rayo; contesta convocatorias, juega la porra, escribe en la cápsula del tiempo, vota al MVP, pone notas, contesta sus entrevistas y ve su propia cuota. Corrige sus propios datos y documentos. No puede ver Finanzas, los patrocinios ni los datos personales de otros.",
  },
};

export const MODULE_GUIDE: Record<string, { title: string; soon?: boolean; acts: Partial<Record<Act, string>> }> = {
  lottery_admin: {
    title: "Sorteos · gestión",
    acts: {
      read: "Ver todas las campañas (también los borradores), todas las ventas, cobros, compradores, la lista de números, el ranking de vendedores y descargar el Excel.",
      create: "Crear campañas de lotería o rifa y registrar ventas a nombre de cualquier vendedor.",
      update: "Editar campañas, activar o cerrar ventas, asignar vendedores y talonarios, reservar números, registrar cobros y devoluciones de cualquier venta, publicar la página pública de la rifa y hacer el sorteo con el bombo. También mandar avisos al equipo y lanzar votaciones de sí o no.",
      delete: "Anular ventas (con motivo; la venta no se borra y queda en auditoría).",
    },
  },
  lottery_sell: {
    title: "Sorteos · vender",
    acts: {
      read: "Ver las campañas activas en las que está asignado como vendedor y sus propias ventas.",
      create: "Registrar ventas en esas campañas y enviar el justificante al comprador.",
      update: "Apuntar los cobros de sus propias ventas cuando el comprador paga más tarde.",
    },
  },
  users: {
    title: "Usuarios y permisos",
    acts: {
      read: "Ver la lista de usuarios con su email, teléfono, rol y permisos.",
      create: "Dar de alta a usuarios nuevos con una contraseña provisional, que se les pasa por WhatsApp.",
      update: "Cambiar el nombre, el rol y los permisos de otros usuarios, deshabilitar o habilitar su acceso a la app, mandar avisos al equipo y lanzar votaciones de sí o no.",
    },
  },
  audit: {
    title: "Auditoría (solo superadministradores)",
    acts: { read: "Consultar el registro de todo lo que se ha hecho en la app: quién, qué y cuándo." },
  },
  finances: {
    title: "Finanzas (nunca para jugadores)",
    acts: {
      read: "Ver el saldo, los ingresos, los gastos, sus justificantes y los informes por temporada.",
      create: "Apuntar ingresos y gastos con su justificante, pasar a Finanzas lo cobrado en los sorteos y apuntar los pagos de las cuotas de los jugadores.",
      update: "Corregir movimientos, cambiar el saldo inicial, gestionar las categorías, fijar las cuotas y recordarlas a los que deben.",
      delete: "Anular movimientos (con motivo; no se borran y quedan en auditoría).",
    },
  },
  squad: {
    title: "Plantilla",
    acts: {
      read: "Ver la plantilla de cada temporada (cromos, campo y lista) y las fichas: dorsal, posición, estado, trayectoria, logros y amarillas del ciclo.",
      create: "Fichar jugadores nuevos, con su presentación animada.",
      update: "Editar fichas, fotos, dorsales y estadísticas, preparar temporadas, dar de baja y vincular fichas con usuarios.",
      delete: "Eliminar fichas creadas por error.",
    },
  },
  squad_private: {
    title: "Plantilla · datos personales (nunca para jugadores)",
    acts: {
      read: "Ver el teléfono, el email, el contacto de emergencia, la fecha de nacimiento, las observaciones y los documentos de cada jugador.",
      create: "Subir documentos a la ficha de los jugadores (DNI, ficha federativa, certificado médico…).",
      update: "Corregir los datos personales y las observaciones.",
      delete: "Borrar documentos.",
    },
  },
  matches: {
    title: "Partidos",
    acts: {
      read: "Ver el calendario, los resultados, la clasificación y el historial contra cada rival, contestar a su convocatoria (Voy, No voy o Duda), jugar la porra, escribir en la cápsula del tiempo, votar al MVP, poner notas a los compañeros y ver las actas, las estadísticas y los resúmenes de temporada.",
      create: "Añadir partidos al calendario.",
      update: "Editar partidos y rivales, sincronizar con la liga, poner el resultado, aplazar o suspender (con aviso al equipo), preparar y publicar las convocatorias con la alineación, llevar el acta en vivo desde la banda, rellenar el acta y sacar las imágenes para compartir.",
      delete: "Eliminar partidos y rivales creados por error.",
    },
  },
  news: {
    title: "La Voz del Rayo",
    acts: {
      read: "Leer el periódico del club (crónicas, previas, entrevistas, comunicados y promociones), reaccionar a las noticias y contestar las entrevistas que le hagan.",
      create: "Escribir piezas nuevas (con la ayuda de la IA si quiere), mandar entrevistas a los jugadores, guardarlas como borrador, publicarlas y editar o borrar las suyas.",
      update: "Editar y retirar cualquier pieza, también las de otros, y llevarlas a la portada de Inicio.",
      delete: "Eliminar cualquier pieza.",
    },
  },
  sponsors: {
    title: "Patrocinadores (nunca para jugadores)",
    acts: {
      read: "Ver en Gestión los patrocinadores con su contacto, los acuerdos de cada temporada (importes, qué reciben a cambio), los contratos y los plazos cobrados y pendientes.",
      create: "Dar de alta patrocinadores y acuerdos nuevos.",
      update: "Editar fichas, logos, acuerdos y plazos, y subir contratos. Para apuntar un cobro en Finanzas hace falta además poder crear movimientos en Finanzas.",
      delete: "Eliminar patrocinadores y acuerdos (si tienen cobros, primero hay que anularlos en Finanzas).",
    },
  },
  material: {
    title: "Material deportivo",
    acts: {
      read: "Ver en Gestión el inventario del club: cada artículo con sus piezas, estado (nuevo, usado, roto), tallas, dorsales y quién tiene cada cosa. Sin este permiso, cada jugador ve solo el material que tiene él, en su ficha.",
      create: "Dar de alta artículos nuevos y añadirles piezas.",
      update: "Cambiar el estado, la talla o el dorsal de las piezas, apuntar a quién se presta cada cosa y quitar piezas.",
      delete: "Eliminar un artículo entero con todas sus piezas.",
    },
  },
};

export const MENU_BY_MODULE: { module: string; act: Act; label: string }[] = [
  { module: "lottery_admin", act: "read", label: "Sorteos (todas las campañas)" },
  { module: "lottery_sell", act: "read", label: "Sorteos (sus campañas)" },
  { module: "lottery_sell", act: "create", label: "Mis ventas" },
  { module: "matches", act: "read", label: "Partidos" },
  { module: "squad", act: "read", label: "Plantilla" },
  { module: "finances", act: "read", label: "Finanzas" },
  { module: "sponsors", act: "read", label: "Patrocinadores" },
  { module: "material", act: "read", label: "Material" },
  { module: "news", act: "read", label: "La Voz del Rayo" },
  { module: "users", act: "read", label: "Usuarios" },
  { module: "audit", act: "read", label: "Auditoría" },
];
