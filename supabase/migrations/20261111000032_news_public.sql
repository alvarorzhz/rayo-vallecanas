-- =====================================================================
-- v4.1.0 · La Voz del Rayo: noticias públicas
-- · Solo un superadministrador puede hacer pública una pieza publicada.
--   Entonces tiene un enlace (/noticias/<enlace>) que se lee sin registrarse.
-- · El enlace no cambia aunque se deje de compartir y se vuelva a compartir.
-- · Lo público nunca lleva nombres completos: los jugadores salen por su apodo
--   (o, si no tienen, por su primer apellido, como en la camiseta). Tampoco
--   salen las notas para la IA ni quién escribió la pieza en la app.
-- =====================================================================

alter table public.news_articles
  add column is_public   boolean not null default false,
  add column public_slug text unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(public_slug) between 4 and 80),
  add column public_at   timestamptz;
create index news_articles_public_idx on public.news_articles (published_at desc) where is_public and status = 'published';

-- Nadie más que un superadministrador puede tocar lo público (la clave de servicio, sí)
create or replace function public.news_guard_public()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_superadmin() then
    if new.is_public and new.public_slug is null then
      raise exception 'Falta el enlace público' using errcode = '23514';
    end if;
    if new.is_public and (tg_op = 'INSERT' or not old.is_public) then
      new.public_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.is_public or new.public_slug is not null then
      raise exception 'Solo un superadministrador puede hacer pública una noticia' using errcode = '42501';
    end if;
  elsif new.is_public is distinct from old.is_public or new.public_slug is distinct from old.public_slug or new.public_at is distinct from old.public_at then
    raise exception 'Solo un superadministrador puede hacer pública una noticia' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.news_guard_public() from public, anon, authenticated;
create trigger news_articles_guard_public before insert or update on public.news_articles
  for each row execute function public.news_guard_public();

-- Nombre público de un jugador: el apodo o, si no tiene, el primer apellido
create or replace function public.player_public_name(p public.players)
returns text
language sql immutable
as $$
  select coalesce(nullif(trim(p.nickname), ''), nullif(split_part(trim(p.last_name), ' ', 1), ''), p.first_name);
$$;

-- Tarjeta de una pieza pública (para la hemeroteca y la propia noticia)
create or replace function public.news_public_card(a public.news_articles)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', a.public_slug, 'slug', a.public_slug, 'kind', a.kind, 'title', a.title, 'kicker', a.kicker, 'summary', a.summary,
    'body', a.body, 'cover_url', a.cover_url, 'cover_caption', a.cover_caption, 'byline', a.byline,
    'published_at', a.published_at, 'updated_at', a.updated_at,
    'match', (select jsonb_build_object(
                'id', m.id, 'match_date', m.match_date, 'kickoff', m.kickoff, 'is_home', m.is_home, 'goals_for', m.goals_for,
                'goals_against', m.goals_against, 'status', m.status, 'round', m.round, 'competition', m.competition, 'venue', m.venue,
                'report', m.report_saved_at is not null,
                'mvp', (select public.player_public_name(p) from public.players p where p.id = m.mvp_player_id),
                'rival', jsonb_build_object('name', r.name, 'short_name', r.short_name, 'crest_url', r.crest_url, 'color', r.color))
              from public.matches m join public.rivals r on r.id = m.rival_id where m.id = a.match_id),
    'player', (select jsonb_build_object('id', p.id, 'name', public.player_public_name(p), 'photo_url', p.photo_url)
               from public.players p where p.id = a.player_id)
  );
$$;
revoke execute on function public.news_public_card(public.news_articles) from public, anon, authenticated;

-- Hemeroteca pública: las piezas públicas, de la más reciente a la más antigua (sin el texto)
create or replace function public.news_public_list(p_limit int default 30)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(c - 'body' order by (c->>'published_at') desc), '[]')
    from (select public.news_public_card(a) c from public.news_articles a
           where a.is_public and a.status = 'published'
           order by a.published_at desc limit least(greatest(p_limit, 1), 60)) x;
$$;
revoke execute on function public.news_public_list(int) from public;
grant execute on function public.news_public_list(int) to anon, authenticated;

-- Una pieza pública con su ficha técnica (alineación, goles, asistencias y tarjetas, por apodo)
create or replace function public.news_public(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  a public.news_articles;
  v_card jsonb;
begin
  select * into a from public.news_articles
   where public_slug = lower(trim(p_slug)) and is_public and status = 'published';
  if not found then return null; end if;
  v_card := public.news_public_card(a);
  if a.match_id is not null and a.kind in ('cronica', 'previa') then
    v_card := v_card || jsonb_build_object('sheet', jsonb_build_object(
      'starters', (select coalesce(jsonb_agg(public.player_public_name(p) order by p.last_name), '[]')
                     from public.match_appearances ap join public.players p on p.id = ap.player_id where ap.match_id = a.match_id and ap.started),
      'subs', (select coalesce(jsonb_agg(public.player_public_name(p) order by p.last_name), '[]')
                 from public.match_appearances ap join public.players p on p.id = ap.player_id where ap.match_id = a.match_id and not ap.started),
      'goals', (select coalesce(jsonb_agg(jsonb_build_object('scorer', (select public.player_public_name(p) from public.players p where p.id = g.scorer_id),
                                                             'assist', (select public.player_public_name(p) from public.players p where p.id = g.assist_id),
                                                             'own_goal', g.own_goal) order by g.sort), '[]')
                  from public.match_goals g where g.match_id = a.match_id),
      'cards', (select coalesce(jsonb_agg(jsonb_build_object('name', public.player_public_name(p), 'yellows', ap.yellows, 'red', ap.red)), '[]')
                  from public.match_appearances ap join public.players p on p.id = ap.player_id
                 where ap.match_id = a.match_id and (ap.yellows > 0 or ap.red))
    ));
  end if;
  if a.kind = 'entrevista' and a.player_id is not null then
    v_card := v_card || jsonb_build_object('player_info', (
      select jsonb_build_object('number', sm.number, 'position', sm.position, 'apps', sm.apps, 'goals', sm.goals)
        from public.squad_members_full sm
       where sm.player_id = a.player_id order by sm.season desc limit 1));
  end if;
  return v_card;
end;
$$;
revoke execute on function public.news_public(text) from public;
grant execute on function public.news_public(text) to anon, authenticated;
