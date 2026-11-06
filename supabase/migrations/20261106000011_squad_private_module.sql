-- =====================================================================
-- Fase 3 · Plantilla (v2.2.0, primera parte)
-- Nuevo módulo de permisos «Datos personales de la plantilla».
-- Va en un archivo aparte: un valor nuevo de un enum no se puede usar
-- en la misma transacción en la que se crea.
-- =====================================================================
alter type public.app_module add value if not exists 'squad_private' after 'squad';
