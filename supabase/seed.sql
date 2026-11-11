-- Datos de ejemplo para trabajar en local y para la prueba de humo (npm run test:e2e).
-- Solo se cargan con `supabase start` / `supabase db reset`: NUNCA llegan a producción,
-- que se actualiza con las migraciones. Todos los nombres y correos son inventados.
--
-- Usuarios (contraseña de todos: Rayo1234!)
--   alvaro@rayo.test  superadministrador
--   ruben@rayo.test   gestor
--   dani@rayo.test    jugador (ficha «Dani», dorsal 10)
--   javi@rayo.test    jugador (ficha «Javi», dorsal 7)

-- Sin disparadores: los datos entran tal cual, sin auditoría ni comprobaciones de permisos.
set session_replication_role = replica;

-- ------------------------------------------------------------------ Usuarios
with u(id, email, full_name, role) as (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'alvaro@rayo.test', 'Álvaro Rodríguez', 'superadmin'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'ruben@rayo.test', 'Rubén López', 'admin'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'dani@rayo.test', 'Dani García', 'player'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'javi@rayo.test', 'Javi Martín', 'player')
), a as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, extensions.crypt('Rayo1234!', extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', full_name), now(), now(), '', '', '', ''
  from u returning id
), i as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now() from u returning id
)
insert into public.profiles (id, full_name, email, role, active, must_change_password)
select id, full_name, email, role::app_role, true, false from u;

-- ------------------------------------------------------------------ Plantilla (temporada en curso)
create temp table _s as select
  (case when extract(month from current_date) >= 9 then extract(year from current_date)::int else extract(year from current_date)::int - 1 end) as y;
create temp table _season as select y, y::text || '/' || lpad(((y + 1) % 100)::text, 2, '0') as season from _s;

with p(n, fn, ln, nick, pos, st, arm, apps, starts, goals, assists, y, mv, email) as (values
  (1, 'Martín', 'Sanz', 'Martín', 'POR', 'active', null, 5, 5, 0, 0, 0, 1, null),
  (2, 'Sergio', 'Pérez', 'Pérez', 'LD', 'active', null, 5, 4, 0, 1, 1, 0, null),
  (4, 'Carlos', 'Castro', 'Castro', 'DFC', 'active', 'captain', 5, 5, 1, 0, 2, 0, null),
  (5, 'Iván', 'Navarro', 'Navarro', 'DFC', 'injured', null, 2, 2, 0, 0, 0, 0, null),
  (6, 'Hugo', 'Herrero', 'Herrero', 'MCD', 'active', null, 5, 4, 1, 2, 1, 0, null),
  (8, 'Pablo', 'Ramos', 'Ramos', 'MCD', 'active', 'vice', 4, 3, 2, 1, 0, 0, null),
  (10, 'Dani', 'García', 'Dani', 'MCO', 'active', null, 5, 5, 5, 5, 0, 3, 'dani@rayo.test'),
  (7, 'Javi', 'Martín', 'Javi', 'MD', 'active', null, 5, 3, 3, 2, 1, 0, 'javi@rayo.test'),
  (11, 'Óscar', 'Cabrera', 'Cabrera', 'MI', 'active', null, 4, 1, 1, 1, 0, 0, null),
  (9, 'Raúl', 'Fuentes', 'Fuentes', 'DC', 'active', null, 5, 5, 5, 1, 1, 1, null),
  (19, 'Mario', 'Romero', 'Romero', 'DC', 'away', null, 1, 0, 0, 0, 0, 0, null)
), ins as (
  insert into public.players (first_name, last_name, nickname, foot, height_cm, joined_club_on, user_id)
  select fn, ln, nick, 'right', 170 + n, make_date((select y from _season) - 2, 9, 1), (select id from public.profiles where profiles.email = p.email)
  from p returning id, nickname
)
insert into public.squad_members (player_id, season, number, position, status, armband, apps, starts, goals, assists, yellows, mvps)
select ins.id, (select season from _season), p.n, p.pos, p.st::squad_status, p.arm, p.apps, p.starts, p.goals, p.assists, p.y, p.mv
from p join ins on ins.nickname = p.nick;

insert into public.player_private (player_id) select id from public.players on conflict do nothing;
insert into public.squad_fee_plans (season, amount_cents, due_on) select season, 12000, current_date + 35 from _season on conflict do nothing;

-- ------------------------------------------------------------------ Rivales y partidos (5 jugados, 4 por jugar)
insert into public.rivals (name, short_name, color) values
  ('Helmántica CF', 'HEL', '#1d4ed8'), ('Celta de Vino', 'CEL', '#7c3aed'), ('Alfaro CF', 'ALF', '#059669'),
  ('Racing Puente', 'RPU', '#ea580c'), ('Deportivo Tormes', 'TOR', '#0891b2'), ('Atlético Garrido', 'GAR', '#be123c');

insert into public.matches (match_date, kickoff, competition, round, rival_id, is_home, venue, status, goals_for, goals_against)
select current_date + d, '18:30', 'league', 'Jornada ' || j, (select id from public.rivals where short_name = r), h, 'La Aldehuela C1', s::match_status, gf, ga
from (values
  (-31, 3, 'RPU', true, 'played', 3, 1), (-24, 4, 'TOR', false, 'played', 2, 2), (-17, 5, 'GAR', true, 'played', 4, 0),
  (-10, 6, 'CEL', false, 'played', 1, 2), (-3, 7, 'ALF', true, 'played', 2, 1),
  (4, 8, 'HEL', true, 'scheduled', null, null), (11, 9, 'CEL', false, 'scheduled', null, null),
  (18, 10, 'ALF', true, 'scheduled', null, null), (25, 11, 'TOR', false, 'scheduled', null, null)) v(d, j, r, h, s, gf, ga);

