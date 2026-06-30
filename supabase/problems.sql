-- QuantPrep — problems bank (locked down).
-- The browser must NEVER read this table directly. Row Level Security is
-- enabled with NO policies, so the anon/authenticated PostgREST roles get
-- nothing. Only the server (service_role key, used in /api routes) can read
-- it, and those routes never return the answer except on an explicit reveal.

create table if not exists public.problems (
  id                 integer primary key,
  question_name      text,
  question_statement text,
  hints              text,
  final_answer       text,
  solution           text,
  topic              text,
  difficulty         text,
  asked_in           text
);

create index if not exists problems_difficulty_idx on public.problems (difficulty);
create index if not exists problems_topic_idx on public.problems (topic);

-- Lock it: RLS on, zero policies → anon & authenticated clients are denied.
-- (service_role bypasses RLS, which is what the server API routes use.)
alter table public.problems enable row level security;
revoke all on public.problems from anon, authenticated;

-- ── How to load the 1,082 problems ───────────────────────────────────────
-- 1. Run this file in Supabase → SQL Editor (creates the empty table).
-- 2. Supabase → Table Editor → problems → Insert → "Import data from CSV"
--    and upload merged_problems.csv (its columns map 1:1 to this table).
--    The table is RLS-locked, but the dashboard import uses an admin
--    connection, so it works fine.
