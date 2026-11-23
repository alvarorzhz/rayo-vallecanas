-- =====================================================================
-- v4.29.0 · Material deportivo (primera parte)
-- Nuevo módulo de permisos «Material».
-- Va en un archivo aparte: un valor nuevo de un enum no se puede usar
-- en la misma transacción en la que se crea.
-- =====================================================================
alter type public.app_module add value if not exists 'material' after 'sponsors';
