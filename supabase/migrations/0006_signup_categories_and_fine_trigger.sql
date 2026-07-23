-- ============================================================================
-- Club Stats App
-- 1. Permitir leer categorías sin estar logueado (para el formulario de registro)
-- 2. Guardar las categorías elegidas al registrarse
-- 3. Mover el alta/baja automática de multas por tardanza/ausencia a un
--    trigger de base de datos, para que funcione sin importar quién marque
--    la asistencia (jugador o cuerpo técnico), evitando además choques
--    cuando dos categorías entrenan el mismo día.
-- ============================================================================

-- 1. Lectura pública de categorías (solo nombres, no es información sensible)
create policy "categories_select_anon" on public.categories
  for select to anon using (true);

-- 2. Al registrarse, además del perfil, guardar las categorías elegidas
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'player'
  );

  insert into public.player_categories (player_id, category_id)
  select new.id, (value)::uuid
  from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'category_ids', '[]'::jsonb)) as value
  on conflict do nothing;

  return new;
end;
$$;

-- 3. Trigger: sincroniza las multas de llegada tardía / ausencia injustificada
--    según el estado de asistencia, por sesión de entrenamiento (training_id)
create function public.sync_attendance_fines()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_training_date date;
  v_late_type uuid;
  v_absence_type uuid;
begin
  select date into v_training_date from public.trainings where id = new.training_id;
  select id into v_late_type from public.fine_types where code = 'llegada_tardia';
  select id into v_absence_type from public.fine_types where code = 'ausencia_injustificada';

  if new.status = 'tarde' then
    if v_late_type is not null then
      update public.fines set date = v_training_date
        where player_id = new.player_id and training_id = new.training_id and fine_type_id = v_late_type;
      if not found then
        insert into public.fines (player_id, fine_type_id, date, training_id)
        values (new.player_id, v_late_type, v_training_date, new.training_id);
      end if;
    end if;
  else
    delete from public.fines
      where player_id = new.player_id and training_id = new.training_id and fine_type_id = v_late_type;
  end if;

  if new.status = 'ausente' then
    if v_absence_type is not null then
      update public.fines set date = v_training_date, notes = new.notes
        where player_id = new.player_id and training_id = new.training_id and fine_type_id = v_absence_type;
      if not found then
        insert into public.fines (player_id, fine_type_id, date, training_id, notes)
        values (new.player_id, v_absence_type, v_training_date, new.training_id, new.notes);
      end if;
    end if;
  else
    delete from public.fines
      where player_id = new.player_id and training_id = new.training_id and fine_type_id = v_absence_type;
  end if;

  return new;
end;
$$;

create trigger attendance_sync_fines
  after insert or update on public.attendance
  for each row execute procedure public.sync_attendance_fines();
