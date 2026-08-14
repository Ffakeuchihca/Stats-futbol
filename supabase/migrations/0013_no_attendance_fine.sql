-- ============================================================================
-- Club Stats App
-- Multa automática cuando un jugador no registra su asistencia dentro del
-- plazo que tiene para hacerlo (el mismo día del entrenamiento, hora Costa
-- Rica: la asistencia se puede marcar hasta el corte de mediodía que ya usa
-- el resto de la app). Un job programado (pg_cron) revisa diariamente, poco
-- después de ese corte, los entrenamientos que ya vencieron y multa a los
-- jugadores de la categoría correspondiente que no dejaron ningún registro
-- de asistencia. Si el cuerpo técnico carga la asistencia después (aunque
-- sea tarde), la multa por "no registrar" se retira automáticamente.
-- ============================================================================

insert into public.fine_types (code, name, amount) values
  ('sin_registrar_asistencia', 'No registró asistencia', 1000)
on conflict (code) do nothing;

create or replace function public.apply_no_attendance_fines()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type_id uuid;
  v_cutoff date := public.costa_rica_training_date();
begin
  select id into v_type_id from public.fine_types where code = 'sin_registrar_asistencia';
  if v_type_id is null then
    return;
  end if;

  insert into public.fines (player_id, fine_type_id, date, training_id)
  select p.id, v_type_id, t.date, t.id
  from public.trainings t
  join public.profiles p on p.role = 'player' and p.active
  where t.date < v_cutoff
    and t.date >= v_cutoff - 30
    and (
      not exists (select 1 from public.training_categories tc where tc.training_id = t.id)
      or exists (
        select 1 from public.training_categories tc
        join public.player_categories pc on pc.category_id = tc.category_id
        where tc.training_id = t.id and pc.player_id = p.id
      )
    )
    and not exists (
      select 1 from public.attendance a where a.training_id = t.id and a.player_id = p.id
    )
    and not exists (
      select 1 from public.fines f
      where f.training_id = t.id and f.player_id = p.id and f.fine_type_id = v_type_id
    );
end;
$$;

-- Si finalmente se carga la asistencia (por tarde que sea), se retira la
-- multa por no haberla registrado.
create or replace function public.sync_attendance_fines()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_training_date date;
  v_late_type uuid;
  v_absence_type uuid;
  v_missing_type uuid;
begin
  select date into v_training_date from public.trainings where id = new.training_id;
  select id into v_late_type from public.fine_types where code = 'llegada_tardia';
  select id into v_absence_type from public.fine_types where code = 'ausencia_injustificada';
  select id into v_missing_type from public.fine_types where code = 'sin_registrar_asistencia';

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

  if v_missing_type is not null then
    delete from public.fines
      where player_id = new.player_id and training_id = new.training_id and fine_type_id = v_missing_type;
  end if;

  return new;
end;
$$;

-- Solo debe ejecutarlo el job programado (que corre como dueño de la base),
-- no clientes autenticados ni anónimos vía la API REST.
revoke execute on function public.apply_no_attendance_fines() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'apply-no-attendance-fines',
  '5 18 * * *',
  $$select public.apply_no_attendance_fines();$$
);
