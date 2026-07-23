-- ============================================================================
-- Los entrenamientos automáticos de lunes a viernes deben poder generarse
-- para todo el rango que se muestra en el calendario (no solo el día de
-- hoy), y deben poder crearse tanto desde vistas de entrenador como de
-- jugador. Se pasa a security definer porque el paso que etiqueta la
-- categoría (training_categories) requiere permisos de cuerpo técnico por
-- RLS, y un jugador visitando su calendario también debe poder disparar la
-- generación automática de su propia categoría.
-- ============================================================================

create or replace function public.ensure_weekday_training(p_date date, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_training_id uuid;
  v_dow int;
begin
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

create or replace function public.ensure_weekday_trainings_range(p_start date, p_end date, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
begin
  d := p_start;
  while d <= p_end loop
    perform public.ensure_weekday_training(d, p_category_id);
    d := d + 1;
  end loop;
end;
$$;

grant execute on function public.ensure_weekday_trainings_range(date, date, uuid) to authenticated;
