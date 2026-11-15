-- =====================================================================
-- v4.16.0 · Uso de la app
-- Para saber qué pantallas usa de verdad el equipo (y qué se puede quitar),
-- la app suma 1 a un contador por persona, pantalla y día cada vez que se
-- abre una pantalla. No se guarda cada clic ni la hora exacta: una fila por
-- persona, pantalla y día. Se guarda un año; lo más antiguo se borra solo.
-- De paso, en user_activity se apunta el último tipo de dispositivo y si
-- usa la app instalada (pantalla de inicio) o desde el navegador.
-- Solo lo ve el superadministrador (Gestión → Uso).
-- Las acciones (votar MVP, porra, convocatorias, notas…) no se registran
-- aparte: ya están en sus tablas y la pestaña Uso las cuenta.
-- =====================================================================

create table if not exists public.usage_daily (
  day      date not null,
  user_id  uuid not null references auth.users (id) on delete cascade,
  area     text not null check (area ~ '^[a-z_]{1,32}$'),
  hits     integer not null default 1 check (hits > 0),
  primary key (day, user_id, area)
);
create index if not exists usage_daily_user_idx on public.usage_daily (user_id, day);

alter table public.usage_daily enable row level security;
drop policy if exists usage_daily_select on public.usage_daily;
create policy usage_daily_select on public.usage_daily for select to authenticated
  using (public.is_superadmin());
-- Solo escribe track_usage() (security definer)
revoke insert, update, delete on public.usage_daily from anon, authenticated;

alter table public.user_activity add column if not exists device text
  check (device is null or device in ('movil', 'tablet', 'ordenador'));
alter table public.user_activity add column if not exists installed boolean;

-- Suma una visita a una pantalla (como mucho 500 por persona, pantalla y día)
create or replace function public.track_usage(p_area text, p_device text default null, p_installed boolean default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Europe/Madrid')::date;
begin
  if v_uid is null or p_area is null or p_area !~ '^[a-z_]{1,32}$' then
    return;
  end if;
  begin
    insert into public.usage_daily as u (day, user_id, area, hits) values (v_day, v_uid, p_area, 1)
    on conflict (day, user_id, area) do update set hits = u.hits + 1 where u.hits < 500;

    if p_device in ('movil', 'tablet', 'ordenador') or p_installed is not null then
      insert into public.user_activity as a (user_id, last_seen_at, device, installed)
        values (v_uid, now(), case when p_device in ('movil', 'tablet', 'ordenador') then p_device end, p_installed)
      on conflict (user_id) do update set
        device = coalesce(excluded.device, a.device),
        installed = coalesce(excluded.installed, a.installed)
        where a.device is distinct from coalesce(excluded.device, a.device)
           or a.installed is distinct from coalesce(excluded.installed, a.installed);
    end if;

    -- Limpieza: de vez en cuando, fuera lo de hace más de un año
    if random() < 0.01 then
      delete from public.usage_daily where day < v_day - 366;
    end if;
  exception when others then
    null;  -- apuntar el uso nunca debe impedir usar la app
  end;
end;
$$;
revoke execute on function public.track_usage(text, text, boolean) from public, anon;
grant execute on function public.track_usage(text, text, boolean) to authenticated;
