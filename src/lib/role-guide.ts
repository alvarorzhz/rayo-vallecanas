/** Explicación en lenguaje llano de qué permite cada permiso (para la guía de perfiles). */
export type Act = "read" | "create" | "update" | "delete";

export const ROLE_INFO: Record<string, { summary: string; who: string }> = {
  superadmin: {
    who: "Quien administra la app (por ejemplo, el presidente o el responsable de la app).",
    summary: "Puede hacerlo todo, sin excepciones. Es el único que puede archivar o eliminar campañas, nombrar a otros superadministradores y modificarlos.",
  },
  admin: {
    who: "Quienes gestionan los sorteos, las cuentas y los usuarios del club.",
    summary: "Gestiona los sorteos (lotería y rifas) de principio a fin, ve todas las ventas y cobros, lleva las cuentas del club en Finanzas, y da de alta y gestiona usuarios.",
  },
  player: {
    who: "Jugadores del equipo.",
    summary: "Vende lotería y rifas en las campañas en las que está asignado y ve solo sus propias ventas. No puede ver Finanzas.",
  },
};

export const MODULE_GUIDE: Record<string, { title: string; soon?: boolean; acts: Partial<Record<Act, string>> }> = {
  lottery_admin: {
    title: "Sorteos · gestión",
    acts: {
      read: "Ver todas las campañas (también los borradores), todas las ventas, cobros, compradores, la lista de números, el ranking de vendedores y descargar el Excel.",
      create: "Crear campañas de lotería o rifa y registrar ventas a nombre de cualquier vendedor.",
      update: "Editar campañas, activar o cerrar ventas, asignar vendedores y talonarios, reservar números, registrar cobros y devoluciones de cualquier venta y hacer el sorteo.",
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
      create: "Dar de alta (invitar por email) a nuevos usuarios.",
      update: "Cambiar el nombre, el rol y los permisos de otros usuarios, y deshabilitar o habilitar su acceso a la app.",
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
      create: "Apuntar ingresos y gastos con su justificante, y pasar a Finanzas lo cobrado en los sorteos.",
      update: "Corregir movimientos, cambiar el saldo inicial y gestionar las categorías.",
      delete: "Anular movimientos (con motivo; no se borran y quedan en auditoría).",
    },
  },
  squad: {
    title: "Plantilla",
    acts: {
      read: "Ver la plantilla de cada temporada (cromos, campo y lista) y las fichas: dorsal, posición, estado y trayectoria.",
      create: "Fichar jugadores nuevos.",
      update: "Editar fichas, fotos y dorsales, ver los datos personales (teléfono, emergencia, nacimiento) y las observaciones, y vincular fichas con usuarios.",
      delete: "Eliminar fichas creadas por error.",
    },
  },
  matches: { title: "Partidos", soon: true, acts: { read: "Ver el calendario y las convocatorias.", create: "Crear partidos.", update: "Editar partidos y convocatorias." } },
};

export const MENU_BY_MODULE: { module: string; act: Act; label: string }[] = [
  { module: "lottery_admin", act: "read", label: "Sorteos (todas las campañas)" },
  { module: "lottery_sell", act: "read", label: "Sorteos (sus campañas)" },
  { module: "lottery_sell", act: "create", label: "Mis ventas" },
  { module: "squad", act: "read", label: "Plantilla" },
  { module: "finances", act: "read", label: "Finanzas" },
  { module: "users", act: "read", label: "Usuarios" },
  { module: "audit", act: "read", label: "Auditoría" },
];
