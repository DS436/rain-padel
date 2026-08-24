# Rain Padel

Run a social padel session from your phone. Enter who turned up, and the app
works out who partners whom on which court, then keeps a running individual
leaderboard as you type in scores.

Four formats:

- **Americano** — everyone partners everyone exactly once (in teams mode, every
  pair plays every other pair once). The whole schedule is known upfront.
  4–32 players, or 3–32 teams.
- **Mexicano** — the first round is a random draw. After that everyone is
  re-ranked on points and grouped in fours (ranks 1–4 on court 1), paired
  1+4 vs 2+3 (in teams mode, the top two pairs take court 1), so winners drift
  toward court 1. Only the next round exists. Five to eight rounds is a normal
  night. Up to 64 players or teams.
- **King of the Court** — courts are ranked. Winners climb a court, losers drop
  one, and the two pairs arriving on a court are split up so everyone gets a new
  partner every game. Needs two courts to be a ladder, so 8–32 players.
- **Winner Stays On** — one court, one queue. The winning pair holds the court,
  the losers go to the back, and the next two waiting come on as challengers. A
  draw is not a win. 4–16 players.

Two modifiers sit on top rather than being formats of their own:

- **Teams** — fix the pairs so the pair is the unit that gets drawn. Americano
  and Mexicano only.
- **Mixed** (what people call *Mixicano*) — split the roster in two and make
  every pair take one from each half. Traditionally men and women, which is
  where the name comes from, but the same constraint is how people balance a
  night by level, so the two sides are named by whoever sets the session up.
  Americano and Mexicano only.

`lib/formats.ts` is the single table describing all of this — whether a format
precomputes its schedule, whether a round is a cycle, and which modifiers it
takes. Nothing else branches on a format name.

Any of them can finish with a **knockout**. See *Giving the night an ending*.

The rule that makes it work: **your score is your own.** A 24-point match ending
14–10 gives *both* winners 14 and *both* losers 10, so a weak partner never
sinks you. Highest individual total wins — no bracket, no final.

## Rounds and games

A **game** is one turn on court — every court playing at once, one set of
scores.

In **Americano** a **round** is a full cycle: it is finished when everyone has
partnered everyone (or, in teams mode, played everyone). Four players is three
games to a round, five is four. You set rounds, not games, because the cycle is
the unit that is actually fair — by the end of one, everybody has had the same
draw.

**Mexicano has no cycle**, and a round is one slate of courts. Nothing is
scheduled ahead, so "everyone has partnered everyone" is not a milestone it can
reach or would want to: the next round is unknown until this one is scored.
Seven rounds is the default and five to eight is normal, whatever the field
size — a sixteen-player Mexicano is still about seven rounds, where a cycle
length would ask for fifteen. The ladders have no rounds at all, only games.

Which of the three a format is lives in `FORMAT_SPECS` (`cyclic` and
`roundNoun`), and `lib/cycles.ts` is the only place the grouping arithmetic
lives. The schedule itself is unchanged, and sessions created before this split
keep whatever `gamesPerRound` they were stored with, so their printed round
numbers still mean what they meant.

Because a padel night never goes to plan, the session is editable while it runs:

- **Court time.** Tell it when the booking ends and it says whether the planned
  rounds fit, warns when they would overrun, and offers the round count that
  fits the time left.
- **Keep going.** The round count is a plan, not a commitment, so the setup
  screen starts at one round and stops asking. *+ Add round* is on the live
  screen at every point in the night, and *Play another round* appears on the
  last round and again on the results screen after it. Both add a whole fresh
  round — a cycle in Americano, a single slate in Mexicano — and put you on the
  next court.
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

Nobody sets the round count correctly at the start — everybody starts at one and
keeps adding — so **Finish session** appears under your thumb every couple of
games. It therefore never finishes anything on one tap: it opens a sheet with
*Play another round* as the prominent button and *Finish the session* below it.
The same sheet is what **Finish here** opens when you stop short of the plan,
and it says how many planned games that would drop. Finishing is always
reversible, but undoing something is worse than never doing it.

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

