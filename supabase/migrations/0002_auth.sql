-- Rain Padel — require a signed-in user.
-- Run this AFTER creating your user in Authentication -> Users.
--
-- Until now the tournaments table was readable and writable with the anon key,
-- which is what made the app work with no accounts. Now that there is a login,
-- the anon role loses access entirely and only authenticated sessions get in.
--
-- Note there is still no per-user ownership: every signed-in user sees every
-- session. That is correct while the app has exactly one user. Adding an
-- `owner_id uuid references auth.users` column and keying the policy on
-- `auth.uid()` is the change to make before inviting anyone else.

drop policy if exists "anon full access" on public.tournaments;
drop policy if exists "authenticated full access" on public.tournaments;

create policy "authenticated full access" on public.tournaments
  for all
  to authenticated
  using (true)
  with check (true);

-- Belt and braces: the anon role should not reach the table at all, and the
-- authenticated role definitely should. Supabase grants both by default on new
-- tables, so this is making the intent explicit rather than changing it.
revoke all on public.tournaments from anon;
grant select, insert, update, delete on public.tournaments to authenticated;
