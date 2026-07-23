-- ============================================================================
-- Club Stats App - Categorías múltiples por jugador + entrenamientos/partidos
-- divididos por categoría, visibles solo para quienes pertenecen a ellas.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. Jugador <-> Categoría (muchos a muchos)
-- ------------------------------------------------------------
create table public.player_categories (
  player_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, category_id)
);

alter table public.player_categories enable row level security;

create policy "player_categories_select_all" on public.player_categories
  for select to authenticated using (true);
create policy "player_categories_insert_self_or_coach" on public.player_categories
  for insert to authenticated with check (player_id = auth.uid() or public.is_coach());
create policy "player_categories_delete_self_or_coach" on public.player_categories
  for delete to authenticated using (player_id = auth.uid() or public.is_coach());

-- Migrar la categoría única existente a la nueva tabla
insert into public.player_categories (player_id, category_id)
select id, category_id from public.profiles where category_id is not null
on conflict do nothing;

alter table public.profiles drop column category_id;

-- ------------------------------------------------------------
-- 2. Entrenamiento <-> Categoría (muchos a muchos)
-- ------------------------------------------------------------
create table public.training_categories (
  training_id uuid not null references public.trainings (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (training_id, category_id)
);

alter table public.training_categories enable row level security;

create policy "training_categories_select_all" on public.training_categories
  for select to authenticated using (true);
create policy "training_categories_insert_coach" on public.training_categories
  for insert to authenticated with check (public.is_coach());
create policy "training_categories_delete_coach" on public.training_categories
  for delete to authenticated using (public.is_coach());

-- Distintas categorías pueden entrenar el mismo día
alter table public.trainings drop constraint trainings_date_key;

-- ------------------------------------------------------------
-- 3. Partido <-> Categoría (muchos a muchos)
-- ------------------------------------------------------------
create table public.match_categories (
  match_id uuid not null references public.matches (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (match_id, category_id)
);

alter table public.match_categories enable row level security;

create policy "match_categories_select_all" on public.match_categories
  for select to authenticated using (true);
create policy "match_categories_insert_coach" on public.match_categories
  for insert to authenticated with check (public.is_coach());
create policy "match_categories_delete_coach" on public.match_categories
  for delete to authenticated using (public.is_coach());

-- ------------------------------------------------------------
-- 4. Visibilidad: el cuerpo técnico ve todo; un jugador solo ve lo de
--    sus categorías (o lo que no tiene categoría asignada, que es general)
-- ------------------------------------------------------------
drop policy "trainings_select_all" on public.trainings;
create policy "trainings_select_scoped" on public.trainings for select to authenticated
  using (
    public.is_coach()
    or not exists (select 1 from public.training_categories tc where tc.training_id = trainings.id)
    or exists (
      select 1 from public.training_categories tc
      join public.player_categories pc on pc.category_id = tc.category_id
      where tc.training_id = trainings.id and pc.player_id = auth.uid()
    )
  );

drop policy "matches_select_all" on public.matches;
create policy "matches_select_scoped" on public.matches for select to authenticated
  using (
    public.is_coach()
    or not exists (select 1 from public.match_categories mc where mc.match_id = matches.id)
    or exists (
      select 1 from public.match_categories mc
      join public.player_categories pc on pc.category_id = mc.category_id
      where mc.match_id = matches.id and pc.player_id = auth.uid()
    )
  );
