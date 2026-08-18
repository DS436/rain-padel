-- Rain Padel — schema.
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- One row per tournament. The whole Tournament object lives in `data`; the
-- other columns are denormalised copies so the home screen can list sessions
-- without downloading every blob. `save()` writes both, always together.

create table if not exists public.tournaments (
  id           uuid        primary key,
  name         text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  status       text        not null default 'live',
  player_count int         not null default 0,
  data         jsonb       not null
);

create index if not exists tournaments_created_at_idx
  on public.tournaments (created_at desc);

-- No accounts in v1: this is a casual app shared between friends and every
-- session is meant to be visible on one screen. RLS is enabled with a fully
-- permissive policy rather than left off, so Supabase does not flag the table
-- as unprotected. Anyone with the anon key can read and write any session.
alter table public.tournaments enable row level security;

drop policy if exists "anon full access" on public.tournaments;
create policy "anon full access" on public.tournaments
  for all
  to anon, authenticated
  using (true)
  with check (true);
