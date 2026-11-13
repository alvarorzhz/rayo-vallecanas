-- =====================================================================
-- v4.10.0 · Reacciones en La Voz del Rayo
-- · Cada persona de la app puede reaccionar con un emoji a una noticia
--   publicada (una reacción por persona: tocar otra la cambia, tocar la
--   misma la quita). Sin comentarios.
-- · Las ve cualquiera que pueda leer La Voz. No pasan por la auditoría.
-- =====================================================================

create table public.news_reactions (
  article_id  uuid not null references public.news_articles (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (emoji in ('⚡', '🔥', '👏', '😂', '😮')),
  created_at  timestamptz not null default now(),
  primary key (article_id, user_id)
);
create index news_reactions_user_idx on public.news_reactions (user_id);

alter table public.news_reactions enable row level security;

create policy news_reactions_select on public.news_reactions for select to authenticated
  using (public.has_perm('news', 'read'));

-- Solo las mías, en noticias publicadas y con la cuenta activa
create policy news_reactions_insert on public.news_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_perm('news', 'read')
    and exists (select 1 from public.news_articles a where a.id = article_id and a.status = 'published')
  );
create policy news_reactions_update on public.news_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_perm('news', 'read'));
create policy news_reactions_delete on public.news_reactions for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.news_reactions to authenticated;
