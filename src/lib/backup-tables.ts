/**
 * Tablas que entran en la copia de seguridad, con el nombre de la hoja en el Excel.
 * Al crear una tabla nueva en una migración, añádela aquí (una prueba lo comprueba).
 */
export const BACKUP_TABLES: [string, string][] = [
  ["profiles", "Usuarios"],
  ["role_permissions", "Permisos por perfil"],
  ["user_permissions", "Permisos personalizados"],
  ["custom_roles", "Perfiles a medida"],
  ["custom_role_permissions", "Perfiles a medida · permisos"],
  ["lottery_campaigns", "Campañas"],
  ["lottery_campaign_sellers", "Vendedores asignados"],
  ["lottery_booklets", "Talonarios"],
  ["buyers", "Compradores"],
  ["lottery_sales", "Ventas"],
  ["lottery_shares", "Participaciones y números"],
  ["lottery_payments", "Cobros"],
  ["lottery_raffle_events", "Sorteos · acta"],
  ["notifications", "Justificantes enviados"],
  ["finance_settings", "Finanzas · saldo inicial"],
  ["finance_categories", "Finanzas · categorías"],
  ["finance_movements", "Finanzas · movimientos"],
  ["players", "Plantilla · jugadores"],
  ["player_private", "Plantilla · datos personales"],
  ["squad_members", "Plantilla · temporadas"],
  ["player_documents", "Plantilla · documentos"],
  ["squad_fee_plans", "Plantilla · cuotas"],
  ["squad_fee_overrides", "Plantilla · cuotas especiales"],
  ["rivals", "Partidos · rivales"],
  ["matches", "Partidos"],
  ["match_callups", "Partidos · convocatorias"],
  ["match_appearances", "Partidos · alineaciones"],
  ["match_goals", "Partidos · goles"],
  ["mvp_polls", "Partidos · votación MVP"],
  ["mvp_votes", "Partidos · votos MVP"],
  ["player_ratings", "Partidos · notas de los jugadores"],
  ["league_competitions", "Liga · competiciones"],
  ["league_sync", "Liga · sincronización"],
  ["sponsors", "Patrocinadores"],
  ["sponsor_agreements", "Patrocinadores · acuerdos"],
  ["sponsor_installments", "Patrocinadores · plazos"],
  ["sponsor_settings", "Patrocinadores · ajustes"],
  ["material_items", "Material · artículos"],
  ["material_lots", "Material · piezas"],
  ["match_predictions", "Partidos · porra"],
  ["match_live_events", "Partidos · directo"],
  ["birthday_wishes", "Plantilla · felicitaciones"],
  ["polls", "Votaciones"],
  ["poll_votes", "Votaciones · votos"],
  ["news_articles", "La Voz del Rayo · noticias"],
  ["news_interviews", "La Voz del Rayo · entrevistas"],
  ["news_reactions", "La Voz del Rayo · reacciones"],
  ["push_log", "Avisos enviados"],
  ["audit_log", "Auditoría"],
  ["access_log", "Auditoría · accesos"],
  ["user_activity", "Auditoría · última conexión"],
  ["session_activity", "Auditoría · sesiones"],
  ["usage_daily", "Uso de la app"],
  ["lottery_handovers", "Sorteos · entregas de los vendedores"],
  ["season_goals", "Partidos · objetivos de temporada"],
  ["app_errors", "Uso de la app · fallos"],
  ["time_capsules", "Cápsula del tiempo"],
  ["capsule_predictions", "Cápsula · predicciones"],
  ["capsule_messages", "Cápsula · mensajes"],
];

/**
 * 4.26.0 · Tablas bajo llave: la copia solo se lleva las filas de las cápsulas ya abiertas
 * (si no, el superadministrador podría leer en el Excel lo que aún no se puede leer en la app).
 */
export const BACKUP_SEALED = ["capsule_predictions", "capsule_messages"];

/** Tablas que NO se copian a propósito: claves privadas del servidor y los dispositivos de los avisos. */
export const BACKUP_SKIPPED = ["app_secrets", "push_subscriptions"];
