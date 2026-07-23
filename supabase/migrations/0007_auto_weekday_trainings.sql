-- ============================================================================
-- Entrenamientos automáticos de lunes a viernes por categoría.
-- Se invoca de forma perezosa (RPC) desde las páginas de asistencia y
-- calendario: si el día es hábil (lun-vie) y la categoría todavía no tiene
-- un entrenamiento para esa fecha, se crea uno automáticamente.
-- ============================================================================

create or replace function public.ensure_weekday_training(p_date date, p_category_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_training_id uuid;
  v_dow int;
begin
  if not public.is_coach() then
    return;
  end if;

  v_dow := extract(dow from p_date);
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  select tc.training_id into v_training_id
  from public.training_categories tc
  join public.trainings t on t.id = tc.training_id
  where tc.category_id = p_category_id and t.date = p_date
  limit 1;

  if v_training_id is null then
    insert into public.trainings (date, notes)
    values (p_date, 'Entrenamiento automático')
    returning id into v_training_id;

    insert into public.training_categories (training_id, category_id)
    values (v_training_id, p_category_id);
  end if;
end;
$$;

grant execute on function public.ensure_weekday_training(date, uuid) to authenticated;
