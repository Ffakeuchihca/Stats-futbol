-- ============================================================================
-- Club Stats App
-- Los jugadores ahora pueden cargar/editar sus propias estadísticas de
-- partido en cualquier momento, no solo el día del partido. Se quita la
-- restricción de "mismo día" (agregada en 0009_same_day_restrictions) para
-- match_stats; la de asistencia (attendance) se deja igual.
-- ============================================================================

drop policy "match_stats_insert_self" on public.match_stats;
create policy "match_stats_insert_self" on public.match_stats for insert to authenticated
  with check (player_id = auth.uid());

drop policy "match_stats_update_self" on public.match_stats;
create policy "match_stats_update_self" on public.match_stats for update to authenticated
  using (player_id = auth.uid());
