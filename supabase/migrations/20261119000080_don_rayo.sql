-- =====================================================================
-- v4.27.0 · Don Rayo, el presidente del club, da la rueda de prensa
-- · Cada crónica puede llevar la rueda de prensa de Don Rayo (un personaje de
--   broma): 4 o 5 frases que escribe la IA con los datos del acta y que la
--   redacción revisa. Se guarda en la propia noticia.
-- · press_audio_url: su voz (WAV creado una sola vez con la voz gratis de
--   Gemini), en la carpeta pública news-press. Sin audio, habla con la voz
--   del móvil.
-- · press_cues: cómo se mueve la boca y cuándo sale cada subtítulo.
-- · Lo escriben quienes pueden editar la noticia (las políticas de
--   news_articles ya lo cubren). El audio lo sube el servidor.
-- =====================================================================

alter table public.news_articles
  add column if not exists press_text      text check (press_text is null or length(press_text) between 20 and 800),
  add column if not exists press_audio_url text check (press_audio_url is null or length(press_audio_url) <= 500),
  add column if not exists press_cues      jsonb,
  add column if not exists press_at        timestamptz;

-- La voz de Don Rayo: pública para que se oiga sin pedir permiso a cada reproducción
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-press', 'news-press', true, 4194304, array['audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;
