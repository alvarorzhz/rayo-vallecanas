/**
 * Auditoría: nombres legibles de tablas y campos, y el «antes → ahora» de cada cambio.
 * Sin dependencias de servidor, para poder probarlo.
 */
import { madridToUtc } from "./polls.ts";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** «2026-11-08» → límites del día en hora de Madrid (ISO UTC), para los filtros «desde / hasta». */
export function madridDayRange(day: string | undefined, edge: "start" | "end"): string | null {
  if (!day || !DAY_RE.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const t = edge === "start" ? madridToUtc(y, m, d, 0, 0) : new Date(madridToUtc(y, m, d, 23, 59).getTime() + 59_999);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export type AuditRow = {
  id: number;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

/** Tablas agrupadas por apartado de la app (para el filtro). */
export const TABLE_GROUPS: { label: string; tables: Record<string, string> }[] = [
  {
    label: "Sorteos",
    tables: {
      lottery_campaigns: "Campaña",
      lottery_sales: "Venta",
      lottery_payments: "Cobro",
      lottery_booklets: "Talonario",
      lottery_campaign_sellers: "Vendedor asignado",
      lottery_shares: "Participación",
      buyers: "Comprador",
      notifications: "Justificante",
    },
  },
  {
    label: "Finanzas",
    tables: {
      finance_movements: "Movimiento económico",
      finance_categories: "Categoría económica",
      finance_settings: "Saldo inicial",
    },
  },
  {
    label: "Plantilla",
    tables: {
      players: "Jugador",
      player_private: "Datos personales",
      squad_members: "Ficha de temporada",
      player_documents: "Documento",
      squad_fee_plans: "Cuota de temporada",
      squad_fee_overrides: "Cuota especial",
    },
  },
  {
    label: "Partidos",
    tables: {
      matches: "Partido",
      rivals: "Rival",
      match_callups: "Convocatoria",
      match_appearances: "Acta · alineación",
      match_goals: "Acta · gol",
      mvp_polls: "Votación MVP",
      league_sync: "Sincronización de liga",
    },
  },
  {
    label: "Patrocinadores",
    tables: {
      sponsors: "Patrocinador",
      sponsor_agreements: "Acuerdo de patrocinio",
      sponsor_installments: "Plazo de patrocinio",
      sponsor_settings: "Logos de patrocinadores",
    },
  },
  {
    label: "Usuarios y app",
    tables: {
      profiles: "Usuario",
      user_permissions: "Permisos personalizados",
      role_permissions: "Permisos por perfil",
      custom_roles: "Perfil a medida",
      custom_role_permissions: "Permisos de perfil a medida",
      polls: "Votación",
      push: "Aviso",
      sessions: "Sesión",
      app: "App",
    },
  },
];
export const TABLE_LABEL: Record<string, string> = Object.assign({}, ...TABLE_GROUPS.map((g) => g.tables));

export const ACTION_LABEL: Record<string, string> = {
  INSERT: "Alta",
  UPDATE: "Modificación",
  DELETE: "Borrado",
  CANCEL_SALE: "Anulación",
  EXPORT: "Exportación",
  BACKUP: "Copia de seguridad",
  NOTICE: "Aviso enviado",
  DELETE_CAMPAIGN: "Eliminación de campaña",
  DRAW: "Sorteo",
  CLOSE_SESSION: "Sesión cerrada",
};
export const ACTION_TONE: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-sky-100 text-sky-800",
  DELETE: "bg-rojo/10 text-rojo",
  CANCEL_SALE: "bg-rojo/10 text-rojo",
  DELETE_CAMPAIGN: "bg-rojo/10 text-rojo",
  CLOSE_SESSION: "bg-amber-100 text-amber-800",
};

/** Nombres de los campos (los mismos en todas las tablas salvo excepción). */
const FIELD: Record<string, string> = {
  full_name: "Nombre", name: "Nombre", first_name: "Nombre", last_name: "Apellidos", nickname: "Apodo",
  email: "Email", phone: "Teléfono", role: "Perfil", active: "Activo", avatar_url: "Foto", photo_url: "Foto",
  must_change_password: "Debe cambiar la contraseña", notify_sales: "Avisos de ventas", custom_role_id: "Perfil a medida",
  module: "Módulo", can_read: "Puede ver", can_create: "Puede crear", can_update: "Puede editar", can_delete: "Puede borrar",
  description: "Descripción", base: "Perfil base",
  // Sorteos
  year: "Año", lottery_number: "Número jugado", draw_type: "Tipo de sorteo", draw_date: "Fecha del sorteo",
  price_cents: "Precio", played_cents: "Jugado por participación", donation_cents: "Donativo", total_shares: "Participaciones",
  numbering_mode: "Numeración", ref_prefix: "Prefijo de referencia", status: "Estado", winning_prize_cents: "Premio",
  winning_number: "Número ganador", archived_at: "Archivada", public_enabled: "Página pública", public_slug: "Enlace público",
  prize_text: "Premio (texto)", public_purpose: "Para qué es", kind: "Tipo",
  campaign_id: "Campaña", reference: "Referencia", buyer_id: "Comprador", seller_id: "Vendedor", quantity: "Cantidad",
  unit_price_cents: "Precio unidad", total_cents: "Total", paid_cents: "Pagado", payment_status: "Estado del pago",
  preferred_channel: "Canal preferido", cancelled_at: "Anulada el", cancelled_by: "Anulada por", cancel_reason: "Motivo de anulación",
  sale_id: "Venta", amount_cents: "Importe", method: "Forma de pago", paid_at: "Pagado el", registered_by: "Apuntado por",
  label: "Etiqueta", from_number: "Desde el número", to_number: "Hasta el número", user_id: "Usuario", assigned_by: "Asignado por",
  assigned_at: "Asignado el", share_number: "Número", booklet_id: "Talonario", marketing_consent: "Acepta comunicaciones",
  channel: "Canal", recipient: "Destinatario", attempts: "Intentos", provider_id: "Id del envío", error: "Error", sent_at: "Enviado el",
  // Finanzas
  op_date: "Fecha", season: "Temporada", concept: "Concepto", category_id: "Categoría", counterparty: "Quién",
  notes: "Notas", attachment_path: "Justificante", attachment_name: "Nombre del justificante", voided_at: "Anulado el",
  voided_by: "Anulado por", void_reason: "Motivo de anulación", player_id: "Jugador", fee_season: "Temporada de la cuota",
  sponsor_installment_id: "Plazo de patrocinio", opening_balance_cents: "Saldo inicial", opening_date: "Fecha del saldo inicial", sort: "Orden",
  // Plantilla
  foot: "Pie", height_cm: "Altura (cm)", joined_club_on: "En el club desde", number: "Dorsal", position: "Posición",
  armband: "Brazalete", joined_on: "Alta", left_on: "Baja", apps: "Partidos", starts: "Titularidades", goals: "Goles",
  assists: "Asistencias", yellows: "Amarillas", reds: "Rojas", mvps: "MVP", conceded: "Goles encajados", clean_sheets: "Porterías a cero",
  league_stats: "Estadísticas de la liga", birth_date: "Nacimiento", emergency_name: "Contacto de emergencia",
  emergency_phone: "Teléfono de emergencia", sport_notes: "Notas deportivas", internal_notes: "Notas internas",
  title: "Título", file_path: "Fichero", file_name: "Nombre del fichero", mime_type: "Tipo de fichero", size_bytes: "Tamaño",
  expires_on: "Caduca", uploaded_by: "Subido por", due_on: "Vence", reason: "Motivo",
  // Partidos
  match_date: "Fecha", kickoff: "Hora", competition: "Competición", round: "Jornada", rival_id: "Rival", is_home: "En casa",
  venue: "Campo", maps_url: "Mapa", goals_for: "Goles a favor", goals_against: "Goles en contra", meet_time: "Hora de quedada",
  meet_place: "Lugar de quedada", callup_notes: "Notas de la convocatoria", formation: "Sistema",
  callup_published_at: "Convocatoria publicada", callup_reminded_at: "Recordatorio enviado", mvp_player_id: "MVP",
  report_saved_at: "Acta guardada", report_by: "Acta por", match_id: "Partido", reply: "Respuesta", reply_note: "Comentario",
  replied_at: "Respondió el", replied_by: "Respondido por", slot: "Puesto", started: "Titular", goalkeeper: "Portero",
  red: "Roja", scorer_id: "Goleador", assist_id: "Asistente", own_goal: "En propia", short_name: "Nombre corto", color: "Color",
  crest_url: "Escudo", home_venue: "Su campo", home_maps_url: "Mapa de su campo", candidates: "Candidatos", closes_at: "Cierra",
  opened_by: "Abierta por", closed_at: "Cerrada el", winner_id: "Ganador", tie_ids: "Empatados", picked_by: "Desempate por",
  provider: "Fuente", competition_name: "Competición", team: "Equipo", last_synced_at: "Última sincronización",
  last_summary: "Resumen", updated_by: "Por",
  // Patrocinadores
  tier: "Categoría", logo_url: "Logo", website: "Web", instagram: "Instagram", contact_name: "Contacto",
  contact_phone: "Teléfono de contacto", contact_email: "Email de contacto", sponsor_id: "Patrocinador",
  in_kind: "En especie", in_kind_value_cents: "Valor en especie", benefits: "Contrapartidas", starts_on: "Empieza",
  ends_on: "Termina", contract_path: "Contrato", contract_name: "Nombre del contrato", expiry_reminded_at: "Aviso de fin enviado",
  agreement_id: "Acuerdo", reminded_at: "Recordatorio enviado", show_home: "Logos en Inicio", show_result: "Logos en la imagen del resultado",
  // Votaciones
  question: "Pregunta", details: "Detalles", audience: "Para quién", anonymous: "Anónima",
  created_by: "Creado por", created_at: "Creado el", ext_id: "Id en la liga",
};

/** Campos que no aportan nada al leer un cambio. */
const NOISE = new Set(["updated_at", "sale_seq", "refresh_token_hmac_key"]);

const fieldLabel = (key: string) => FIELD[key] ?? key.replace(/_/g, " ");

/** Valores con nombre propio según el campo (estados, tipos…). */
const VALUES: Record<string, Record<string, string>> = {
  role: { superadmin: "Superadministrador", admin: "Gestor", player: "Jugador" },
  base: { admin: "Gestor", player: "Jugador" },
  payment_status: { pending: "Pendiente", partial: "Parcial", paid: "Pagado", cancelled: "Anulada" },
  method: { cash: "Efectivo", bizum: "Bizum", transfer: "Transferencia", card: "Tarjeta", other: "Otro" },
  numbering_mode: { auto: "Automática", booklet: "Talonarios", manual: "Elección manual" },
  module: {
    lottery_admin: "Sorteos · gestión", lottery_sell: "Sorteos · vender", users: "Usuarios y permisos", audit: "Auditoría",
    finances: "Finanzas", squad: "Plantilla", squad_private: "Plantilla · datos personales", matches: "Partidos", sponsors: "Patrocinadores",
  },
  foot: { right: "Diestro", left: "Zurdo", both: "Ambidiestro" },
  armband: { captain: "Capitán", vice: "Segundo capitán" },
  competition: { league: "Liga", cup: "Copa", friendly: "Amistoso", tournament: "Torneo" },
  reply: { yes: "Voy", no: "No voy", maybe: "Duda", pending: "Sin responder" },
  tier: { main: "Principal", partner: "Colaborador" },
  channel: { whatsapp: "WhatsApp", email: "Email" },
  preferred_channel: { whatsapp: "WhatsApp", email: "Email" },
  audience: { all: "Todos", player: "Jugadores", admin: "Gestores" },
};
/** Estados y tipos que dependen de la tabla. */
const TABLE_VALUES: Record<string, Record<string, Record<string, string>>> = {
  lottery_campaigns: {
    status: { draft: "Borrador", active: "Activa", closed: "Cerrada", drawn: "Sorteada" },
    kind: { lottery: "Lotería", raffle: "Rifa" },
  },
  finance_movements: { kind: { income: "Ingreso", expense: "Gasto" } },
  finance_categories: { kind: { income: "Ingreso", expense: "Gasto" } },
  squad_members: { status: { active: "Activo", injured: "Lesionado", away: "Baja temporal", left: "Baja definitiva" } },
  matches: { status: { scheduled: "Pendiente", played: "Finalizado", postponed: "Aplazado", cancelled: "Suspendido" } },
  sponsor_agreements: {
    status: { negotiating: "Negociando", signed: "Firmado", cancelled: "Cancelado" },
    kind: { money: "Dinero", in_kind: "En especie", mixed: "Dinero y especie" },
  },
  notifications: { status: { pending: "Pendiente", sent: "Enviado", failed: "Fallido" } },
  lottery_shares: { status: { available: "Libre", reserved: "Reservada", sold: "Vendida", voided: "Anulada" } },
  player_documents: { kind: { dni: "DNI", federation: "Ficha federativa", medical: "Reconocimiento médico", authorization: "Autorización", insurance: "Seguro", other: "Otro" } },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

const madrid = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...opts });
const dayFmt = madrid({ dateStyle: "medium" });
const stampFmt = madrid({ dateStyle: "medium", timeStyle: "short" });
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

/** Valor legible: euros, Sí/No, fechas, nombres en vez de ids… */
export function formatValue(key: string, value: unknown, names: Map<string, string> = new Map(), table = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") {
    if (key.endsWith("_cents")) return eur.format(value / 100);
    if (key === "size_bytes") return value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;
    return String(value);
  }
  if (typeof value === "string") {
    const dict = TABLE_VALUES[table]?.[key] ?? VALUES[key];
    if (dict?.[value]) return dict[value];
    if (UUID.test(value)) return names.get(value) ?? `#${value.slice(0, 8)}`;
    if (DATE.test(value)) return dayFmt.format(new Date(`${value}T12:00:00Z`));
    if (STAMP.test(value) && !Number.isNaN(Date.parse(value))) return stampFmt.format(new Date(value));
    return value;
  }
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return value.map((v) => formatValue(key, v, names, table)).join(", ");
  }
  return JSON.stringify(value);
}

