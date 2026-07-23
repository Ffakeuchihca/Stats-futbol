-- ============================================================================
-- Los jugadores solo pueden marcar su propia asistencia y cargar sus propias
-- estadísticas de partido el mismo día del entrenamiento/partido (usando el
-- mismo corte al mediodía hora de Costa Rica que ya usa la app). El cuerpo
-- técnico sigue pudiendo editar cualquier día (política *_write_coach /
-- is_coach(), que no se toca).
-- ============================================================================

create or replace function public.costa_rica_training_date()
returns date
language sql
stable
as $$
  select (now() - interval '18 hours')::date;
$$;

-- Asistencia: el jugador solo carga/edita la suya del día de hoy
drop policy "attendance_insert_own_or_coach" on public.attendance;
create policy "attendance_insert_own_or_coach" on public.attendance for insert to authenticated
  with check (
    public.is_coach()
    or (
      player_id = auth.uid()
      and exists (
        select 1 from public.trainings t
        where t.id = attendance.training_id
        and t.date = public.costa_rica_training_date()
      )
    )
  );

drop policy "attendance_update_own_or_coach" on public.attendance;
create policy "attendance_update_own_or_coach" on public.attendance for update to authenticated
  using (
    public.is_coach()
    or (
      player_id = auth.uid()
      and exists (
        select 1 from public.trainings t
        where t.id = attendance.training_id
        and t.date = public.costa_rica_training_date()
      )
    )
  );

-- Estadísticas de partido: el jugador solo carga/edita las suyas el día del partido
drop policy "match_stats_insert_self" on public.match_stats;
create policy "match_stats_insert_self" on public.match_stats for insert to authenticated
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_stats.match_id
      and m.date = public.costa_rica_training_date()
    )
  );

drop policy "match_stats_update_self" on public.match_stats;
create policy "match_stats_update_self" on public.match_stats for update to authenticated
  using (
    player_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_stats.match_id
      and m.date = public.costa_rica_training_date()
    )
  );
