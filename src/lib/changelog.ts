/**
 * Registro de versiones de la app. La primera entrada es la versión actual.
 * Al publicar cambios: añadir una entrada arriba y subir "version" en package.json.
 * Versionado: MAYOR.MENOR.PARCHE (nueva fase o cambio grande · nueva función · arreglo).
 */
export type Release = { version: string; date: string; title: string; changes: string[] };

export const CHANGELOG: Release[] = [
  {
    version: "2.1.0",
    date: "2026-11-06",
    title: "Temporadas e historia de la plantilla",
    changes: [
      "Preparar la temporada nueva en un momento: eliges quién sigue y se copian sus posiciones, dorsales y capitanes. Las estadísticas empiezan a cero.",
      "Al preparar la temporada también puedes recuperar a jugadores que se fueron o a exjugadores de otros años.",
      "Bajas con fecha desde la ficha del jugador («Dar de baja»): deja libre su dorsal y su historia se conserva. Si vuelve, «Reincorporar».",
      "Nueva página «Historia» en Plantilla: cada temporada con sus jugadores, fichajes, bajas, goles, pichichi y capitán.",
      "Récords del club (máximo goleador, más partidos, más asistencias y más temporadas), los dorsales que ha llevado cada jugador y la lista de exjugadores.",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-11-06",
    title: "Plantilla: las fichas de todo el equipo",
    changes: [
      "Nuevo apartado «Plantilla» en el menú, para todo el equipo: los jugadores de cada temporada con su dorsal, posición y estado.",
      "Cromos de cada jugador al estilo de los juegos de fútbol: foto, dorsal y posición, y seis estadísticas de la temporada. Dorados si está disponible, plateados si está lesionado o de baja.",
      "Vista del campo de fútbol 7 con cada jugador en su línea, y vista de lista. Filtros por línea, estado y búsqueda por nombre o dorsal.",
      "Marcador de la plantilla (jugadores, disponibles, lesionados, edad media y reparto por líneas) y líderes de la temporada: pichichi, asistente, más partidos y MVP.",
      "Estadísticas por temporada: partidos, titularidades, goles, asistencias, MVP, tarjetas y, en los porteros, goles encajados y porterías a cero. De momento las apuntan los gestores; con los partidos (fase 4) se calcularán solas.",
      "Ficha de cada jugador con su cromo, perfil (pierna, altura, edad, años en el club), estadísticas de la temporada y trayectoria con los totales en el club.",
      "Los gestores fichan jugadores eligiendo la posición en un campo de fútbol 7, ven qué dorsales están libres y no se puede repetir dorsal ni capitán en una temporada.",
      "Datos personales (teléfono, email, nacimiento y contacto de emergencia) y observaciones: solo los ven los gestores. Botones para llamar o escribir por WhatsApp.",
      "Un jugador no necesita usuario para estar en la plantilla. Desde su ficha se vincula con su usuario o se le crea el acceso con contraseña provisional.",
      "Cada jugador ve «Tu ficha» en el inicio y puede corregir sus datos de contacto. La foto de su perfil pasa a su ficha.",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-11-06",
    title: "Informes de Finanzas y exportación a Excel y PDF",
    changes: [
      "Nueva pantalla «Informes» en Finanzas: ingresos y gastos de cada mes, evolución del saldo, reparto por categorías y balance de cada temporada.",
      "Exporta los movimientos a Excel o a PDF con el escudo, desde Informes o desde la lista de movimientos (respeta los filtros).",
      "En la lista de movimientos ya se puede filtrar por fechas (desde/hasta), además de por temporada.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-11-06",
    title: "Finanzas: ingresos, gastos y saldo",
    changes: [
      "Nuevo apartado «Finanzas» para llevar las cuentas del club y dejar el Excel: apunta ingresos y gastos con fecha, concepto, categoría, importe, método de pago, persona o proveedor y observaciones.",
      "Se puede adjuntar la foto o el PDF de la factura o el justificante; se guarda en privado.",
      "El saldo actual se calcula solo a partir del saldo inicial (Finanzas → Saldo inicial y categorías).",
      "Temporadas de septiembre a agosto: ingresos, gastos y resultado de cada temporada, y reparto por categorías.",
      "Lista de movimientos con filtros por temporada, tipo, categoría y búsqueda por texto.",
      "Los movimientos no se borran: se anulan con un motivo y queda constancia en la auditoría.",
      "En cada sorteo, un botón pasa a Finanzas lo cobrado (solo lo que aún no se había pasado).",
      "Los jugadores no pueden ver Finanzas en ningún caso.",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-11-05",
    title: "Avisos al móvil y nuevo panel de Gestión",
    changes: [
      "Notificaciones en el móvil: al entrar, la app pregunta si quieres activarlas. Avisa cuando se abre un sorteo, con cada venta nueva (a los gestores) y cuando sale el número ganador.",
      "Nuevo apartado «Gestión» que reúne Usuarios, Perfiles, Avisos, Auditoría y Copia de seguridad.",
      "Desde Gestión → Avisos se puede mandar una notificación a todo el equipo.",
      "Alta de usuarios con contraseña provisional, sin necesidad de email: la app la crea y se manda por WhatsApp. Al entrar, cada uno elige la suya.",
      "Copia de seguridad de todos los datos en Excel y en archivo completo (solo superadministradores).",
      "Nueva página de Protección de datos, enlazada en el inicio de sesión, en la venta y en el justificante.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-11-05",
    title: "Fotos de perfil y justificante en PDF",
    changes: [
      "Cada usuario puede subir su foto desde «Mi perfil» (pulsando en su nombre o en su foto).",
      "El perfil «Directiva» pasa a llamarse «Gestor» y se elimina «Responsable deportivo».",
      "La sección «Lotería» del menú pasa a llamarse «Sorteos».",
      "En el panel de cada sorteo lo primero es lo vendido y lo que queda por vender; lo cobrado pasa a segundo plano.",
      "Nuevo botón «Descargar justificante (PDF)», que funciona también en la app instalada en el móvil.",
      "El envío por email queda deshabilitado hasta que esté configurado.",
      "La auditoría solo la ven los superadministradores.",
    ],
  },
  {
    version: "1.4.2",
    date: "2026-11-05",
    title: "Emojis del justificante",
    changes: ["Arreglado: los emojis del mensaje de WhatsApp salían como «�»."],
  },
  {
    version: "1.4.1",
    date: "2026-11-05",
    title: "Justificante más cercano",
    changes: [
      "El mensaje de WhatsApp del justificante es más cercano, saluda por el nombre e indica el día del sorteo.",
      "Arreglado: las comillas salían como «&#34;» y algún emoji se veía roto.",
      "Se quita el aviso de que no sustituye a la participación física.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-11-05",
    title: "Guía de perfiles y cambios de pantalla al instante",
    changes: [
      "Nueva página «Qué hace cada perfil» (en Usuarios): qué ve y qué puede hacer cada perfil, sacado de los permisos reales.",
      "Las pantallas principales se cargan por adelantado al entrar en la app y se abren al instante.",
      "Al volver a una pantalla ya vista se muestra enseguida y los datos se actualizan solos en segundo plano.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-11-05",
    title: "Nuevo diseño y control de acceso",
    changes: [
      "Nuevo diseño más deportivo: tipografía condensada, franja diagonal del Rayo y menús renovados.",
      "Se puede deshabilitar temporalmente el acceso de un usuario (y volver a habilitarlo) desde Usuarios, sin perder sus datos.",
      "Arreglos en móvil: tarjetas y textos largos ya no se salen de la pantalla.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-11-05",
    title: "Archivar campañas y app más rápida",
    changes: [
      "Los superadministradores pueden archivar campañas (se ocultan pero no se pierde nada) y recuperarlas.",
      "Los superadministradores pueden eliminar una campaña para siempre, escribiendo su nombre para confirmar.",
      "Explicaciones paso a paso al registrar una venta y al crear una campaña.",
      "Las páginas cargan bastante más rápido: el servidor de la app está ahora en Europa, junto a la base de datos.",
      "Animaciones al cambiar de página y una barra de carga arriba mientras se abre la siguiente.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-05",
    title: "Rifas y novedades",
    changes: [
      "Nuevo tipo de campaña «Rifa»: números del 1 al total, cada uno vendido a una persona.",
      "Al vender en una rifa se eligen los números tocándolos en una cuadrícula.",
      "Lista de números con comprador, teléfono y vendedor, con buscador.",
      "Sorteo de la rifa: registra el número ganador o sortéalo al azar entre los vendidos, y ve quién lo compró y quién lo vendió.",
      "El Excel incluye una hoja «Números» con comprador y vendedor de cada número.",
      "Justificantes de rifa con los números comprados.",
      "Registro de versiones: aviso al actualizar y página de Novedades con el histórico.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-05",
    title: "Primera versión: lotería",
    changes: [
      "Acceso con usuario y contraseña; altas solo por invitación.",
      "Roles (superadministrador, directiva, entrenador, jugador) y permisos personalizables por persona.",
      "Campañas de lotería: número, precio, donativo, numeración automática, por talonarios o manual.",
      "Registro de ventas desde el móvil, cobros parciales y anulaciones.",
      "Justificante por WhatsApp con referencia única.",
      "Panel de la campaña, ranking de vendedores, exportación a Excel y registro de auditoría.",
      "Instalable en el móvil como aplicación.",
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
