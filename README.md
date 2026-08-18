# Rain Padel

Run a social padel session from your phone. Enter who turned up, and the app
works out who partners whom on which court, then keeps a running individual
leaderboard as you type in scores.

Two formats:

- **Americano** — everyone partners everyone exactly once. The whole schedule is
  known upfront.
- **Mexicano** — players are re-ranked after every round and re-paired
  1+4 vs 2+3, so winners drift toward court 1. Only the next round exists.

The rule that makes it work: **your score is your own.** A 24-point match ending
14–10 gives *both* winners 14 and *both* losers 10, so a weak partner never
sinks you. Highest individual total wins — no bracket, no final.

Because a padel night never goes to plan, the session is editable while it runs:

- **Court time.** Tell it when the booking ends and it says whether the planned
  rounds fit, warns when they would overrun, and offers the round count that
  fits the time left.
- **Rounds.** Add or drop rounds mid-session, or delete a round that never
  happened. Already-played rounds can never be deleted from under you.
- **Scores.** Any round, any match, at any time — standings recompute instantly.
- **Players.** Somebody leaves or turns up late; the remaining rounds rebuild
  around them.

## Getting started

```bash
npm install
npm run dev
```

The app runs immediately on an in-memory store, but **nothing survives a
refresh** until you connect a database, and a banner says so.

### Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the project URL and the anon
   (publishable) key from Project Settings.

```bash
cp .env.example .env.local
```

Restart `npm run dev` and sessions persist.

**On access:** there are no accounts. The table has row-level security enabled
with a fully permissive policy, so anyone holding the anon key can read and
write every session — that is deliberate for a group of friends sharing one
list, and unsuitable for anything private.

## Deploying

Import the repo in Vercel and accept the defaults. Add the same two environment
variables in the project settings. No other configuration is needed.

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
- Mixicano and King of the Court are not implemented.
- Above roughly 30 players the sit-out fairness degrades as described above.
