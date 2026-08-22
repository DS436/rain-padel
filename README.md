# Rain Padel

Run a social padel session from your phone. Enter who turned up, and the app
works out who partners whom on which court, then keeps a running individual
leaderboard as you type in scores.

Three formats, each playable as individuals or as fixed pairs:

- **Americano** — everyone partners everyone exactly once (in teams mode, every
  pair plays every other pair once). The whole schedule is known upfront.
  4–32 players, or 3–32 teams.
- **Mexicano** — everyone is re-ranked after every game and re-paired
  1+4 vs 2+3 (in teams mode, the top two pairs take court 1), so winners drift
  toward court 1. Only the next game exists. Up to 64 players or teams.
- **Mixicano** — either of the above with one rule added: the roster is split in
  two and every pair takes one player from each half. Traditionally men and
  women, which is where the name comes from, but the same constraint is how
  people balance a night by level — so you name the two sides yourself.

Any of them can finish with a **knockout**. See *Giving the night an ending*.

The rule that makes it work: **your score is your own.** A 24-point match ending
14–10 gives *both* winners 14 and *both* losers 10, so a weak partner never
sinks you. Highest individual total wins — no bracket, no final.

## Rounds and games

A **game** is one turn on court — every court playing at once, one set of
scores. A **round** is a full cycle: it is finished when everyone has partnered
everyone (or, in teams mode, played everyone). Four players is three games to a
round, five is four.

You set rounds, not games, because the round is the unit that is actually fair —
by the end of one, everybody has had the same draw. `lib/cycles.ts` is the only
place that grouping lives; the schedule itself is unchanged, and sessions
created before this split keep one game to a round so their printed round
numbers still mean what they meant.

Because a padel night never goes to plan, the session is editable while it runs:

- **Court time.** Tell it when the booking ends and it says whether the planned
  rounds fit, warns when they would overrun, and offers the round count that
  fits the time left.
- **Keep going.** The round count is a plan, not a commitment, so the setup
  screen starts at one round and stops asking. *+ Add round* is on the live
  screen at every point in the night, and *Play another round* appears on the
  last round and again on the results screen after it. Both add a whole fresh
  cycle and put you on the next court.
- **Stop here.** *Finish here* ends the session on the game you are on. Every
  game that has a score is kept, including a part-scored one; everything still
  unplayed is dropped, so the standings on screen are the final standings with
  nothing left to tally. This is how a night that planned three rounds and
  played one and a half actually ends.
- **Rounds.** Add or drop rounds mid-session, or delete a game that never
  happened. Already-played games can never be deleted from under you.
- **Scores.** Any game, any match, at any time — standings recompute instantly.
- **Players.** Somebody leaves or turns up late; the remaining games rebuild
  around them. In teams mode a pair leaves and returns as one unit.

## Giving the night an ending

A table scored on points has no ending — it just stops, and whoever drew the
strongest partners is on top of it. The knockout gives the evening a last game
everybody watches without throwing the group stage away.

Press **Finals** at any point once something has been played. Everything so far
becomes the qualifying table; the top pairs go into a bracket of two, four or
eight, and sudden death takes over. A third-place play-off can run on the court
the final is not using.

Who partners whom depends on the session. In teams mode the pairs already exist
and the top of them walk in. As individuals the qualifiers are folded
strongest-with-weakest — first plays with last of the qualifiers — so no pair
starts the bracket as a certainty; in a mixed draw the fold keeps one player
from each side. Seeding is the standard doubling order, so the top two seeds can
only meet in the final.

Nothing about the bracket beyond the entrants is stored. Each round is derived
from the winners of the one before, which is why correcting a semi-final score
re-derives the final, exactly as correcting a group score moves the table. A
drawn knockout game goes to the better seed — the group stage is the tiebreak,
which is what a seeding is for and means nobody plays a decider at eleven at
night. Cancelling the finals drops the bracket games and hands back the
leaderboard with every group score intact.