insert into public.match_appearances (match_id, player_id, started)
select m.id, p.id, p.nickname not in ('Cabrera', 'Javi') from public.matches m cross join public.players p
where m.status = 'played' and p.nickname not in ('Romero', 'Navarro');
insert into public.match_goals (match_id, scorer_id, assist_id, sort)
select m.id, (select id from public.players where nickname = 'Fuentes'), (select id from public.players where nickname = 'Dani'), 1 from public.matches m where m.status = 'played';
insert into public.match_goals (match_id, scorer_id, assist_id, sort)
select m.id, (select id from public.players where nickname = 'Dani'), (select id from public.players where nickname = 'Javi'), 2 from public.matches m where m.status = 'played' and goals_for >= 2;
update public.matches set mvp_player_id = (select id from public.players where nickname = 'Dani'), report_saved_at = now() where status = 'played';

-- Convocatoria publicada del próximo partido: Dani aún no ha contestado
update public.matches set meet_time = '17:45', meet_place = 'Puerta principal', callup_published_at = now(), formation = '2-3-1' where match_date = current_date + 4;
insert into public.match_callups (match_id, player_id, reply)
select m.id, p.id, (case p.nickname when 'Dani' then 'pending' when 'Cabrera' then 'maybe' else 'yes' end)::callup_reply
from public.matches m, public.players p where m.match_date = current_date + 4 and p.nickname not in ('Romero', 'Navarro');

-- ------------------------------------------------------------------ Finanzas
update public.finance_settings set opening_balance_cents = 45000, opening_date = make_date((select y from _season), 9, 1);
insert into public.finance_movements (kind, op_date, concept, category_id, amount_cents, method, counterparty, created_by)
select k::finance_kind, current_date - d, c, (select id from public.finance_categories where name = cat), a, m::payment_method, cp, '00000000-0000-4000-8000-000000000001'
from (values
  ('income', 40, 'Cuota de Dani García', 'Cuotas de jugadores', 12000, 'bizum', 'Dani García'),
  ('income', 39, 'Cuota de Javi Martín', 'Cuotas de jugadores', 12000, 'cash', 'Javi Martín'),
  ('expense', 38, 'Inscripción liga F7 Apertura', 'Inscripciones', 38000, 'transfer', 'Liga local'),
  ('income', 35, 'Patrocinio Bar El Barrio', 'Patrocinios', 30000, 'transfer', 'Bar El Barrio'),
  ('expense', 33, 'Balones y petos', 'Material deportivo', 8650, 'card', 'Tienda de deportes'),
  ('expense', 31, 'Arbitraje jornada 3', 'Arbitrajes', 2500, 'cash', null),
  ('income', 20, 'Cuota de Raúl Fuentes', 'Cuotas de jugadores', 6000, 'bizum', 'Raúl Fuentes'),
  ('expense', 17, 'Arbitraje jornada 5', 'Arbitrajes', 2500, 'cash', null),
  ('income', 8, 'Rifa del jamón', 'Lotería y rifas', 18400, 'cash', null),
  ('expense', 3, 'Arbitraje jornada 7', 'Arbitrajes', 2500, 'cash', null)) v(k, d, c, cat, a, m, cp)
-- Solo dentro de la temporada en curso (a principios de septiembre aún no habría movimientos)
where current_date - d >= make_date((select y from _season), 9, 1);

-- ------------------------------------------------------------------ Sorteos
insert into public.lottery_campaigns (name, year, lottery_number, draw_type, draw_date, price_cents, played_cents, donation_cents, total_shares, numbering_mode, ref_prefix, status, kind, created_by)
values
  ('Lotería de Navidad', extract(year from current_date)::int, '45817', 'Sorteo de Navidad', current_date + 40, 500, 400, 100, 200, 'auto', 'NAV', 'active', 'lottery', '00000000-0000-4000-8000-000000000001'),
  ('Rifa del jamón', extract(year from current_date)::int, null, 'Sorteo propio', current_date + 20, 200, 0, 200, 100, 'manual', 'JAM', 'draft', 'raffle', '00000000-0000-4000-8000-000000000001');
insert into public.lottery_shares (campaign_id, share_number, status)
select c.id, g, 'available' from public.lottery_campaigns c, generate_series(1, 200) g where g <= c.total_shares;
insert into public.lottery_campaign_sellers (campaign_id, user_id, assigned_by)
select c.id, u.id, '00000000-0000-4000-8000-000000000001' from public.lottery_campaigns c, public.profiles u where c.status = 'active';

-- ------------------------------------------------------------------ Votaciones (una abierta y una cerrada)
insert into public.polls (question, details, audience, anonymous, closes_at, created_by) values
  ('¿Hacemos cena de Navidad?', 'En el Bar El Barrio a las 21:30, unos 20 € por cabeza.', 'all', false, now() + interval '2 days', '00000000-0000-4000-8000-000000000001'),
  ('¿Pedimos la segunda equipación en dorado?', null, 'all', false, now() - interval '2 days', '00000000-0000-4000-8000-000000000001');
insert into public.poll_votes (poll_id, user_id, vote)
select p.id, u.id, u.email <> 'javi@rayo.test' from public.polls p, public.profiles u where u.email <> 'dani@rayo.test';

drop table _season; drop table _s;
set session_replication_role = origin;
