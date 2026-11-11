-- =====================================================================
-- v4.0.0 · La Voz del Rayo (primera parte)
-- Nuevo módulo de permisos «La Voz del Rayo» (noticias).
-- Va en un archivo aparte: un valor nuevo de un enum no se puede usar
-- en la misma transacción en la que se crea.
-- =====================================================================
alter type public.app_module add value if not exists 'news' after 'sponsors';
