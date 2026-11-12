-- =====================================================================
-- v4.3.0 · La Voz del Rayo: piezas de «Promoción» para los patrocinadores
-- · Nuevo tipo de pieza 'promocion', atada a un patrocinador.
-- · El nombre, el logo y la web del patrocinador salen de su ficha
--   (Gestión → Patrocinadores); nunca su contacto ni su acuerdo.
-- Requiere haber ejecutado antes la-voz-v4.0.0 y patrocinadores-v3.14.0.
-- =====================================================================

alter table public.news_articles drop constraint if exists news_articles_kind_check;
alter table public.news_articles add constraint news_articles_kind_check
  check (kind in ('cronica', 'previa', 'entrevista', 'comunicado', 'promocion'));

alter table public.news_articles
  add column if not exists sponsor_id uuid references public.sponsors (id) on delete set null;
create index if not exists news_articles_sponsor_idx on public.news_articles (sponsor_id);
