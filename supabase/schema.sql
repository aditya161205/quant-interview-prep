-- QuantPrep — user progress schema.
-- Run this in the Supabase dashboard → SQL Editor → New query → Run.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  solved     jsonb not null default '{}'::jsonb,
  bookmarked jsonb not null default '{}'::jsonb,
  activity   jsonb not null default '{}'::jsonb,
  games      integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only read/write their own row.
alter table public.progress enable row level security;

drop policy if exists "own progress - select" on public.progress;
create policy "own progress - select" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "own progress - insert" on public.progress;
create policy "own progress - insert" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own progress - update" on public.progress;
create policy "own progress - update" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Paths (Quant Trader / Quant Researcher curricula): each user's
-- question and task progress, lesson marks, and saved code.
-- ------------------------------------------------------------------
create table if not exists public.path_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  questions  jsonb not null default '{}'::jsonb,
  problems   jsonb not null default '{}'::jsonb,
  marks      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.path_code (
  user_id    uuid not null references auth.users (id) on delete cascade,
  task_id    text not null,
  code       text not null check (length(code) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.path_progress enable row level security;
alter table public.path_code enable row level security;

drop policy if exists "own path progress" on public.path_progress;
create policy "own path progress" on public.path_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own path code" on public.path_code;
create policy "own path code" on public.path_code
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