## Entering a score

The interaction repeated forty times a night, so there are three ways in and
the choice is made once for every court:

- **Tap** — every legal number from 0 to the target, laid out at once. 14 is one
  touch. This is the default.
- **Slide** — drag the whole race at speed.
- **Type** — a keyboard, for the number nobody wants to hunt for.

Points scoring is *linked*: one number drives both sides, so the pair always
sums to the target and an impossible total cannot be entered. Tap either score
to choose which side you are entering. A match that stopped early goes through
*Ended early?*, which unlinks the two sides and accepts whatever they were.

## The squad

`/players` is a saved list of the people you play with, shared by every session.
Pick them when you set a night up instead of retyping names, and their record
accumulates: sessions, games, points per game, wins, and the last few nights.

Career numbers are folded out of the sessions themselves rather than kept in a
counter — for the same reason standings are derived, a score corrected three
weeks later has to move the record. The link is `Player.profileId`, with a
name match as the fallback for sessions recorded before the squad existed.
Removing someone from the squad never touches a night they played in.

Teams mode has the same thing one level up. A pair you play as every week is
saved once — star it on the setup screen, or build it by tapping two names out
of the squad — and comes back as one tap next time, squad links intact so the
career record still joins up. `lib/teams.ts` holds the pair identity, which is
order-independent and prefers the squad link over the name, so "Ben & Ana" is
recognised as the pair already saved and renaming somebody does not create a
second one. Deleting a saved pair can never corrupt a night already played.

## Reading a session

The Standings tab draws the night three ways, because one chart can only answer
one question:

- **Race** — cumulative points. Who is winning, and by how much.
- **Places** — position after every game. Who is *climbing*, which the race
  chart hides: two players can be four points apart and six places apart.
- **Steady** — every game a player scored, as an average with the
  worst-to-best band behind it. Who turns up every time, versus who wins one
  21–3 and loses the rest.

The focused player follows you between all three. Tap anyone — in a chart or in
the table — for their own night: rank, streak, points per game, a bar per game,
and who they scored best alongside.

## The end of the night

The results screen is the one that gets read out loud, so it is not a second
copy of the table. Every finishing place gets its own line, the podium and the
wooden spoon get their own copy, and the awards nobody plays for get handed out:
most consistent, climber of the night, biggest game, hardest to score against.

Two rules keep `lib/awards.ts` from grating. **Nothing is invented** — every
line restates a number already on the scoreboard, so last place gets a joke
rather than a hug. And **it varies without flickering**: the wording is chosen
with a seeded RNG keyed on the session and the player, so two nights read
differently while one night reads the same on every reload and on everybody's
phone. `Math.random()` would reshuffle the copy under the organiser's thumb on
every re-render.

From there the night ends whichever way suits: copy the results, download the
CSV, play another round, start a new session with the same players (or the same
*teams* — a teams night runs back as pairs, not as eight loose names), or go
home.

## Getting started

```bash
npm install
npm run dev
```

The app runs immediately on an in-memory store, but **nothing survives a
refresh** until you connect a database, and a banner says so.

`npm run dev:demo` forces that in-memory mode on port 3100 even when Supabase
credentials are present — useful for poking at the UI without touching real
sessions or signing in.

### Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations in
   [`supabase/migrations/`](supabase/migrations) in order, in the SQL editor —
   `0001_init.sql` first, then `0003_players.sql` for the squad table and
   `0004_saved_teams.sql` for the saved pairs. Mixed draws and the knockout are
   stored inside the session blob and need no migration.
   (`0002_auth.sql` comes later; see *Signing in*.)
3. Copy `.env.example` to `.env.local` and fill in the project URL and the anon
   (publishable) key from Project Settings.

```bash
cp .env.example .env.local
```

Restart `npm run dev` and sessions persist.

