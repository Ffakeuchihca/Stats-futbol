-- ============================================================================
-- Club Stats App - Los jugadores registran sus propias estadísticas de partido
-- ============================================================================

-- Cada jugador puede cargar/editar sus propias estadísticas de partido
-- (minutos, goles, asistencias, tarjetas, convocado/titular/suplente).
-- El cuerpo técnico sigue pudiendo cargar/editar/borrar las de cualquiera
-- (la policy match_stats_write_coach ya existente se mantiene).
create policy "match_stats_insert_self" on public.match_stats for insert to authenticated
  with check (player_id = auth.uid());
create policy "match_stats_update_self" on public.match_stats for update to authenticated
  using (player_id = auth.uid());
