-- ============================================================================
-- Club Stats App - Categorías + roles de administrador
-- Ejecutar en el SQL Editor de Supabase, después de 0001_init.sql
-- ============================================================================

-- ------------------------------------------------------------
-- 1. CATEGORÍAS (ej: Sub-15, Reserva, Primera)
-- ------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column category_id uuid references public.categories (id) on delete set null;

alter table public.categories enable row level security;

-- Helper: ¿el usuario actual es administrador?
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Lectura para todos; solo un administrador crea/edita/borra categorías
create policy "categories_select_all" on public.categories for select to authenticated using (true);
create policy "categories_write_admin" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 2. Solo un administrador puede cambiar el rol de otro usuario
-- ------------------------------------------------------------
create function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- auth.uid() es null cuando la operación viene del Table Editor / SQL Editor /
  -- service_role (contextos ya confiables que no pasan por la app). Solo se
  -- bloquea cuando hay un usuario autenticado de la app intentando cambiar roles.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el rol de un usuario';
  end if;
  return new;
end;
$$;

create trigger enforce_admin_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_non_admin_role_change();
