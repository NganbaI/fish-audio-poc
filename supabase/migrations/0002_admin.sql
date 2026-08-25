-- Fish Audio POC — super-admin role.
-- An admin can read every user's agents and calls (a global view on top of the
-- per-user dashboard). Membership lives in `admins`; is_admin() gates access.

-- ---------------------------------------------------------------------------
-- admins: user ids with global read access.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A user may check their own admin row (so the app can ask "am I an admin?").
create policy "admins_select_self"
  on public.admins for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- is_admin(): true when the current user is in admins. SECURITY DEFINER so the
-- function can read `admins` regardless of RLS, and so policies avoid recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Broaden read access: admins can SELECT all agents and all calls.
-- (Per-user policies from 0001 still apply for everyone else.)
-- ---------------------------------------------------------------------------
create policy "agents_select_admin"
  on public.agents for select
  using (public.is_admin());

create policy "calls_select_admin"
  on public.calls for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grant admin to a user. Run AFTER that person has signed up (so they exist in
-- auth.users). Replace the email with the account you want to make an admin:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict (user_id) do nothing;
-- ---------------------------------------------------------------------------