export type FieldChange = { key: string; label: string; before: string; after: string };

/** Campos que cambiaron en una modificación, con el valor anterior y el nuevo. */
export function changedFields(row: Pick<AuditRow, "old_data" | "new_data" | "table_name">, names?: Map<string, string>): FieldChange[] {
  const { old_data: o, new_data: n } = row;
  if (!o || !n) return [];
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])];
  return keys
    .filter((k) => !NOISE.has(k) && JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null))
    .map((k) => ({
      key: k,
      label: fieldLabel(k),
      before: formatValue(k, o[k], names, row.table_name),
      after: formatValue(k, n[k], names, row.table_name),
    }));
}

/** Todos los campos con valor de un alta o un borrado (sin ids internos ni campos vacíos). */
export function snapshotFields(data: Record<string, unknown> | null, table = "", names?: Map<string, string>): { key: string; label: string; value: string }[] {
  if (!data) return [];
  return Object.entries(data)
    .filter(([k, v]) => !NOISE.has(k) && k !== "id" && v !== null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => ({ key: k, label: fieldLabel(k), value: formatValue(k, v, names, table) }));
}

/** Texto corto que identifica el registro («Venta R-0012», «Bar El Barrio», «25,00 €»…). */
export function recordSummary(row: Pick<AuditRow, "old_data" | "new_data" | "table_name">, names: Map<string, string> = new Map()): string {
  const d = (row.new_data ?? row.old_data ?? {}) as Record<string, unknown>;
  const person = [d.first_name, d.last_name].filter(Boolean).join(" ");
  const direct = d.reference ?? d.name ?? d.full_name ?? d.title ?? d.question ?? d.concept ?? (person || null);
  if (direct) return String(direct);
  for (const k of ["player_id", "user_id", "match_id", "sponsor_id", "campaign_id"]) {
    const v = d[k];
    if (typeof v === "string" && names.has(v)) return names.get(v)!;
  }
  if (typeof d.amount_cents === "number") return eur.format(d.amount_cents / 100);
  return "";
}

/** Ids (uuid) que aparecen en los datos, para buscar sus nombres. */
export function collectIds(rows: Pick<AuditRow, "user_id" | "old_data" | "new_data">[]): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && UUID.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(add);
  };
  for (const r of rows) {
    add(r.user_id);
    for (const d of [r.old_data, r.new_data]) if (d) for (const [k, v] of Object.entries(d)) if (k !== "id") add(v);
  }
  return [...out];
}

export const ACCESS_EVENT_LABEL: Record<string, string> = {
  login: "Entrada",
  login_failed: "Intento fallido",
  link: "Entrada con enlace",
  logout: "Salida",
  password: "Cambio de contraseña",
  revoked: "Sesión cerrada a distancia",
  disabled: "Usuario deshabilitado",
};
export const ACCESS_EVENT_TONE: Record<string, string> = {
  login: "bg-green-100 text-green-800",
  link: "bg-green-100 text-green-800",
  login_failed: "bg-rojo/10 text-rojo",
  logout: "bg-black/10 text-negro/70",
  password: "bg-sky-100 text-sky-800",
  revoked: "bg-amber-100 text-amber-800",
  disabled: "bg-rojo/10 text-rojo",
};
