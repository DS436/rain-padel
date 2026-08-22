-- Rain Padel — saved teams.
--
-- `0003_players.sql` saved the people. This saves the PAIRS: the two who always
-- turn up together and always play together, so a teams night is picked rather
-- than retyped. It is the source the organiser picks FROM, exactly like
-- `players` — the session still stores its own pairs inside the tournament
-- blob, so deleting a row here can never corrupt a night already played.
--
-- The profile columns are nullable on purpose. A pair can be two names typed in
-- once, or two members of the squad; only the second kind joins up to a career
-- record, and requiring it would make saving a pair harder than typing it.

create table if not exists public.saved_teams (
  id               uuid        primary key,
  name             text        not null,
  player_a_name    text        not null,
  player_a_profile uuid,
  player_b_name    text        not null,
  player_b_profile uuid,
  created_at       timestamptz not null default now(),
  archived         boolean     not null default false
);

create index if not exists saved_teams_name_idx on public.saved_teams (name);

alter table public.saved_teams enable row level security;

drop policy if exists "authenticated full access" on public.saved_teams;
create policy "authenticated full access" on public.saved_teams
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.saved_teams from anon;
grant select, insert, update, delete on public.saved_teams to authenticated;
