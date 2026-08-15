-- ============================================================================
-- Club Stats App
-- Pizarra táctica: el cuerpo técnico arma una cancha con fichas (jugadores
-- propios, rivales y balón) y guarda "pasos" (frames) que representan un
-- movimiento. Los jugadores después ven esa secuencia reproducida como una
-- animación (no es video, son las mismas fichas moviéndose entre pasos).
-- ============================================================================

create table public.tactics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tactic_categories (
  tactic_id uuid not null references public.tactics (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (tactic_id, category_id)
);

-- Cada frame guarda el set completo de fichas (id, tipo, etiqueta, x/y en %)
-- para ese paso. Animar de un paso a otro es simplemente interpolar x/y por
-- ficha (misma id) en el cliente.
create table public.tactic_frames (
  id uuid primary key default gen_random_uuid(),
  tactic_id uuid not null references public.tactics (id) on delete cascade,
  position int not null,
  label text,
  duration_ms int not null default 1200,
  tokens jsonb not null default '[]'::jsonb,
  unique (tactic_id, position)
);

alter table public.tactics enable row level security;
alter table public.tactic_categories enable row level security;
alter table public.tactic_frames enable row level security;

-- Visibilidad igual a entrenamientos/partidos: el cuerpo técnico ve todo, un
-- jugador solo lo de sus categorías (o lo sin categoría, que es general).
create policy "tactics_select_scoped" on public.tactics for select to authenticated
  using (
    public.is_coach()
    or not exists (select 1 from public.tactic_categories tc where tc.tactic_id = tactics.id)
    or exists (
      select 1 from public.tactic_categories tc
      join public.player_categories pc on pc.category_id = tc.category_id
      where tc.tactic_id = tactics.id and pc.player_id = auth.uid()
    )
  );
create policy "tactics_insert_coach" on public.tactics for insert to authenticated
  with check (public.is_coach());
create policy "tactics_update_coach" on public.tactics for update to authenticated
  using (public.is_coach());
create policy "tactics_delete_coach" on public.tactics for delete to authenticated
  using (public.is_coach());

create policy "tactic_categories_select_all" on public.tactic_categories for select to authenticated
  using (true);
create policy "tactic_categories_insert_coach" on public.tactic_categories for insert to authenticated
  with check (public.is_coach());
create policy "tactic_categories_delete_coach" on public.tactic_categories for delete to authenticated
  using (public.is_coach());

create policy "tactic_frames_select_scoped" on public.tactic_frames for select to authenticated
  using (
    exists (
      select 1 from public.tactics t
      where t.id = tactic_frames.tactic_id
      and (
        public.is_coach()
        or not exists (select 1 from public.tactic_categories tc where tc.tactic_id = t.id)
        or exists (
          select 1 from public.tactic_categories tc
          join public.player_categories pc on pc.category_id = tc.category_id
          where tc.tactic_id = t.id and pc.player_id = auth.uid()
        )
      )
    )
  );
create policy "tactic_frames_insert_coach" on public.tactic_frames for insert to authenticated
  with check (public.is_coach());
create policy "tactic_frames_update_coach" on public.tactic_frames for update to authenticated
  using (public.is_coach());
create policy "tactic_frames_delete_coach" on public.tactic_frames for delete to authenticated
  using (public.is_coach());