Two stacked rows, one per side, each carrying its own names on the left and its
own number on the right. The lit row is the one the pad is driving and it says
so, and the pad repeats the name above itself. The card used to show a big
`14 – 10` in the middle with the pairs floating above and below it, which reads
fine but is unusable for *entering*: you tapped one of the two numbers to pick a
side, and nothing tied the number you had selected to the people it belonged to,
so a thumb landing on the wrong half silently gave the other pair fourteen
points.

Below that it is one control with no mode to pick: every legal number from 0 to
the target is on screen at once, and you either tap one or press and drag your
thumb across the pad and the score follows it. Tapping and dragging are the same
code path, so there is nothing to choose between and nothing to get wrong. There
is deliberately no keyboard — this is used while holding a racket.

`touch-action: pan-y` is what lets both work at once. A drag that starts
vertically still scrolls the page past the second court; a drag that starts
sideways is the pad's, and from then on it gets the vertical component too, so
you can sweep diagonally across all four rows in one movement.

Points scoring is *linked*: one number drives both sides, so the pair always
sums to the target and an impossible total cannot be entered. The complement is
shown faintly on the pad so you can watch it move as you drag. Tap either score
to choose which side you are entering. A match that stopped early goes through
*Ended early?*, which unlinks the two sides and accepts whatever they were.

In time scoring nothing bounds the pad, so it grows a row at a time as the
scores climb rather than capping the night at a number picked in advance.

## The dashboard

`/sessions` is where signing in lands you. It answers "what is this worth" before
it answers "what did I do before": how many nights you have played, every point
scored across all of them, how many people have been through, the format you run
most, and how many weeks on the bounce you have played. A *Let's padel* button
starts the next one, and a live session — there is usually at most one — offers
itself for resuming right under it.

The session list is still there, behind a *Past sessions* disclosure. On the
night itself nobody wants to scroll past eleven finished Tuesdays to reach the
button that starts the twelfth.

Below that: your squad, the rules worth having on screen while people are
arriving (scoring, serving, the Mexicano draw, how sit-outs are chosen), and the
padel headlines from the landing page. The rules cards are the short version with
a link out to `/how-to-play` rather than a second copy of it — two places to edit
the same paragraph is how one of them goes stale.

Every number is folded out of the stored sessions on each render (`lib/dashboard.ts`),
so there is no dashboard table to keep in sync and nothing to backfill. A session
with no scores in it is not counted as a night played — somebody who opened the
form, typed four names and went home did not have an evening of padel — though it
does still count as live, so it can be resumed. The crown is ranked on points per
game rather than total points, with a two-night minimum: total points only measures
who turns up most, and whoever has come every week since March would otherwise hold
it forever regardless of how they played.

## The squad

`/players` is a saved list of the people you play with, shared by every session.
Pick them when you set a night up instead of retyping names, and their record
accumulates: sessions, games, points per game, wins, and the last few nights.

Anyone already in tonight's roster is *removed* from the picker rather than
shown as selected — by profile id, and by name, so somebody typed by hand
before the squad loaded is not offered again either. A picked-and-highlighted
chip reads like a filter, and organisers were tapping the same person twice and
putting them on court against themselves.

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

Three tabs: **Round**, **Standings** and **Schedule**. When a session finishes,
Standings becomes **Results** and holds the finish view — the podium, the awards
and the exports wrapped around the same rows. There is no fourth screen: the
results and the standings were always the same numbers, and having them on two
tabs meant one of them moved while the other did not.

On a screen wider than `xl` the session grows a second column: the games in
reverse order with their scores, and the table underneath. The view is built
thumb-first and capped at `max-w-lg`, which is right on a phone and absurd on
the laptop sitting on the bench next to the court — one narrow strip of app and
900 empty pixels either side. The column is always extra; nothing appears only
there.

