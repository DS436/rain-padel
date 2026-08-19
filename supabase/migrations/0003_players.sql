-- Rain Padel — the squad.
--
-- Until now a player was a name typed into one session and nothing else. This
-- table is the person: saved once, picked every week, and the thing a career
-- record hangs off. Sessions still store their own `players` array inside the
-- tournament blob — this table is the source the organiser picks FROM, not a
-- foreign key the session depends on, so deleting someone here can never
-- corrupt a night that has already been played.

create table if not exists public.players (
  id         uuid        primary key,
  name       text        not null,
  created_at timestamptz not null default now(),
  archived   boolean     not null default false
);

create index if not exists players_name_idx on public.players (name);

alter table public.players enable row level security;

drop policy if exists "authenticated full access" on public.players;
create policy "authenticated full access" on public.players
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.players from anon;
grant select, insert, update, delete on public.players to authenticated;
