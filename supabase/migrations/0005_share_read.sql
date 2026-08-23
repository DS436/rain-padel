-- Rain Padel — let the share link work again.
--
-- `0002_auth.sql` added a login and revoked the anon role's access to the
-- tournaments table. That was right for the organiser's own screens, and it
-- broke the one screen that was never supposed to need an account: `/s/[code]`
-- has no AuthGate, because the whole point of a share code is that eight
-- people open the scores without any of them signing up. Postgres refuses at
-- the GRANT level, before RLS is consulted, so the spectator saw
-- "permission denied for table tournaments" rather than an empty result.
--
-- The grant below is SELECT only. Anon can read, never write: scores are
-- entered on the organiser's phone and nowhere else, which is what makes the
-- share link safe to paste into a group chat.
grant select on public.tournaments to anon;

-- The grant alone would let anon read EVERY session, including nights nobody
-- shared. The policy narrows it to rows that actually carry a share code, so a
-- session becomes readable when the organiser shares it and stops being
-- readable the moment they revoke it — which is already what the Share sheet's
-- revoke button does to `data->share`.
--
-- This is still not a security boundary and does not pretend to be one: anyone
-- holding the anon key can list the shared sessions without knowing their
-- codes. It is a padel scoreboard. What the code buys is that the link is not
-- guessable from the session name and opens a screen with no edit controls.
drop policy if exists "anon reads shared sessions" on public.tournaments;
create policy "anon reads shared sessions" on public.tournaments
  for select
  to anon
  using (data -> 'share' ->> 'code' is not null);