Who is sitting out is a card with faces on it rather than a caption. When the
group does not divide by four, "am I on this game?" is the most asked question
of the night, asked out loud by somebody who cannot read small grey text from
where they are standing.

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

## Sharing the night

One person runs the session; everyone else gets a link. **Share** in the session
header mints a six-character code — `K7M-4QD` — and `/s/<code>` opens the same
session with every edit control absent rather than disabled: the schedule, the
scores as they are typed, the live table and the final results, polled every ten
seconds while the tab is visible. `/watch` takes the code by hand for anyone who
has lost the link.

The alphabet drops every character that gets misheard across a court: no O or 0,
no I, L or 1, no U, no S. Regenerating the code revokes every old link
immediately, because the old code no longer resolves to anything.

This is not a security boundary and does not pretend to be one — anyone with the
anon key can already read every session (see the RLS note in the migration).
What a code buys is a screen with no edit controls and a link that is not
guessable from the session name.

Sharing needed no migration: the code lives in the `data` blob and
`getByShareCode` filters on `data->share->>code`. If this table ever holds tens
of thousands of sessions, promote that to a generated column with an index —
nothing above the store would change.

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
lib/formats.ts       what each format is and what it supports — one table
lib/scheduler.ts     rotation engine — pure, integer-indexed, no dependencies
lib/rounds.ts        the only place player indices meet player ids
lib/share.ts         share codes: the alphabet, and what a code is not
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

Four people on a court can be split into two pairs three ways, and a format that
always picks the same one replays the same fixture every time those four meet —
which is exactly what a stable Mexicano top four used to do. `chooseSplit`
therefore *chooses* the split, from a list ordered best-balanced first and
compared strictly-less, so an unplayed quad still gets the textbook 1+4 vs 2+3
and balance is only given up to avoid replaying a partnership or a fixture. The
same function is what hands out new partners in King of the Court.

Mexicano itself is exempt from all of that, in both modes. Its pairing is
dictated by the standings and repeats are the format, not a fault: a stable top
four *should* keep landing on court 1 together, and a teams table where the same
two pairs keep winning *should* keep matching them. Stepping over a repeat means
pairing the leader with somebody they have already out-ranked, which is the
mismatch the format exists to prevent. `rankedSplit` and `generateMexicanoTeamRound`
therefore give history no vote. (An earlier version drew the teams opponent from
a three-deep rank window to dodge those repeats; it was removed for exactly this
reason.)

Past the end of the circle two things change, and neither touches the first
cycle — inside it the circle's teams *are* the format and nothing may reorder
them.

`resplitPastCycle` re-splits every court. The circle's own answer to "which
partnership do we repeat" is the worst one available: it replays whole rounds in
order, same four people, same sides, same person resting. Four players split
three ways, so re-splitting turns one cycle's worth of distinct fixtures into
three. Five players on one court went from five fixtures before it looped to
nine over fifteen games, and six, seven, nine, thirteen and sixteen-player
nights now run a dozen-plus games with no repeated fixture at all.

`pickRow` then chooses which row to play, on three keys in this order: the rest
distribution the row leads to, repeated partnerships, repeated opponents. The
first key plays the row forward through the same sum-of-squares objective
`assignCourts` uses, because judging rest from the row alone is not possible
once courts are scarce — the row forces one rester but `assignCourts` drops
whole teams on top of that, and guessing from the ghost alone measurably made
things worse. It is bounded at 4000 simulations per round, which covers every
field size where rest is delicate and switches off around the same size
`assignCourts` gives up on brute force. Rest fairness outranks variety
deliberately: playing one game fewer than everybody else is a worse night than
seeing the same four names twice.

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

- One organiser. No player accounts, and no realtime — the spectator view polls
  every ten seconds rather than subscribing.
- The landing page's headlines come from third-party RSS feeds. They are fetched
  server-side, cached for an hour, and the section falls back to the written
  guides whenever a feed is slow, malformed or gone.
- Above roughly 30 players the sit-out fairness degrades as described above.
