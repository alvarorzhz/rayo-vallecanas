-- =====================================================================
-- v3.14.0 · Patrocinadores (primera parte)
-- Nuevo módulo de permisos «Patrocinadores».
-- Va en un archivo aparte: un valor nuevo de un enum no se puede usar
-- en la misma transacción en la que se crea.
-- =====================================================================
alter type public.app_module add value if not exists 'sponsors' after 'matches';
