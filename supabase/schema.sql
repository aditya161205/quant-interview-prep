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
