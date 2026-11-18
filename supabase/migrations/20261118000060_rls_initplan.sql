-- 4.21.1 · Velocidad: los permisos se comprueban una vez por consulta, no una vez por fila.
--
-- Las políticas llamaban a has_perm(...), is_superadmin(), news_writer() y can_send_notices()
-- tal cual. Postgres las evaluaba en cada fila leída (y cada llamada vuelve a leer el perfil del
-- usuario), así que la plantilla de la temporada tardaba 34 ms con permisos frente a 2 ms sin ellos.
-- Envueltas en (select ...), Postgres las calcula una sola vez por consulta (lo que Supabase llama
-- «initPlan») y reutiliza el resultado. El resultado es exactamente el mismo: esas funciones solo
-- dependen del usuario conectado, nunca de la fila.
--
-- Las funciones que reciben datos de la fila (is_my_player(player_id), poll_for_me(...),
-- porra_open(...)) no se tocan: esas sí tienen que mirarse fila a fila.
--
-- Se reescriben todas las políticas de public y storage que usan esas funciones, sin cambiar su
-- nombre, su orden ni nada más de la condición. Se puede ejecutar dos veces sin problema.

do $$
declare
  pol record;
  -- Llamadas que solo dependen del usuario conectado (sin datos de la fila)
  pat constant text := '(has_perm\(''[a-z_]+''::(?:public\.)?app_module, ''[a-z]+''::(?:public\.)?app_action\)|is_superadmin\(\)|news_writer\(\)|can_send_notices\(\))';
  -- Ya envueltas por esta migración (o a mano): no se vuelven a envolver
  done constant text := '\(\s*SELECT\s+(?:public\.)?(has_perm|is_superadmin|news_writer|can_send_notices)\(';
  new_qual text;
  new_check text;
  stmt text;
  n int := 0;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname in ('public', 'storage')
       -- solo las que aún tienen alguna llamada sin envolver
       and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ ('(?<!SELECT )' || pat)
  loop
    -- Se marca lo ya envuelto, se envuelve el resto y se quita la marca
    new_qual  := regexp_replace(regexp_replace(regexp_replace(pol.qual,       done, '(SELECT §\1(', 'gi'), '(?<!§)' || pat, '(select \1)', 'g'), '§', '', 'g');
    new_check := regexp_replace(regexp_replace(regexp_replace(pol.with_check, done, '(SELECT §\1(', 'gi'), '(?<!§)' || pat, '(select \1)', 'g'), '§', '', 'g');
    stmt := format('alter policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    if new_qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if new_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'Políticas reescritas: %', n;
end $$;
