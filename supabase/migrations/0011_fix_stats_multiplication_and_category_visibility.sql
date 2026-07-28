-- ============================================================================
-- Club Stats App
-- 1. player_season_stats multiplicaba minutos/goles/asistencias/tarjetas:
--    la vista hacía LEFT JOIN de match_stats y self_evaluations directamente
--    sobre profiles, ambos unidos solo por player_id (no por match_id), asi
--    que por cada fila de match_stats se repetia una vez por cada
--    autoevaluación del jugador (producto cartesiano). Un jugador con 2
--    partidos y 2 autoevaluaciones terminaba viendo el doble de minutos.
--    Se separan los acumulados de match_stats y self_evaluations en
--    subconsultas agregadas antes de unirlas a profiles.
-- 2. Un jugador sin ninguna categoría asignada (por ejemplo por una alta
--    incompleta) no podía ver ni cargar sus propias estadísticas en ningún
--    partido con categoría asignada, porque matches_select_scoped solo
--    contemplaba "el partido no tiene categoría" como caso general, pero no
--    "el jugador no tiene categoría". Se agrega esa condición simétrica
--    también en trainings_select_scoped.
-- ============================================================================

create or replace view public.player_season_stats as
select
  p.id as player_id,
  p.full_name,
  coalesce(ms.partidos_convocado, 0) as partidos_convocado,
  coalesce(ms.partidos_titular, 0) as partidos_titular,
  coalesce(ms.partidos_suplente, 0) as partidos_suplente,
  coalesce(ms.minutos_totales, 0) as minutos_totales,
  coalesce(ms.goles_totales, 0) as goles_totales,
  coalesce(ms.asistencias_totales, 0) as asistencias_totales,
  coalesce(ms.amarillas_totales, 0) as amarillas_totales,
  coalesce(ms.rojas_totales, 0) as rojas_totales,
  se.autoevaluacion_promedio
from public.profiles p
left join (
  select
    player_id,
    count(*) filter (where convocado) as partidos_convocado,
    count(*) filter (where titular) as partidos_titular,
    count(*) filter (where suplente) as partidos_suplente,
    sum(minutos_jugados) as minutos_totales,
    sum(goles) as goles_totales,
    sum(asistencias) as asistencias_totales,
    sum(tarjetas_amarillas) as amarillas_totales,
    sum(tarjetas_rojas) as rojas_totales
  from public.match_stats
  group by player_id
) ms on ms.player_id = p.id
left join (
  select player_id, round(avg(rating)::numeric, 2) as autoevaluacion_promedio
  from public.self_evaluations
  group by player_id
) se on se.player_id = p.id
where p.role = 'player';

alter view public.player_season_stats set (security_invoker = on);

drop policy "matches_select_scoped" on public.matches;
create policy "matches_select_scoped" on public.matches for select to authenticated
  using (
    public.is_coach()
    or not exists (select 1 from public.match_categories mc where mc.match_id = matches.id)
    or not exists (select 1 from public.player_categories pc where pc.player_id = auth.uid())
    or exists (
      select 1 from public.match_categories mc
      join public.player_categories pc on pc.category_id = mc.category_id
      where mc.match_id = matches.id and pc.player_id = auth.uid()
    )
  );

drop policy "trainings_select_scoped" on public.trainings;
create policy "trainings_select_scoped" on public.trainings for select to authenticated
  using (
    public.is_coach()
    or not exists (select 1 from public.training_categories tc where tc.training_id = trainings.id)
    or not exists (select 1 from public.player_categories pc where pc.player_id = auth.uid())
    or exists (
      select 1 from public.training_categories tc
      join public.player_categories pc on pc.category_id = tc.category_id
      where tc.training_id = trainings.id and pc.player_id = auth.uid()
    )
  );
