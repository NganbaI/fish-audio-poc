-- Fish Audio POC — initial schema: agents + calls, with Row-Level Security.
-- Run in the Supabase SQL editor, or via `supabase db push` with the CLI.

-- ---------------------------------------------------------------------------
-- agents: one row per Fish Audio agent created through the dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.agents (
  id             uuid primary key default gen_random_uuid(),
  fish_agent_id  text not null,
  name           text,
  config         jsonb,
  owner_user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index if not exists agents_owner_idx on public.agents (owner_user_id);
create index if not exists agents_fish_id_idx on public.agents (fish_agent_id);

alter table public.agents enable row level security;

create policy "agents_select_own"
  on public.agents for select
  using (owner_user_id = auth.uid());

create policy "agents_insert_own"
  on public.agents for insert
  with check (owner_user_id = auth.uid());

create policy "agents_update_own"
  on public.agents for update
  using (owner_user_id = auth.uid());

create policy "agents_delete_own"
  on public.agents for delete
  using (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- calls: one row per voice session, written by the webhook (service role) and
-- read by the owning user (RLS). `session_id` is the Fish session id.
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  session_id       text primary key,
  fish_agent_id    text,
  agent_id         uuid references public.agents (id) on delete set null,
  owner_user_id    uuid references auth.users (id) on delete cascade,
  status           text not null default 'created',
  ended_reason     text,
  source           text,
  summary          text,
  analysis         jsonb,
  transcript       jsonb,
  recording_urls   jsonb,
  duration_seconds integer,
  hydrated         boolean not null default false,
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists calls_owner_idx on public.calls (owner_user_id);
create index if not exists calls_agent_idx on public.calls (agent_id);

alter table public.calls enable row level security;

-- Users can only read their own calls. Writes come from the service-role client
-- in the webhook (which bypasses RLS), so no user insert/update policy is needed.
create policy "calls_select_own"
  on public.calls for select
  using (owner_user_id = auth.uid());
