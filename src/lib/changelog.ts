/**
 * Registro de versiones de la app. La primera entrada es la versión actual.
 * Al publicar cambios: añadir una entrada arriba y subir "version" en package.json.
 * Versionado: MAYOR.MENOR.PARCHE (nueva fase o cambio grande · nueva función · arreglo).
 */
export type Release = { version: string; date: string; title: string; changes: string[] };

export const CHANGELOG: Release[] = [
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
