-- =====================================================================
-- v2.2.1 · Revisión de seguridad antes de la fase 4
-- =====================================================================

-- 1. Sin sesión no se puede ejecutar ninguna función de la base de datos.
--    (Las de Finanzas se habían quedado abiertas al rol anónimo; ya comprobaban
--    el permiso por dentro, pero mejor cerrarlas del todo.)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('revoke execute on function %s from public, anon', r.f);
  end loop;
  -- Las funciones de disparadores no se llaman desde la app: nadie necesita ejecutarlas
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from authenticated', r.f);
  end loop;
end;
$$;
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. El rol anónimo no tiene nada que hacer con las tablas (todas las políticas son para usuarios con sesión)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 3. Ruta de búsqueda fija también en la función de la temporada
alter function public.finance_season(date) set search_path = '';

-- 4. La auditoría no se puede falsear desde fuera: log_action queda solo para las funciones
--    de la base de datos, y la app apunta sus exportaciones con log_export (solo «EXPORT»).
create or replace function public.log_export(p_table text, p_record text, p_data jsonb default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión' using errcode = '42501';
  end if;
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'EXPORT', left(p_table, 60), left(p_record, 120), p_data);
end;
$$;
revoke execute on function public.log_export(text, text, jsonb) from public, anon;
grant execute on function public.log_export(text, text, jsonb) to authenticated;
revoke execute on function public.log_action(text, text, text, jsonb) from authenticated;

-- 5. Documentos: el jugador solo puede borrar los archivos que subió él (no los que subió un gestor)
drop policy if exists player_docs_delete on storage.objects;
create policy player_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'player-docs' and (public.has_perm('squad_private', 'delete')
         or (public.is_my_player(((storage.foldername(name))[1])::uuid) and owner_id = auth.uid()::text)));
