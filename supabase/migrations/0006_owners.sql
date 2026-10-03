-- Rain Padel — one squad per account.
--
-- Until now every signed-in user saw every row (`using (true)` since 0002).
-- That was right with one account. With a second one, each account keeps its
-- own sessions, squad and saved pairs, and cannot see or touch the other's.
--
-- Run this BEFORE creating the second user in Authentication -> Users. The
-- backfill hands every existing row to the oldest account, which is only
-- guaranteed to be you while you are the only account.
--
-- The app never sends owner_id. Inserts pick it up from the column default,
-- `auth.uid()`, and upserts that update an existing row leave it alone — so
-- the code already deployed keeps working once this has run. Run it BEFORE
-- deploying the code that ships with it, which looks share codes up through
-- `session_by_share_code` below.

do $$
declare
  original uuid := (select id from auth.users order by created_at limit 1);
begin
  if original is null then
    raise exception 'No users yet — create your own account first (see README).';
  end if;

  alter table public.tournaments add column if not exists owner_id uuid
    references auth.users (id) on delete cascade default auth.uid();
  alter table public.players add column if not exists owner_id uuid
    references auth.users (id) on delete cascade default auth.uid();
  alter table public.saved_teams add column if not exists owner_id uuid
    references auth.users (id) on delete cascade default auth.uid();

  update public.tournaments set owner_id = original where owner_id is null;
  update public.players     set owner_id = original where owner_id is null;
  update public.saved_teams set owner_id = original where owner_id is null;
end $$;

alter table public.tournaments alter column owner_id set not null;
alter table public.players     alter column owner_id set not null;
alter table public.saved_teams alter column owner_id set not null;

create index if not exists tournaments_owner_idx on public.tournaments (owner_id);
create index if not exists players_owner_idx     on public.players (owner_id);
create index if not exists saved_teams_owner_idx on public.saved_teams (owner_id);

-- The policies: your rows, and only your rows, for every operation. The
-- `with check` is what stops an insert or update from writing a row under
-- someone else's id.
drop policy if exists "authenticated full access" on public.tournaments;
drop policy if exists "own rows" on public.tournaments;
create policy "own rows" on public.tournaments
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "authenticated full access" on public.players;
drop policy if exists "own rows" on public.players;
create policy "own rows" on public.players
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "authenticated full access" on public.saved_teams;
drop policy if exists "own rows" on public.saved_teams;
create policy "own rows" on public.saved_teams
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Share codes have to keep working across accounts. 0005's anon policy covers
-- a spectator with no account, but a viewer who happens to be signed in is the
-- `authenticated` role, and "own rows" would hide the other account's night
-- from them. Widening that policy would also leak the other account's shared
-- sessions into the signed-in session list, so the lookup goes through this
-- function instead: it answers exactly one code with exactly one blob.
create or replace function public.session_by_share_code(share_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select data
  from public.tournaments
  where data -> 'share' ->> 'code' = share_code
  limit 1
$$;

revoke all on function public.session_by_share_code(text) from public;
grant execute on function public.session_by_share_code(text) to anon, authenticated;
