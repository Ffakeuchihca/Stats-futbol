-- ============================================================================
-- Club Stats App
-- Bugfix: apply_no_attendance_fines() usaba una ventana de 30 días
-- (t.date >= v_cutoff - 30), así que cada vez que el job no corría por un
-- tiempo (o en su primera ejecución tras desplegar la migración 0013)
-- terminaba multando de golpe entrenamientos de hasta un mes de antigüedad.
-- La intención original era multar solo el entrenamiento cuyo plazo para
-- registrar asistencia venció el día anterior al corte. Reducimos la
-- ventana a 3 días (suficiente margen si el cron se salta un día) y
-- limpiamos las multas viejas que ya se insertaron por el bug.
-- ============================================================================

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
    and t.date >= v_cutoff - 3
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

-- Retira multas por "no registrar asistencia" que ya se hayan colado con
-- fecha de entrenamiento muy anterior a la fecha en la que se creó la multa
-- (evidencia de que vinieron del barrido retroactivo de 30 días del bug).
delete from public.fines f
using public.fine_types ft
where f.fine_type_id = ft.id
  and ft.code = 'sin_registrar_asistencia'
  and f.date < (f.created_at::date - 3);
