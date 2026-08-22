'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, ChoiceChips, Field, Segmented, Stepper } from '@/components/ui';
import { PlayerChips } from '@/components/PlayerChips';
import { SquadPicker } from '@/components/SquadPicker';
import { TeamBuilder, toTeamInputs, type DraftTeam } from '@/components/TeamBuilder';
import { FeasibilityLine } from '@/components/FeasibilityLine';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { DrawInfo, FormatInfo, ModeInfo, RoundsInfo } from '@/components/InfoDot';
import { estimateDuration, parsePlayerNames, parseTeamPairs } from '@/lib/format';
import { defaultGamesPerRound, roundsToGames } from '@/lib/cycles';
import { limitProblem, unitLimits, unitNoun } from '@/lib/limits';
import { ALL_FORMATS, FORMAT_SPECS, formatSpec, parseFormat } from '@/lib/formats';
import { timeStringToEpoch } from '@/lib/court';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import { createReducer, initialState, type CreateInput } from '@/lib/tournamentReducer';
import type { Format, MixedDraw, PlayMode, RosterEntry, Scoring } from '@/lib/types';

export function NewSessionForm() {
  const router = useRouter();
  // "New session, same players" from the finish screen arrives as query params.
  const params = useSearchParams();

  const [name, setName] = useState(defaultName);
  const [format, setFormat] = useState<Format>(parseFormat(params.get('format')));
  const [mode, setMode] = useState<PlayMode>(params.get('mode') === 'teams' ? 'teams' : 'individual');
  const [roster, setRoster] = useState<RosterEntry[]>(() =>
    parsePlayerNames(params.get('players') ?? '').map((n) => ({ name: n })),
  );
  // "New session, same teams" arrives as pairs, so a teams night can be run
  // back as the same teams rather than as eight loose names.
  // A mixed draw ("Mixicano") constrains every team to one player from each
  // half. It is a modifier on the format rather than a third format, because
  // both Americano and Mexicano run mixed and only the pairing rule changes.
  const [mixedOn, setMixedOn] = useState(params.get('mixed') === '1');
  const [groupNames, setGroupNames] = useState<[string, string]>(['Men', 'Women']);
  const [teams, setTeams] = useState<DraftTeam[]>(() =>
    parseTeamPairs(params.get('teams') ?? '').map(([one, two]) => ({
      players: [{ name: one }, { name: two }],
    })),
  );
  const [courts, setCourts] = useState(() => {
    const c = Number(params.get('courts'));
    return Number.isFinite(c) && c >= 1 ? Math.floor(c) : 2;
  });
  const [scoreMode, setScoreMode] = useState<'points' | 'time'>('points');
  const [target, setTarget] = useState(24);
  const [minutes, setMinutes] = useState(15);
  // One round to start. Nobody knows how long the night will run before it
  // starts, and the live screen has an Add round button for exactly that.
  const [rounds, setRounds] = useState(1);
  const [perRoundOverride, setPerRoundOverride] = useState<number | null>(null);
  const [courtUntil, setCourtUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the chosen format will actually accept. A ladder is a rotation of
  // individuals around courts, so the Playing-as and Draw controls are hidden
  // rather than disabled — a switch you are not allowed to touch is worse than
  // no switch at all.
  const spec = formatSpec(format);
  const effectiveMode: PlayMode = spec.supportsTeams ? mode : 'individual';

  // Fixed pairs have already decided who partners whom, so there is nothing
  // left for a mixed draw to constrain.
  const mixed: MixedDraw | null =
    effectiveMode === 'individual' && spec.supportsMixed && mixedOn
      ? { names: groupNames }
      : null;
  const split: [number, number] = [
    roster.filter((e) => e.group !== 1).length,
    roster.filter((e) => e.group === 1).length,
  ];
  const mixedProblem =
    mixed && (split[0] < 2 || split[1] < 2)
      ? `A mixed court needs two from each side. You have ${split[0]} ${groupNames[0]} and ${split[1]} ${groupNames[1]}.`
      : null;

  const units = effectiveMode === 'teams' ? teams.length : roster.length;
  const limits = unitLimits(format, effectiveMode);
  const problem = limitProblem(format, effectiveMode, units);
  const atMax = units >= limits.max;

  // Games in one round. Auto-derived from the field size, because that is what
  // makes a round a full cycle — but a group that only wants two games before
  // the standings redraw can say so.
  // Before anyone is added, preview the cycle for the smallest legal field
  // rather than for zero — "1 game a round" is a nonsense default to look at.
  const cycleSize = Math.max(units, limits.min);
  const autoPerRound = !spec.cyclic
    ? 1
    : defaultGamesPerRound(
        cycleSize,
        effectiveMode,
        // preview the cycle for the smallest legal mixed field before anyone is in
        mixed ? [Math.max(split[0], 2), Math.max(split[1], 2)] : undefined,
      );
  const perRound = spec.cyclic ? (perRoundOverride ?? autoPerRound) : 1;
  const totalGames = roundsToGames(rounds, perRound);

  const scoring: Scoring = useMemo(
    () => (scoreMode === 'points' ? { mode: 'points', target } : { mode: 'time', minutes }),
    [scoreMode, target, minutes],
  );
  const canStart = problem === null && mixedProblem === null && !saving;

  const hint = `${totalGames} game${totalGames === 1 ? '' : 's'} to start · about ${estimateDuration(totalGames, scoring)}. Add more rounds while you play — you never have to decide now.`;

  const toggleSquad = (entry: RosterEntry) => {
    setRoster((current) =>
      current.some((e) => e.profileId === entry.profileId)
        ? current.filter((e) => e.profileId !== entry.profileId)
        : [...current, entry],
    );
  };

  async function start() {
    setSaving(true);
    setError(null);
    const input: CreateInput = {
      name,
      format,
      mode: effectiveMode,
      mixed,
      scoring,
      courts: spec.singleCourt ? 1 : courts,
      plannedRounds: totalGames,
      gamesPerRound: perRound,
      playerNames: roster.map((e) => e.name),
      playerEntries: roster,
      teams: toTeamInputs(teams),
      courtEndsAt: courtUntil ? timeStringToEpoch(courtUntil, Date.now()) : null,
    };
    const reducer = createReducer({ newId, now: Date.now });
    const created = reducer(initialState, { type: 'CREATE', input }).tournament;
    if (!created || created.rounds.length === 0) {
      setError('Could not build a schedule from that line-up.');
      setSaving(false);
      return;
    }
    try {
      await getStore().save(created);
      router.push(`/t/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the session.');
      setSaving(false);
    }
  }

  return (
    <>
      <DevStoreBanner />
      <header className="flex items-center gap-4 px-5 pt-5">
        <Link href="/sessions" className="text-sm text-ink-dim underline underline-offset-4">
          Sessions
        </Link>
        <Link href="/players" className="text-sm text-ink-dim underline underline-offset-4">
          Players
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 pb-40 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">New session</h1>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-xl border border-line bg-surface px-4 text-base focus:border-accent focus:outline-none"
          />
        </Field>

        <Field label="Format" action={<FormatInfo />}>
          <div className="grid gap-3">
            {ALL_FORMATS.map((value) => {
              const f = FORMAT_SPECS[value];
              const on = format === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  aria-pressed={on}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    on ? 'border-accent bg-accent/10' : 'border-line bg-surface'
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`text-lg font-semibold ${on ? 'text-accent' : 'text-ink'}`}>
                      {f.name}
                    </span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wider text-ink-faint">
                      {f.tagline}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-dim">{f.blurb}</span>
                  <span className="mt-2 block text-xs text-ink-faint">{f.bestFor}</span>
                </button>
              );
            })}
          </div>
        </Field>

        {spec.supportsTeams ? (
          <Field
            label="Playing as"
            action={<ModeInfo />}
            hint={`${unitLimits(format, 'individual').min}–${unitLimits(format, 'individual').max} players, or ${unitLimits(format, 'teams').min}–${unitLimits(format, 'teams').max} teams.`}
          >
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'individual', label: 'Individuals' },
                { value: 'teams', label: 'Teams' },
              ]}
            />
          </Field>
        ) : (
          <p className="-mb-4 text-sm text-ink-faint">
            {spec.name} moves individual players between courts, so it is played as individuals and
            everybody gets a new partner as they go.
          </p>
        )}

        {effectiveMode === 'teams' ? (
          <Field label="Teams">
            <TeamBuilder teams={teams} onChange={setTeams} />
          </Field>
        ) : (
          <>
            {spec.supportsMixed ? (
            <Field
              label="Draw"
              action={<DrawInfo />}
              hint={
                mixedOn
                  ? 'Every team is one from each side. Tap the letter on a name to move them across.'
                  : 'Anybody can partner anybody.'
              }
            >
              <Segmented
                value={mixedOn ? 'mixed' : 'open'}
                onChange={(v) => setMixedOn(v === 'mixed')}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
              />
              {mixedOn ? (
                <div className="flex items-center gap-2">
                  {([0, 1] as const).map((i) => (
                    <input
                      key={i}
                      value={groupNames[i]}
                      onChange={(e) =>
                        setGroupNames((n) =>
                          i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value],
                        )
                      }
                      aria-label={`Name for side ${i + 1}`}
                      autoCapitalize="words"
                      autoComplete="off"
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink focus:border-accent focus:outline-none"
                    />
                  ))}
                </div>
              ) : null}
            </Field>
            ) : null}

            <Field label="Players">
              <SquadPicker selected={roster} onToggle={toggleSquad} disabled={atMax} />
              <PlayerChips
                entries={roster}
                onChange={setRoster}
                disabled={atMax}
                groups={mixed ? groupNames : undefined}
              />
            </Field>
          </>
        )}

        {problem || mixedProblem ? (
          <p className="-mt-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
            {problem ?? mixedProblem}
          </p>
        ) : (
          <p className="-mt-4 text-sm text-ink-faint">
            {unitNoun(effectiveMode, units)} · up to {limits.max}{' '}
            {effectiveMode === 'teams' ? 'teams' : 'players'}.
          </p>
        )}

        {spec.singleCourt ? (
          <Field label="Courts" hint={`${spec.name} is one court and one queue — that is the format.`}>
            <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-dim">
              One court.{' '}
              {units > 4
                ? `${units - 4} ${units - 4 === 1 ? 'person waits' : 'people wait'} between games.`
                : 'Everybody is on it.'}
            </p>
          </Field>
        ) : (
          <Field label="Courts">
            <Stepper value={courts} min={1} max={12} onChange={setCourts} />
            <FeasibilityLine units={units} courts={courts} mode={effectiveMode} />
          </Field>
        )}

        <Field label="Scoring">
          <Segmented
            value={scoreMode}
            onChange={setScoreMode}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'time', label: 'Time' },
            ]}
          />
          {scoreMode === 'points' ? (
            <div className="flex flex-col gap-3">
              <ChoiceChips options={[16, 21, 24, 32]} value={target} onChange={setTarget} />
              <Stepper value={target} min={4} max={99} onChange={setTarget} suffix="pts" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <ChoiceChips options={[10, 15, 20]} value={minutes} onChange={setMinutes} />
              <Stepper value={minutes} min={3} max={60} onChange={setMinutes} suffix="min" />
            </div>
          )}
        </Field>

        <Field
          label="Court booked until"
          hint="Optional. If you set it, the app will tell you whether the rounds fit and let you add or drop some as the night runs on."
        >
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={courtUntil}
              onChange={(e) => setCourtUntil(e.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink focus:border-accent focus:outline-none"
            />
            {courtUntil ? (
              <button
                type="button"
                onClick={() => setCourtUntil('')}
                className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink-faint"
              >
                Clear
              </button>
            ) : null}
          </div>
        </Field>

        <Field
          label="How long"
          action={
            spec.cyclic ? (
              <RoundsInfo perRound={perRound} unitLabel={unitNoun(effectiveMode, cycleSize)} />
            ) : null
          }
          hint={hint}
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="flex flex-col">
              <span className="text-sm text-ink">
                {rounds} {spec.cyclic ? 'round' : 'game'}
                {rounds === 1 ? '' : 's'} to begin
              </span>
              <span className="text-xs text-ink-faint">
                {spec.cyclic
                  ? `${perRound} game${perRound === 1 ? '' : 's'} makes a full cycle for ${unitNoun(effectiveMode, cycleSize)}`
                  : 'Keep adding games for as long as you have the court'}
              </span>
            </span>
            <Stepper value={rounds} min={1} max={12} onChange={setRounds} />
          </div>

          {spec.cyclic ? (
          <details className="rounded-xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm text-ink-dim">
              Change what counts as a round
            </summary>
            <div className="flex flex-col gap-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-dim">Games in a round</span>
                <Stepper
                  value={perRound}
                  min={1}
                  max={31}
                  onChange={(v) => setPerRoundOverride(v)}
                />
              </div>
              <p className="text-xs text-ink-faint">
                {perRoundOverride === null || perRound === autoPerRound
                  ? `A full cycle for ${unitNoun(mode, cycleSize)}: ${
                      mode === 'teams'
                        ? 'every pair plays every other pair once'
                        : 'everyone partners everyone once'
                    }.`
                  : `A full cycle would be ${autoPerRound}. At ${perRound}, a round stops short of the whole group.`}
                {perRoundOverride !== null ? (
                  <button
                    type="button"
                    onClick={() => setPerRoundOverride(null)}
                    className="ml-2 text-accent underline underline-offset-4"
                  >
                    Reset
                  </button>
                ) : null}
              </p>
            </div>
          </details>
          ) : null}
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <Button onClick={() => void start()} disabled={!canStart} className="w-full">
            {saving ? 'Starting…' : 'Start session'}
          </Button>
          {problem || mixedProblem ? (
            <p className="text-center text-sm text-ink-dim">{problem ?? mixedProblem}</p>
          ) : null}
        </div>
      </footer>
    </>
  );
}

function defaultName(): string {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  return `${day} padel`;
}