**On access:** migration `0001` leaves the table open to the anonymous key so
the app works before there is a login. Migration `0002` closes that and requires
a signed-in user — see *Signing in* below.

## Signing in

The app is invite-only and there is no signup. Whoever runs the night types a
password; everyone else just plays.

1. In Supabase, **Authentication → Users → Add user**. Use a real email address
   (the emailed-code flow will need it later), set a password, and tick
   *Auto Confirm User*.
2. In **Authentication → Sign In / Providers**, turn **Allow new users to sign
   up** off. With no signup and one user, the allowlist is the user table.
3. Set `LOGIN_EMAIL` to that address — in `.env.local` locally, and in the
   Vercel project settings for production.
4. Run [`supabase/migrations/0002_auth.sql`](supabase/migrations/0002_auth.sql).
   This drops the anonymous policy, so **do it after step 1** or the app locks
   itself out.

`LOGIN_EMAIL` is deliberately *not* `NEXT_PUBLIC_` — the login form posts the
password to `/api/login`, which holds the address server-side and asks Supabase
to verify. The address never ships in the browser bundle, and no password
comparison happens in this codebase.

Adding people later is two changes: a two-step form calling the `requestCode` /
`verifyCode` helpers already in `AuthProvider`, and an `owner_id` column on
`tournaments` so the policy can key on `auth.uid()` instead of letting every
signed-in user see everything.

## Deploying

Import the repo in Vercel and accept the defaults. Add three environment
variables in the project settings: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `LOGIN_EMAIL`.

`NEXT_PUBLIC_*` values are baked in at build time, so after changing any of them
you have to redeploy — setting them on an existing deployment does nothing until
it rebuilds.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Full suite — scheduler, standings, reducer, timer, store |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## How it is put together

```
lib/scheduler.ts     rotation engine — pure, integer-indexed, no dependencies
lib/rounds.ts        the only place player indices meet player ids
lib/standings.ts     derived from rounds on every call, never cached
lib/progression.ts   the night game by game: ranks, streaks, steadiness
lib/awards.ts        the same numbers, said out loud
lib/knockout.ts      seeding and the bracket, derived from the group table
lib/news.ts          the landing page's headline feeds — untrusted, always optional
lib/tournamentReducer.ts   every state transition, as one pure function
lib/store/           TournamentStore interface + Supabase and memory adapters
```

Two invariants worth knowing before changing anything:

1. **Standings, history and round completeness are never stored.** They are
   recomputed from `rounds`, which is what makes editing a past score correct
   with no invalidation logic anywhere.
2. **The scheduler never sees a player id.** It works in integers so the
   acceptance table can be asserted directly. `lib/rounds.ts` translates, and an
   index is only valid within a single scheduler call — deactivating a player
   renumbers everything above them.

### The rotation engine

Americano schedules come from a round-robin circle construction, treating each
round-robin pair as a *team* rather than as opponents. That is provably
repeat-free below the cycle length and needs no search: 24 players over 23
rounds generates in about 1ms.

Sit-outs are chosen by minimising the sum of squares of the resulting rest
counts, which levels the tail better than minimising raw spread. Measured rest
spread is 0 for every count divisible by four and never worse than 2 otherwise —
except above ~30 players, where the brute-force cap is exceeded and spread grows
to about 5. `__tests__/scheduler.perf.test.ts` records that rather than asserting
it.

## Scoreboard

Ranked on points, always — W/D/L are shown for context but never decide the
order, and the crowns follow the points standing even when you sort by wins.
Player colours come from roster position rather than a hash of the id, because
hashing produced three near-identical pinks in an eight-player session.

## Known limits

- One device. No accounts, no realtime, no spectator view.
- King of the Court is not implemented.
- The landing page's headlines come from third-party RSS feeds. They are fetched
  server-side, cached for an hour, and the section falls back to the written
  guides whenever a feed is slow, malformed or gone.
- Above roughly 30 players the sit-out fairness degrades as described above.
