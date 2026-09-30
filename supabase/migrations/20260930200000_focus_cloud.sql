-- FOCUS cloud storage + Grow webhook inbox
-- One row per user holds the whole FOCUS workspace (JSON). Grow events land in grow_events
-- (inserted only by the server webhook route with the service role) and are applied by the app.

create table if not exists public.focus_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  device text,
  webhook_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);

alter table public.focus_state enable row level security;

create policy "focus_state: read own" on public.focus_state
  for select to authenticated using (auth.uid() = user_id);
create policy "focus_state: insert own" on public.focus_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "focus_state: update own" on public.focus_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.grow_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists grow_events_user_pending_idx
  on public.grow_events (user_id, processed_at, received_at);

alter table public.grow_events enable row level security;

create policy "grow_events: read own" on public.grow_events
  for select to authenticated using (auth.uid() = user_id);
create policy "grow_events: mark own processed" on public.grow_events
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- live updates between devices and for incoming Grow events
alter publication supabase_realtime add table public.focus_state;
alter publication supabase_realtime add table public.grow_events;
