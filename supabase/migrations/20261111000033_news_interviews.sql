-- =====================================================================
-- v4.2.0 · La Voz del Rayo: entrevistas que contesta el propio jugador
-- · La redacción escribe las preguntas en el borrador de una entrevista
--   y se las manda al jugador (que tiene que tener usuario en la app).
-- · El jugador las ve en su móvil, las contesta (puede guardar a medias)
--   y las entrega. Ya no puede tocarlas salvo que se le vuelvan a mandar.
-- · questions: [{"q": "pregunta", "a": "respuesta o null"}, …]
-- · El jugador nunca ve el borrador de la noticia: solo sus preguntas.
-- Requiere haber ejecutado antes la-voz-v4.0.0 (news_articles).
-- =====================================================================

create table public.news_interviews (
  id           uuid primary key default gen_random_uuid(),
  article_id   uuid not null unique references public.news_articles (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  questions    jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 12),
  status       text not null default 'pending' check (status in ('pending', 'answered')),
  sent_by      uuid references public.profiles (id) on delete set null,
  sent_at      timestamptz not null default now(),
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index news_interviews_player_idx on public.news_interviews (player_id, status);

create trigger news_interviews_touch before update on public.news_interviews
  for each row execute function public.touch_updated_at();
create trigger audit_news_interviews after insert or update or delete on public.news_interviews
  for each row execute function public.audit_trigger();

alter table public.news_interviews enable row level security;
-- La redacción ve todas; cada jugador, solo las suyas
create policy news_interviews_select on public.news_interviews for select to authenticated
  using (public.news_writer() or public.is_my_player(player_id));
-- Mandar, cambiar y quitar: solo la redacción (el jugador contesta con answer_news_interview)
create policy news_interviews_insert on public.news_interviews for insert to authenticated
  with check (public.news_writer());
create policy news_interviews_update on public.news_interviews for update to authenticated
  using (public.news_writer()) with check (public.news_writer());
create policy news_interviews_delete on public.news_interviews for delete to authenticated
  using (public.news_writer());
grant select, insert, update, delete on public.news_interviews to authenticated;

-- ---------------------------------------------------------------------
-- El jugador contesta. p_submit = true la entrega (y ya no se puede cambiar).
-- Devuelve el estado en que queda: 'pending' o 'answered'.
-- ---------------------------------------------------------------------
create or replace function public.answer_news_interview(p_id uuid, p_answers text[], p_submit boolean default false)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v public.news_interviews;
  v_out jsonb := '[]'::jsonb;
  v_n int;
  v_a text;
begin
  select * into v from public.news_interviews where id = p_id for update;
  if not found or not public.is_my_player(v.player_id) then
    raise exception 'Esta entrevista no es tuya';
  end if;
  if v.status <> 'pending' then
    raise exception 'Ya la entregaste';
  end if;
  v_n := jsonb_array_length(v.questions);
  if coalesce(array_length(p_answers, 1), 0) <> v_n then
    raise exception 'Faltan respuestas';
  end if;
  for i in 0 .. v_n - 1 loop
    v_a := nullif(btrim(p_answers[i + 1]), '');
    if v_a is not null and length(v_a) > 2000 then
      raise exception 'Una respuesta es demasiado larga';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('q', v.questions -> i ->> 'q', 'a', v_a));
  end loop;
  if p_submit and not exists (select 1 from jsonb_array_elements(v_out) e where e ->> 'a' is not null) then
    raise exception 'Contesta al menos una pregunta';
  end if;
  update public.news_interviews
     set questions = v_out,
         status = case when p_submit then 'answered' else 'pending' end,
         answered_at = case when p_submit then now() else null end
   where id = p_id;
  return case when p_submit then 'answered' else 'pending' end;
end;
$$;
revoke all on function public.answer_news_interview(uuid, text[], boolean) from public, anon;
grant execute on function public.answer_news_interview(uuid, text[], boolean) to authenticated;
