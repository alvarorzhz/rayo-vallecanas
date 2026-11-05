-- =====================================================================
-- Perfiles: se elimina «Responsable deportivo» (coach) y fotos de perfil
-- =====================================================================

-- El valor 'coach' sigue existiendo en el tipo (Postgres no permite quitar
-- valores de un enum sin rehacerlo), pero ya no se puede usar.
update public.profiles set role = 'player' where role = 'coach';
delete from public.role_permissions where role = 'coach';
alter table public.profiles add constraint profiles_role_not_coach check (role <> 'coach');

-- ---------------------------------------------------------------------
-- Foto de perfil
-- ---------------------------------------------------------------------
alter table public.profiles add column avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Cada usuario solo puede subir, cambiar o borrar ficheros en su carpeta (avatars/<su id>/...)
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Auditoría: solo superadministradores
-- ---------------------------------------------------------------------
update public.role_permissions set can_read = false, can_create = false, can_update = false, can_delete = false
 where module = 'audit' and role <> 'superadmin';
delete from public.user_permissions where module = 'audit';
drop policy audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_superadmin());
