-- ============================================================================
-- Club Stats App - Esquema inicial
-- Ejecutar en el SQL Editor de Supabase (Project > SQL Editor > New query)
-- ============================================================================

-- ------------------------------------------------------------
-- 1. PERFILES (extiende auth.users)
-- ------------------------------------------------------------
create type public.user_role as enum ('player', 'coach', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'player',
  jersey_number int,
  position text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil "player" cuando alguien se registra
create function public.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: ¿el usuario actual es cuerpo técnico?
create function public.is_coach()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('coach', 'admin')
  );
$$;

-- ------------------------------------------------------------
-- 2. ENTRENAMIENTOS Y ASISTENCIA
-- ------------------------------------------------------------
create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create type public.attendance_status as enum ('presente', 'tarde', 'ausente');

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_id, player_id)
);

-- ------------------------------------------------------------
-- 3. MULTAS
-- ------------------------------------------------------------
create table public.fine_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  amount numeric(10, 2) not null
);

insert into public.fine_types (code, name, amount) values
  ('sin_uniforme', 'Falta de uniforme', 1000),
  ('ausencia_injustificada', 'Ausencia injustificada', 1000),
  ('llegada_tardia', 'Llegada tardía', 1000),
  ('sin_espinilleras', 'No llevar espinilleras', 1000);

create table public.fines (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  fine_type_id uuid not null references public.fine_types (id),
  date date not null default current_date,
  training_id uuid references public.trainings (id) on delete set null,
  paid boolean not null default false,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. PARTIDOS Y ESTADÍSTICAS
-- ------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  opponent text not null,
  location text,
  our_score int,
  opponent_score int,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  convocado boolean not null default false,
  titular boolean not null default false,
  suplente boolean not null default false,
  minutos_jugados int not null default 0,
  goles int not null default 0,
  asistencias int not null default 0,
  tarjetas_amarillas int not null default 0,
  tarjetas_rojas int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id),
  check (minutos_jugados >= 0 and minutos_jugados <= 130),
  check (not (titular and suplente))
);

-- ------------------------------------------------------------
-- 5. AUTOEVALUACIÓN DEL JUGADOR
-- ------------------------------------------------------------
create table public.self_evaluations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- ------------------------------------------------------------
-- 6. SCOUTING DEL RIVAL
-- ------------------------------------------------------------
create table public.opponent_scouting (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade unique,
  system_of_play text,
  strengths text,
  weaknesses text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. VISTAS DE ACUMULADOS
-- ------------------------------------------------------------
create view public.player_season_stats as
select
  p.id as player_id,
  p.full_name,
  count(ms.id) filter (where ms.convocado) as partidos_convocado,
  count(ms.id) filter (where ms.titular) as partidos_titular,
  count(ms.id) filter (where ms.suplente) as partidos_suplente,
  coalesce(sum(ms.minutos_jugados), 0) as minutos_totales,
  coalesce(sum(ms.goles), 0) as goles_totales,
  coalesce(sum(ms.asistencias), 0) as asistencias_totales,
  coalesce(sum(ms.tarjetas_amarillas), 0) as amarillas_totales,
  coalesce(sum(ms.tarjetas_rojas), 0) as rojas_totales,
  round(avg(se.rating)::numeric, 2) as autoevaluacion_promedio
from public.profiles p
left join public.match_stats ms on ms.player_id = p.id
left join public.self_evaluations se on se.player_id = p.id
where p.role = 'player'
group by p.id, p.full_name;

create view public.player_fines_summary as
select
  p.id as player_id,
  p.full_name,
  ft.code,
  ft.name as fine_name,
  count(f.id) as cantidad,
  coalesce(sum(ft.amount), 0) as total_adeudado,
  coalesce(sum(ft.amount) filter (where f.paid), 0) as total_pagado,
  coalesce(sum(ft.amount) filter (where not f.paid), 0) as total_pendiente
from public.profiles p
left join public.fines f on f.player_id = p.id
left join public.fine_types ft on ft.id = f.fine_type_id
where p.role = 'player'
group by p.id, p.full_name, ft.code, ft.name;

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trainings enable row level security;
alter table public.attendance enable row level security;
alter table public.fine_types enable row level security;
alter table public.fines enable row level security;
alter table public.matches enable row level security;
alter table public.match_stats enable row level security;
alter table public.self_evaluations enable row level security;
alter table public.opponent_scouting enable row level security;

-- Profiles: todos los autenticados ven el plantel; cada uno edita lo suyo; el cuerpo técnico edita todo
create policy "profiles_select_all" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles_update_coach" on public.profiles for update to authenticated using (public.is_coach());

-- Trainings: lectura para todos; cualquiera puede "abrir" el día (insert);
-- solo el cuerpo técnico edita/borra el registro del entrenamiento
create policy "trainings_select_all" on public.trainings for select to authenticated using (true);
create policy "trainings_insert_any" on public.trainings for insert to authenticated with check (true);
create policy "trainings_update_coach" on public.trainings for update to authenticated using (public.is_coach());
create policy "trainings_delete_coach" on public.trainings for delete to authenticated using (public.is_coach());

-- Attendance: el jugador carga/edita su propia asistencia; el cuerpo técnico ve y edita todo
create policy "attendance_select_own_or_coach" on public.attendance for select to authenticated
  using (player_id = auth.uid() or public.is_coach());
create policy "attendance_insert_own_or_coach" on public.attendance for insert to authenticated
  with check (player_id = auth.uid() or public.is_coach());
create policy "attendance_update_own_or_coach" on public.attendance for update to authenticated
  using (player_id = auth.uid() or public.is_coach());

-- Fine types: lectura para todos
create policy "fine_types_select_all" on public.fine_types for select to authenticated using (true);

-- Fines: el jugador ve las suyas; solo el cuerpo técnico crea/edita
create policy "fines_select_own_or_coach" on public.fines for select to authenticated
  using (player_id = auth.uid() or public.is_coach());
create policy "fines_write_coach" on public.fines for insert to authenticated with check (public.is_coach());
create policy "fines_update_coach" on public.fines for update to authenticated using (public.is_coach());
create policy "fines_delete_coach" on public.fines for delete to authenticated using (public.is_coach());

-- Matches: lectura para todos, escritura solo cuerpo técnico
create policy "matches_select_all" on public.matches for select to authenticated using (true);
create policy "matches_write_coach" on public.matches for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Match stats: lectura para todos, escritura solo cuerpo técnico (registro oficial)
create policy "match_stats_select_all" on public.match_stats for select to authenticated using (true);
create policy "match_stats_write_coach" on public.match_stats for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- Self evaluations: cada jugador carga/ve la suya; el cuerpo técnico ve todas
create policy "self_eval_select_own_or_coach" on public.self_evaluations for select to authenticated
  using (player_id = auth.uid() or public.is_coach());
create policy "self_eval_insert_own" on public.self_evaluations for insert to authenticated
  with check (player_id = auth.uid());
create policy "self_eval_update_own" on public.self_evaluations for update to authenticated
  using (player_id = auth.uid());

-- Opponent scouting: lectura para todos, escritura solo cuerpo técnico
create policy "scouting_select_all" on public.opponent_scouting for select to authenticated using (true);
create policy "scouting_write_coach" on public.opponent_scouting for all to authenticated using (public.is_coach()) with check (public.is_coach());
