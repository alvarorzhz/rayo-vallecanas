# Registro de cambios de la base de datos

Va junto al registro de la app (`src/lib/changelog.ts`, lo que se ve en *Novedades*): aquí solo están las versiones que **cambiaron la base de datos**, con su migración. Las versiones que no salen aquí no traen SQL.

**Cómo se apunta un cambio** (en el mismo PR que la migración):

1. Añade una fila arriba del todo con la migración, la versión de la app, qué cambia y si toca datos o solo funciones.
2. Deja «En producción» como **Pendiente** hasta que el SQL se haya ejecutado en el *SQL Editor* de producción; entonces cámbialo por la fecha.
3. Una prueba (`src/lib/__tests__/docs.test.ts`) falla si alguna migración de `supabase/migrations/` no aparece en esta tabla.

Producción: proyecto Supabase `cakmcerhielecrfxgdlk`. Para ver qué hay aplicado de verdad: *Database → Migrations* en el panel, o la lista de este documento si se ejecutaron a mano en el SQL Editor (lo normal en este proyecto).

| Migración | Versión | Qué cambia | Toca datos | En producción |
|---|---|---|---|---|
| `20261127000200_audit_compact.sql` | 4.32.2 | Auditoría más ligera: solo los campos que cambian (columna `changed`), datos privados de jugadores ocultos, textos largos recortados y `purge_audit_log()` (2 años, la llama la copia de los lunes); compacta lo que ya había | Columna nueva + datos compactados | 2026-11-27 |
| `20261125000190_booklet_pick.sql` | 4.31.1 | Talonarios a medida: elegir números dentro del talonario, corregir y quitar talonarios | Solo funciones | 2026-11-25 |
| `20261125000180_app_control.sql` | 4.31.0 | Mandos de la app: tabla `app_settings`, mantenimiento, mensaje fijo, apartados, cerrar sesiones, forzar actualización | Tabla nueva | 2026-11-25 |
| `20261125000170_remove_member.sql` | 4.30.7 | Dar de baja usuarios borrando sus datos (`remove_member`, `profiles.removed_at`) | Columna nueva | 2026-11-25 |
| `20261125000160_raffle_draw_closed.sql` | 4.30.6 | La rifa solo se sortea con las ventas cerradas | Solo funciones | 2026-11-25 |
| `20261125000150_callup_newcomers.sql` | 4.30.5 | Los fichajes entran solos en la convocatoria abierta | Disparador nuevo | 2026-11-25 |
| `20261123000140_polls_live.sql` | 4.29.1 | Votaciones «en directo» | Columna nueva | 2026-11-23 |
| `20261123000131_material.sql` | 4.29.0 | Inventario de material: `material_items`, `material_lots` | Tablas nuevas | 2026-11-23 |
| `20261123000130_material_module.sql` | 4.29.0 | Módulo de permisos «Material» (va aparte: un valor nuevo de enum no se puede usar en la misma transacción) | Enum | 2026-11-23 |
| `20261123000120_mvp_tiebreak_rating.sql` | 4.28.3 | Desempate del MVP: votos → nota → goles → gestor | Solo funciones | 2026-11-23 |
| `20261123000110_member_list_grant.sql` | 4.28.2 | Vuelven los nombres en la auditoría (permiso de `member_list`) | Solo permisos | 2026-11-23 |
| `20261122000100_ratings_top3.sql` | 4.28.1 | Al cerrar, solo se ve la nota del podio | Solo funciones | 2026-11-22 |
| `20261120000090_goals_by_league.sql` | 4.28.0 | Apertura y Clausura en la misma temporada: objetivos por liga | Columna nueva | 2026-11-22 |
| `20261119000080_don_rayo.sql` | 4.27.0 | Rueda de prensa de Don Rayo y cajón `news-press` | Columnas + cajón | 2026-11-20 |
| `20261119000070_time_capsule.sql` | 4.26.0 | Cápsula del tiempo: `time_capsules`, `capsule_predictions`, `capsule_messages` | Tablas nuevas | 2026-11-19 |
| `20261118000060_rls_initplan.sql` | 4.21.1 | Velocidad: permisos una vez por consulta (`(select has_perm(...))`) | Políticas | 2026-11-18 |
| `20261117000050_advisor_fixes.sql` | 4.20.3 | Avisos de seguridad de Supabase (disparadores, `member_list`, políticas) | Políticas y funciones | 2026-11-17 |
| `20261117000043_stability_fixes.sql` | 4.20.1 | Referencias de venta repetidas entre sorteos y borrar sorteo pasado a Finanzas | Solo funciones | 2026-11-17 |
| `20261117000042_season_goals.sql` | 4.20.0 | Objetivos de temporada: `season_goals` | Tabla nueva | 2026-11-17 |
| `20261117000041_raffle_handovers.sql` | 4.20.0 | Cuentas de los vendedores: `lottery_handovers` | Tabla nueva | 2026-11-17 |
| `20261116000040_app_errors.sql` | 4.19.0 | Registro de fallos: `app_errors` | Tabla nueva | 2026-11-17 |
| `20261115000039_usage.sql` | 4.16.0 | Uso de la app: `usage_daily`, `track_usage` | Tabla nueva | 2026-11-15 |
| `20261114000038_player_ratings.sql` | 4.13.0 | Notas de los jugadores: `player_ratings` | Tabla nueva | 2026-11-14 |
| `20261114000037_live_birthdays.sql` | 4.12.0 | Acta en vivo (`match_live_events`) y felicitaciones (`birthday_wishes`) | Tablas nuevas | 2026-11-14 |
| `20261113000036_news_reactions.sql` | 4.10.0 | Reacciones en La Voz: `news_reactions` | Tabla nueva | 2026-11-13 |
| `20261112000035_porra.sql` | 4.9.0 | La porra: `match_predictions` | Tabla nueva | 2026-11-12 |
| `20261111000034_news_promo.sql` | 4.3.0 | Piezas de promoción para patrocinadores | Columnas | 2026-11-11 |
| `20261111000033_news_interviews.sql` | 4.2.0 | Entrevistas que contesta el jugador: `news_interviews` | Tabla nueva | 2026-11-11 |
| `20261111000032_news_public.sql` | 4.1.0 | Noticias públicas (`news_public*`) | Columnas + funciones | 2026-11-11 |
| `20261111000031_news.sql` | 4.0.0 | La Voz del Rayo: `news_articles`, cajón `news-photos` | Tabla nueva | 2026-11-11 |
| `20261111000030_news_module.sql` | 4.0.0 | Módulo de permisos «La Voz del Rayo» | Enum | 2026-11-11 |
| `20261111000029_last_seen.sql` | 3.28.2 | Última conexión y sesiones abiertas: `user_activity`, `session_activity`, `session_alive` | Tablas nuevas | 2026-11-11 |
| `20261111000028_league_competitions.sql` | 3.27.0 | Liga reutilizable: `league_competitions`, `matches.league_competition`, estadísticas por competición | Tabla + columnas | 2026-11-11 |
| `20261108000027_audit_access.sql` | 3.21.0 | Auditoría detallada (antes/ahora) y `access_log` | Tabla + disparadores | 2026-11-08 |
| `20261108000026_mvp_votes.sql` | 3.20.0 | MVP votado por el equipo: `mvp_polls`, `mvp_votes` | Tablas nuevas | 2026-11-08 |
| `20261108000025_polls.sql` | 3.17.0 | Votaciones sí/no: `polls`, `poll_votes`, `push_log` | Tablas nuevas | 2026-11-08 |
| `20261108000021_sponsors.sql` | 3.14.0 | Patrocinadores: `sponsors`, `sponsor_agreements`, `sponsor_installments`, `sponsor_settings` | Tablas nuevas | 2026-11-08 |
| `20261108000020_sponsors_module.sql` | 3.14.0 | Módulo de permisos «Patrocinadores» | Enum | 2026-11-08 |
| `20261108000019_raffle_public.sql` | 3.11.0 | Página pública de la rifa, acta (`lottery_raffle_events`) y huella | Tabla nueva | 2026-11-08 |
| `20261107000018_custom_roles.sql` | 3.3.0 | Perfiles a medida: `custom_roles`, `custom_role_permissions` | Tablas nuevas | 2026-11-07 |
| `20261106000017_match_reports.sql` | 3.2.0 | Actas: `match_appearances`, `match_goals` | Tablas nuevas | 2026-11-06 |
| `20261106000016_callups.sql` | 3.1.0 | Convocatorias: `match_callups` | Tabla nueva | 2026-11-06 |
| `20261106000015_league_sync.sql` | 3.0.2 | Sincronizar con futormes: `league_sync` | Tabla nueva | 2026-11-06 |
| `20261106000014_matches.sql` | 3.0.0 | Partidos: `matches`, `rivals`, cajón `rival-crests` | Tablas nuevas | 2026-11-06 |
| `20261106000013_security_review.sql` | 2.2.1 | Revisión de seguridad antes de la fase 4 | Políticas | 2026-11-06 |
| `20261106000012_squad_docs_fees.sql` | 2.2.0 | Documentos y cuotas: `player_documents`, `squad_fee_plans`, `squad_fee_overrides`, cajón `player-docs` | Tablas nuevas | 2026-11-06 |
| `20261106000011_squad_private_module.sql` | 2.2.0 | Módulo de permisos «Datos personales» | Enum | 2026-11-06 |
| `20261106000010_squad_f7_stats.sql` | 2.0.0 | Fútbol 7: posiciones y estadísticas por temporada | Columnas | 2026-11-06 |
| `20261106000009_squad.sql` | 2.0.0 | Plantilla: `players`, `player_private`, `squad_members`, cajón `player-photos` | Tablas nuevas | 2026-11-06 |
| `20261106000008_finances.sql` | 1.7.0 | Finanzas: `finance_*`, cajón `finance-docs` | Tablas nuevas | 2026-11-06 |
| `20261105000007_push_backup.sql` | 1.6.0 | Contraseña provisional, avisos push (`push_subscriptions`, `app_secrets`) y copia | Tablas nuevas | 2026-11-05 |
| `20261105000006_roles_avatars.sql` | 1.5.0 | Fuera el perfil «Responsable deportivo», fotos de perfil (cajón `avatars`) | Datos + cajón | 2026-11-05 |
| `20261105000005_archive_delete.sql` | 1.2.0 | Archivar y eliminar campañas | Columnas + funciones | 2026-11-05 |
| `20261105000004_raffle.sql` | 1.1.0 | Modo rifa (números del 1 al N) | Columnas + funciones | 2026-11-05 |
| `20261105000003_hardening.sql` | 1.0.0 | Endurecimiento según los avisos de Supabase | Permisos de funciones | 2026-11-05 |
| `20261104000002_lottery.sql` | 1.0.0 | Lotería: campañas, compradores, ventas, participaciones, cobros, justificantes | Tablas nuevas | 2026-11-04 |
| `20261104000001_core.sql` | 1.0.0 | Núcleo: usuarios (`profiles`), perfiles, permisos y auditoría | Tablas nuevas | 2026-11-04 |

Las fechas de «En producción» de las migraciones anteriores a la 4.12.0 son las de su versión: el historial de git se reagrupó en la 4.12.0 y no conserva el día exacto en que se ejecutaron.
