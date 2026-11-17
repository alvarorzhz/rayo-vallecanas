-- =====================================================================
-- v4.19.0 · Registro de fallos
-- Hasta ahora, cuando a alguien le salía «Algo ha fallado» (o React tenía
-- que repintar la página al arrancar, el error 418), no quedaba apuntado en
-- ningún sitio. Ahora la app lo apunta y el superadministrador lo ve en
-- Gestión → Uso → «Fallos».
-- Una fila por persona, fallo y día (con cuántas veces pasó): no se guarda
-- nada de lo que la persona estaba escribiendo, solo la pantalla, el texto
-- del error, la versión de la app y el tipo de dispositivo. Se guarda 90 días.
-- =====================================================================

create table if not exists public.app_errors (
  day       date not null,
  user_id   uuid not null references auth.users (id) on delete cascade,
  sig       text not null,                     -- huella del fallo (tipo + pantalla + texto)
  kind      text not null check (kind in ('pantalla', 'repintado', 'js')),
  path      text not null,
  message   text not null,
  digest    text,
  version   text,
  device    text check (device is null or device in ('movil', 'tablet', 'ordenador')),
  hits      integer not null default 1 check (hits > 0),
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now(),
  primary key (day, user_id, sig)
);
create index if not exists app_errors_last_idx on public.app_errors (last_at desc);

alter table public.app_errors enable row level security;
drop policy if exists app_errors_select on public.app_errors;
create policy app_errors_select on public.app_errors for select to authenticated
  using (public.is_superadmin());
-- Solo escribe log_app_error() (security definer)
revoke insert, update, delete on public.app_errors from anon, authenticated;

-- Apunta un fallo (como mucho 30 fallos distintos por persona y día, y 200 repeticiones de cada uno)
create or replace function public.log_app_error(
  p_kind text, p_path text, p_message text, p_digest text default null, p_version text default null, p_device text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Europe/Madrid')::date;
  v_path text := left(coalesce(p_path, ''), 120);
  v_msg text := left(coalesce(p_message, ''), 400);
  v_sig text;
begin
  if v_uid is null or p_kind not in ('pantalla', 'repintado', 'js') or v_msg = '' then
    return;
  end if;
  v_sig := md5(p_kind || '|' || v_path || '|' || v_msg);
  begin
    if not exists (select 1 from public.app_errors where day = v_day and user_id = v_uid and sig = v_sig)
       and (select count(*) from public.app_errors where day = v_day and user_id = v_uid) >= 30 then
      return;
    end if;
    insert into public.app_errors as e (day, user_id, sig, kind, path, message, digest, version, device)
      values (v_day, v_uid, v_sig, p_kind, v_path, v_msg, left(p_digest, 40), left(p_version, 16),
              case when p_device in ('movil', 'tablet', 'ordenador') then p_device end)
    on conflict (day, user_id, sig) do update set hits = e.hits + 1, last_at = now(),
      version = coalesce(excluded.version, e.version)
      where e.hits < 200;

    -- Limpieza: de vez en cuando, fuera lo de hace más de 90 días
    if random() < 0.05 then
      delete from public.app_errors where day < v_day - 90;
    end if;
  exception when others then
    null;  -- apuntar un fallo nunca debe provocar otro
  end;
end;
$$;
revoke execute on function public.log_app_error(text, text, text, text, text, text) from public, anon;
grant execute on function public.log_app_error(text, text, text, text, text, text) to authenticated;
