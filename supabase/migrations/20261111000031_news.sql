-- =====================================================================
-- v4.0.0 · La Voz del Rayo, el periódico del club
-- · Piezas de cuatro tipos: crónica, previa, entrevista y comunicado oficial.
-- · La crónica y la previa van atadas a un partido: la ficha técnica
--   (resultado, alineación, goles, MVP) sale del acta, no del texto.
-- · La entrevista va atada a un jugador de la plantilla.
-- · Borrador → publicada. Los borradores solo los ven quienes pueden escribir.
-- · featured: la pieza abre Inicio en modo periódico durante 3 días.
-- · Fotos: una de portada y las que se quieran dentro del texto
--   (líneas «![pie](url)»), en la carpeta pública news-photos.
-- · ai_notes: los comentarios de quien escribe para preparar el texto con
--   una IA. Nunca se enseñan en la noticia.
-- Requiere haber ejecutado antes 20261111000030_news_module.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: todos leen; los gestores escriben, publican y borran
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'news', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('player', 'news', true, false, false, false)
on conflict (role, module) do update set can_read = true;
-- Los perfiles a medida que ya existen: leer siempre; con base gestor, también escribir
insert into public.custom_role_permissions (role_id, module, can_read, can_create, can_update, can_delete)
select id, 'news', true, base = 'admin', base = 'admin', base = 'admin' from public.custom_roles
on conflict (role_id, module) do nothing;

-- ---------------------------------------------------------------------
-- Noticias
-- ---------------------------------------------------------------------
create table public.news_articles (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('cronica', 'previa', 'entrevista', 'comunicado')),
  title         text not null check (length(trim(title)) between 3 and 140),
  kicker        text check (kicker is null or length(kicker) <= 60),          -- antetítulo
  summary       text check (summary is null or length(summary) <= 500),       -- entradilla
  body          text not null default '' check (length(body) <= 30000),
  match_id      uuid references public.matches (id) on delete set null,
  player_id     uuid references public.players (id) on delete set null,       -- entrevistado
  cover_url     text check (cover_url is null or length(cover_url) <= 500),
  cover_caption text check (cover_caption is null or length(cover_caption) <= 140),
  byline        text not null default 'Redacción' check (length(trim(byline)) between 2 and 60),
  ai_notes      text check (ai_notes is null or length(ai_notes) <= 3000),
  featured      boolean not null default false,                               -- portada de Inicio (3 días)
  status        text not null default 'draft' check (status in ('draft', 'published')),
  published_at  timestamptz,
  notified_at   timestamptz,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status = 'draft' or published_at is not null)
);
create index news_articles_published_idx on public.news_articles (published_at desc) where status = 'published';
create index news_articles_match_idx on public.news_articles (match_id);

create trigger news_articles_touch before update on public.news_articles
  for each row execute function public.touch_updated_at();
create trigger audit_news_articles after insert or update or delete on public.news_articles
  for each row execute function public.audit_trigger();

-- ¿Puede escribir? (crear o editar piezas)
create or replace function public.news_writer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_perm('news', 'create') or public.has_perm('news', 'update');
$$;
revoke all on function public.news_writer() from public, anon;
grant execute on function public.news_writer() to authenticated;

alter table public.news_articles enable row level security;
-- Publicadas: quien puede leer. Borradores: quien puede escribir.
create policy news_select on public.news_articles for select to authenticated
  using (public.has_perm('news', 'read') and (status = 'published' or public.news_writer()));
create policy news_insert on public.news_articles for insert to authenticated
  with check (public.has_perm('news', 'create') and created_by = auth.uid());
-- Edita quien puede editar; quien solo puede crear, sus propias piezas
create policy news_update on public.news_articles for update to authenticated
  using (public.has_perm('news', 'update') or (created_by = auth.uid() and public.has_perm('news', 'create')))
  with check (public.has_perm('news', 'update') or (created_by = auth.uid() and public.has_perm('news', 'create')));
-- Borra quien puede borrar; quien la creó, mientras sea borrador
create policy news_delete on public.news_articles for delete to authenticated
  using (public.has_perm('news', 'delete') or (created_by = auth.uid() and status = 'draft'));
grant select, insert, update, delete on public.news_articles to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de portada (públicas: saldrán también en las noticias públicas)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-photos', 'news-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy news_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'news-photos' and public.news_writer());
create policy news_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'news-photos' and public.news_writer())
  with check (bucket_id = 'news-photos' and public.news_writer());
create policy news_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'news-photos' and public.news_writer());
create policy news_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'news-photos' and public.news_writer());
