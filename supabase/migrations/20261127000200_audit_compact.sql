-- 4.32.2 · Auditoría más ligera
--
-- Hasta ahora audit_trigger() guardaba la fila ENTERA antes y después de cada cambio. Ahora:
--   1) En una modificación solo se guardan los campos que cambian (y los pocos que identifican el
--      registro: nombre, jugador, partido…, para que la lista siga diciendo «de quién» es). La columna
--      nueva `changed` dice qué campos cambiaron.
--   2) Se quita lo que no aporta: updated_at, sale_seq y, en las altas/bajas, created_at y los campos vacíos.
--   3) Los datos privados de los jugadores (player_private: teléfono, email, contacto de emergencia,
--      nacimiento, notas) no se copian: se apunta que cambiaron, sin el valor.
--   4) Los textos muy largos (cuerpo de una noticia…) se guardan recortados.
--   5) Retención: purge_audit_log() borra lo de hace más de N meses de audit_log y access_log.
--      La llama la copia automática de los lunes, después de hacer la copia (así lo que se borra
--      siempre está antes en una copia).
-- Los registros que ya había se compactan igual (mismas reglas), así que la vista «antes/ahora» no cambia.

alter table public.audit_log add column if not exists changed text[];
comment on column public.audit_log.changed is 'Campos que cambiaron en una modificación (4.32.2). NULL en registros antiguos o que no son UPDATE.';

-- Valor tal y como se guarda en la auditoría: privado oculto, texto largo recortado
create or replace function public.audit_value(p_table text, p_key text, p_val jsonb)
returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p_val is null or p_val = 'null'::jsonb then p_val
    when p_table = 'player_private' and p_key <> 'player_id' then to_jsonb('(dato privado)'::text)
    when jsonb_typeof(p_val) = 'string' and length(p_val #>> '{}') > 500
      then to_jsonb(left(p_val #>> '{}', 300) || '… (' || length(p_val #>> '{}') || ' caracteres)')
    else p_val
  end;
$$;

-- Campos que siempre se guardan en una modificación para saber de qué registro es (los que usa la vista)
create or replace function public.audit_identity_keys()
returns text[]
language sql immutable set search_path = public
as $$
  select array['reference', 'name', 'full_name', 'title', 'question', 'concept', 'first_name', 'last_name',
               'player_id', 'user_id', 'match_id', 'sponsor_id', 'campaign_id', 'item_id', 'amount_cents', 'season'];
$$;

-- Solo los campos pedidos (los que cambian + los que identifican)
create or replace function public.audit_pick(p_table text, p_data jsonb, p_keys text[])
returns jsonb
language sql immutable set search_path = public
as $$
  select coalesce(jsonb_object_agg(e.key, public.audit_value(p_table, e.key, e.value)), '{}'::jsonb)
    from jsonb_each(p_data) e
   where e.key = any(p_keys) or e.key = any(public.audit_identity_keys());
$$;

-- Foto de un alta o un borrado: sin vacíos ni campos internos
create or replace function public.audit_snapshot(p_table text, p_data jsonb)
returns jsonb
language sql immutable set search_path = public
as $$
  select coalesce(jsonb_object_agg(e.key, public.audit_value(p_table, e.key, e.value)), '{}'::jsonb)
    from jsonb_each(p_data) e
   where e.key not in ('updated_at', 'created_at', 'sale_seq')
     and e.value <> 'null'::jsonb and e.value <> '""'::jsonb and e.value <> '[]'::jsonb and e.value <> '{}'::jsonb;
$$;

-- Campos que cambian entre dos versiones (sin los contadores internos)
create or replace function public.audit_changed_keys(p_old jsonb, p_new jsonb)
returns text[]
language sql immutable set search_path = public
as $$
  select coalesce(array_agg(k order by k), '{}')
    from (select jsonb_object_keys(p_old) k union select jsonb_object_keys(p_new)) s
   where k not in ('updated_at', 'sale_seq')
     and (p_old -> k) is distinct from (p_new -> k);
$$;

revoke execute on function public.audit_value(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_identity_keys() from public, anon, authenticated;
revoke execute on function public.audit_pick(text, jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.audit_snapshot(text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_changed_keys(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    v_changed := public.audit_changed_keys(v_old, v_new);
    -- Ignora actualizaciones que solo tocan contadores internos
    if cardinality(v_changed) = 0 then
      return null;
    end if;
    insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data, changed)
    values (auth.uid(), tg_op, tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'player_id'),
            public.audit_pick(tg_table_name, v_old, v_changed),
            public.audit_pick(tg_table_name, v_new, v_changed),
            v_changed);
  else
    insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), tg_op, tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'player_id'),
            case when tg_op = 'DELETE' then public.audit_snapshot(tg_table_name, v_old) end,
            case when tg_op = 'INSERT' then public.audit_snapshot(tg_table_name, v_new) end);
  end if;
  return null;
end;
$$;
revoke execute on function public.audit_trigger() from public, anon, authenticated;

-- Compactar lo que ya hay (mismas reglas). Las acciones de negocio (anulaciones, bajas, copias…) no se tocan.
update public.audit_log a
   set changed  = d.ch,
       old_data = public.audit_pick(a.table_name, a.old_data, d.ch),
       new_data = public.audit_pick(a.table_name, a.new_data, d.ch)
  from (select id, public.audit_changed_keys(old_data, new_data) ch
          from public.audit_log
         where action = 'UPDATE' and old_data is not null and new_data is not null and changed is null) d
 where a.id = d.id;

update public.audit_log
   set old_data = case when old_data is not null then public.audit_snapshot(table_name, old_data) end,
       new_data = case when new_data is not null then public.audit_snapshot(table_name, new_data) end
 where action in ('INSERT', 'DELETE');

-- Retención: borra lo de hace más de p_months meses (mínimo 6). Solo la llama el servidor (copia de los lunes).
create or replace function public.purge_audit_log(p_months integer default 24)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_before timestamptz;
  v_audit integer;
  v_access integer;
begin
  if p_months is null or p_months < 6 then
    raise exception 'La auditoría se guarda al menos 6 meses' using errcode = '22023';
  end if;
  v_before := now() - make_interval(months => p_months);
  delete from public.audit_log where created_at < v_before;
  get diagnostics v_audit = row_count;
  delete from public.access_log where created_at < v_before;
  get diagnostics v_access = row_count;
  if v_audit + v_access > 0 then
    insert into public.audit_log (user_id, action, table_name, record_id, new_data)
    values (null, 'PURGE', 'app', null,
            jsonb_build_object('detail', format('Borrados %s cambios y %s accesos de hace más de %s meses', v_audit, v_access, p_months),
                               'before', v_before));
  end if;
  return jsonb_build_object('audit', v_audit, 'access', v_access, 'before', v_before);
end;
$$;
revoke execute on function public.purge_audit_log(integer) from public, anon, authenticated;
grant execute on function public.purge_audit_log(integer) to service_role;
