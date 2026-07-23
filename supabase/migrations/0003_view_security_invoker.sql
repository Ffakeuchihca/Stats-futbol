-- ============================================================================
-- Club Stats App - Las vistas deben respetar el RLS de quien consulta
-- Sin esto, cualquier jugador autenticado podía leer las multas y estadísticas
-- de TODOS los demás jugadores directamente por la API (bypaseando RLS),
-- detectado por el linter de seguridad de Supabase.
-- ============================================================================

alter view public.player_season_stats set (security_invoker = on);
alter view public.player_fines_summary set (security_invoker = on);
