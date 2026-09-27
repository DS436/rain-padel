'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BottomBar,
  ChoiceChips,
  Group,
  GroupLabel,
  ListRow,
  PageTitle,
  PrimaryButton,
  QuietButton,
  Radio,
  Segmented,
  Stepper,
  SwitchRow,
  TopBar,
} from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { RosterGrid } from '@/components/RosterGrid';
import { TeamBuilder, toTeamInputs, type DraftTeam } from '@/components/TeamBuilder';
import { FeasibilityLine } from '@/components/FeasibilityLine';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { FormatInfo, RoundsInfo, TonightInfo } from '@/components/InfoDot';
import { AvatarStack, colorAt } from '@/components/PlayerAvatar';
import { ArrowRight } from '@/components/icons';
import { estimateDuration, parsePlayerNames, parseTeamPairs } from '@/lib/format';
import { defaultGamesPerRound, roundsToGames } from '@/lib/cycles';
import { limitProblem, unitLimits, unitNoun } from '@/lib/limits';
import { ALL_FORMATS, FORMAT_SPECS, formatSpec, parseFormat } from '@/lib/formats';
import { courtsInPlay } from '@/lib/rounds';
import { timeStringToEpoch } from '@/lib/court';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import { createReducer, initialState, type CreateInput } from '@/lib/tournamentReducer';
import type { Format, MixedDraw, PlayMode, RosterEntry, Scoring, Tournament } from '@/lib/types';

/** The Rounds stepper's ceiling, and the cap on any default fed into it. */
const MAX_ROUNDS = 12;
/**
 * Past four drawn rounds you are not warming up any more, you are running an
 * Americano with a Mexicano label on it.
 */
const MAX_DRAW_ROUNDS = 4;

/**
 * Setting up a night, in two screens.
 *
 * The first screen answers "how are you playing?" — the format as a radio
 * list, then tonight's modifiers and numbers as rows. Every setting the app
 * has ever had is still here: the ones the mock shows sit on the rows, and the
 * rest open a sheet from the row they belong to (Play to, Length, Court booked
 * until, Called, Sides). A previous night can be run back from the top of the
 * same screen, which carries its whole configuration over and jumps straight
 * to the roster.
 *
 * The second screen is the roster, which is the one thing that genuinely
 * changes week to week, with the rest folded into a one-line summary and a
 * "Change" that goes back. The form state is shared; only the rendering is
 * stepped.
 */
type Step = 'format' | 'roster';

/** Which row's sheet is open on the format screen. */
type SheetKind = 'scoring' | 'length' | 'until' | 'name' | 'sides';

export function NewSessionForm() {
  const router = useRouter();
  // "New session, same players" from the finish screen arrives as query params,
  // and lands on the roster: the format was already chosen last time.
  const params = useSearchParams();
  const rerun = params.get('players') !== null || params.get('teams') !== null;

  const [step, setStep] = useState<Step>(rerun ? 'roster' : 'format');
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [name, setName] = useState(defaultName);
  const [format, setFormat] = useState<Format>(parseFormat(params.get('format')));
  const [mode, setMode] = useState<PlayMode>(params.get('mode') === 'teams' ? 'teams' : 'individual');
  const [roster, setRoster] = useState<RosterEntry[]>(() =>
    parsePlayerNames(params.get('players') ?? '').map((n) => ({ name: n })),
  );
  // A mixed draw ("Mixicano") constrains every team to one player from each
  // half. It is a modifier on the format rather than a third format, because
  // both Americano and Mexicano run mixed and only the pairing rule changes.
  const [mixedOn, setMixedOn] = useState(params.get('mixed') === '1');
  const [groupNames, setGroupNames] = useState<[string, string]>(['Men', 'Women']);
  // "New session, same teams" arrives as pairs, so a teams night can be run
  // back as the same teams rather than as eight loose names.
  const [teams, setTeams] = useState<DraftTeam[]>(() =>
    parseTeamPairs(params.get('teams') ?? '').map(([one, two]) => ({
      players: [{ name: one }, { name: two }],
    })),
  );
  // Null means "follow the field": one court up to five people, two from six.
  // A court count carried over from "new session, same players" is a choice
  // somebody already made, so it sticks, and so does touching the stepper.
  const [courtsRaw, setCourts] = useState<number | null>(() => {
    const c = Number(params.get('courts'));
    return Number.isFinite(c) && c >= 1 ? Math.floor(c) : null;
  });
  const [scoreMode, setScoreMode] = useState<'points' | 'time'>('points');
  const [target, setTarget] = useState(16);
  const [minutes, setMinutes] = useState(15);
  // Null means "follow the format's default", which is not the same number for
  // every format — see `rounds` below. Once the stepper is touched the chosen
  // value sticks, including across a change of format.
  const [roundsRaw, setRounds] = useState<number | null>(null);
  const [perRoundOverride, setPerRoundOverride] = useState<number | null>(null);
  /** Mexicano only: opening rounds drawn at random before the table takes over. */
  const [drawRounds, setDrawRounds] = useState(1);
  const [courtUntil, setCourtUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every past night, loaded once: the scored ones are the "Same as before"
  // templates on the first screen, and all of them feed the "3 nights · 6.2
  // per game" line under each squad name on the second.
  const [sessions, setSessions] = useState<Tournament[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStore()
      .listAll()
      .then((all) => {
        if (!cancelled) setSessions(all);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One entry per distinct night, so three Tuesday padels do not fill the list.
  const templates = useMemo(() => {
    const seen = new Set<string>();
    return (sessions ?? [])
      .filter((t) => t.rounds.some((r) => r.matches.some((m) => m.scoreA !== null)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((t) => {
        const key = t.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [sessions]);

  // What the chosen format will actually accept. The Teams and Mixed switches
  // stay on the screen for every format but grey out, with the reason on their
  // second line, when the format cannot take them — the switch keeps its
  // place, so changing format never moves the rows under your thumb.
  const spec = formatSpec(format);
  const effectiveMode: PlayMode = spec.supportsTeams ? mode : 'individual';

  // Fixed pairs have already decided who partners whom, so there is nothing
  // left for a mixed draw to constrain.
  const mixedAllowed = effectiveMode === 'individual' && spec.supportsMixed;
  const mixed: MixedDraw | null = mixedAllowed && mixedOn ? { names: groupNames } : null;
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
  // Counted in people, not units: three teams is six people and gets two courts.
  const people = effectiveMode === 'teams' ? units * 2 : units;
  const courts = spec.singleCourt ? 1 : (courtsRaw ?? (people >= 6 ? 2 : 1));

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

  /**
   * How many slates the night opens with.
   *
   * Americano starts at one round, which is a whole cycle — five games for five
   * players. A ladder has no cycle, so its stepper counts games directly and
   * `perRound` stays 1 to keep the counter honest ("Game 7", not a pretend
   * cycle). Defaulting that stepper to 1 opened a one-game night: you played a
   * single game and the app asked to finish the session.
   *
   * So a ladder opens on the number of games the same field would get from one
   * cycle of a rotation format. Switching format no longer silently changes how
   * long the night is. Capped at the stepper's own maximum, because "31 games"
   * is a cycle length, not an evening.
   *
   * Mexicano is the exception the table carries: it is published as five to
   * eight rounds and that number is a property of the FORMAT, not of the field.
   * Sixteen players is still about seven rounds, where a cycle length would ask
   * for fifteen.
   */
  const ladderGames = Math.min(MAX_ROUNDS, Math.max(4, cycleSize - 1));
  const rounds = roundsRaw ?? (spec.cyclic ? 1 : (spec.defaultRounds ?? ladderGames));
  const totalGames = roundsToGames(rounds, perRound);
  /** "round" for Americano cycles and for Mexicano; "game" for the ladders. */
  const unit = spec.cyclic ? 'round' : spec.roundNoun;

  /**
   * Opening rounds drawn at random. Capped at the length of the night, because
   * "3 random rounds" out of 2 is a Mexicano that never reaches its own format,
   * and pinned to 1 for every format that has no leaderboard to take over.
   */
  const openingDraws = spec.supportsDrawRounds ? Math.min(drawRounds, rounds) : 1;

  const scoring: Scoring = useMemo(
    () => (scoreMode === 'points' ? { mode: 'points', target } : { mode: 'time', minutes }),
    [scoreMode, target, minutes],
  );
  const canStart = problem === null && mixedProblem === null && !saving;

  // When a slate IS the unit the stepper counts, saying "7 games" under
  // "7 rounds to begin" just restates the number in a second word.
  const hintNoun = perRound === 1 ? unit : 'game';
  // "1h 50m" with a space, as the summary line reads it; the lib's compact
  // "1h50m" is for tight table cells.
  const duration = estimateDuration(totalGames, scoring).replace(/h(?=\d)/, 'h ');
  const hint = `${totalGames} ${hintNoun}${totalGames === 1 ? '' : 's'} to start · about ${duration}. Add more ${unit}s while you play — you never have to decide now.`;

  const go = (next: Step) => {
    setStep(next);
    setSheet(null);
    window.scrollTo(0, 0);
  };

  /** Carry a previous night's whole configuration over, roster included. */
  const applyTemplate = (t: Tournament) => {
    setName(t.name);
    setFormat(t.format);
    setMode(t.mode);
    setMixedOn(t.mixed !== null);
    if (t.mixed) setGroupNames(t.mixed.names);
    setCourts(t.courts);
    if (t.scoring.mode === 'points') {
      setScoreMode('points');
      setTarget(t.scoring.target);
    } else {
      setScoreMode('time');
      setMinutes(t.scoring.minutes);
    }
    setRoster(
      t.players.map((p) => ({
        name: p.name,
        ...(p.profileId ? { profileId: p.profileId } : {}),
        ...(p.group === 1 ? { group: 1 as const } : {}),
      })),
    );
    if (t.mode === 'teams') {
      const named = new Map(t.players.map((p) => [p.id, p.name] as const));
      setTeams(
        t.teams.map((tm) => ({
          players: tm.players.map((id) => ({ name: named.get(id) ?? '' })) as DraftTeam['players'],
        })),
      );
    } else {
      setTeams([]);
    }
    go('roster');
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
      drawRounds: openingDraws,
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

  const scoreValue = scoreMode === 'points' ? `${target} points` : `${minutes} minutes`;
  const lengthValue = `${rounds} ${unit}${rounds === 1 ? '' : 's'}`;

  /* ------------------------ step one: the format ------------------------ */

  if (step === 'format') {
    return (
      <>
        <DevStoreBanner />
        <main className="mx-auto flex w-full max-w-lg flex-col pb-32">
          <TopBar back={{ href: '/sessions', label: 'Home' }} middle="Step 1 of 2" />
          <PageTitle>How are you playing?</PageTitle>

          <div className="px-6">
            {/* The fastest Tuesday: last week again, roster and all. Only
                there once something has been played. */}
            {templates.length > 0 ? (
              <>
                <GroupLabel>Same as before</GroupLabel>
                <Group>
                  {templates.map((t) => (
                    <ListRow
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      ariaLabel={`Run ${t.name} again`}
                      lead={
                        <AvatarStack
                          size="sm"
                          people={t.players
                            .slice(0, 3)
                            .map((p, i) => ({ name: p.name, color: colorAt(i) }))}
                          overflow={Math.max(0, t.players.length - 3)}
                        />
                      }
                      title={t.name}
                      sub={`${formatSpec(t.format).name} · ${
                        t.mode === 'teams'
                          ? `${t.teams.length} pair${t.teams.length === 1 ? '' : 's'}`
                          : `${t.players.length} player${t.players.length === 1 ? '' : 's'}`
                      }`}
                      chevron
                    />
                  ))}
                </Group>
              </>
            ) : null}

            <GroupLabel aside={<FormatInfo />}>Format</GroupLabel>
            <div role="radiogroup" aria-label="Format">
              <Group>
                {ALL_FORMATS.map((value) => {
                  const f = FORMAT_SPECS[value];
                  const m: PlayMode = f.supportsTeams ? mode : 'individual';
                  const range = unitLimits(value, m);
                  const on = format === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setFormat(value)}
                      className="flex min-h-[54px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-medium">{f.name}</span>
                        <span className="nums text-xs text-ink-faint">
                          {f.tagline} · {range.min}–{range.max}
                          {m === 'teams' ? ' pairs' : ''}
                        </span>
                      </span>
                      <Radio on={on} />
                    </button>
                  );
                })}
              </Group>
            </div>

            <GroupLabel aside={<TonightInfo />}>Tonight</GroupLabel>
            <Group>
              <SwitchRow
                title="Teams"
                sub={
                  spec.supportsTeams
                    ? 'Keep the same pairs all night'
                    : `${spec.name} rotates individuals`
                }
                on={effectiveMode === 'teams'}
                disabled={!spec.supportsTeams}
                onChange={(v) => setMode(v ? 'teams' : 'individual')}
              />
              <SwitchRow
                title="Mixed"
                sub={
                  mixedAllowed
                    ? 'Every pair takes one from each side'
                    : effectiveMode === 'teams'
                      ? 'Fixed pairs already decide who partners whom'
                      : `${spec.name} has no mixed draw`
                }
                on={mixed !== null}
                disabled={!mixedAllowed}
                onChange={setMixedOn}
              />
              {mixed ? (
                <ListRow
                  title="Sides"
                  minH="min-h-12"
                  trailing={<RowValue>{`${groupNames[0]} / ${groupNames[1]}`}</RowValue>}
                  chevron
                  onClick={() => setSheet('sides')}
                />
              ) : null}
              {spec.singleCourt ? (
                <ListRow
                  title="Courts"
                  sub={`${spec.name} is one court and one queue — that is the format`}
                  minH="min-h-[50px]"
                  trailing={<span className="nums pr-3 text-[17px] font-semibold">1</span>}
                />
              ) : (
                <ListRow
                  title="Courts"
                  // Only once somebody is in: before that the sentence is just
                  // "add four more players", which the next screen says better.
                  sub={
                    units > 0 ? (
                      <FeasibilityLine units={units} courts={courts} mode={effectiveMode} />
                    ) : undefined
                  }
                  minH="min-h-[50px]"
                  className="!pr-2.5"
                  trailing={
                    <Stepper value={courts} min={1} max={12} onChange={setCourts} label="courts" />
                  }
                />
              )}
              <ListRow
                title={scoreMode === 'points' ? 'Play to' : 'Play for'}
                minH="min-h-12"
                trailing={<RowValue>{scoreValue}</RowValue>}
                chevron
                onClick={() => setSheet('scoring')}
              />
              <ListRow
                title="Length"
                minH="min-h-12"
                trailing={<RowValue>{lengthValue}</RowValue>}
                chevron
                onClick={() => setSheet('length')}
              />
              <ListRow
                title="Court booked until"
                minH="min-h-12"
                trailing={<RowValue faint={!courtUntil}>{courtUntil || 'Not set'}</RowValue>}
                chevron
                onClick={() => setSheet('until')}
              />
              <ListRow
                title="Called"
                minH="min-h-12"
                trailing={<RowValue>{name.trim() || 'No name'}</RowValue>}
                chevron
                onClick={() => setSheet('name')}
              />
            </Group>
          </div>
        </main>

        <BottomBar tone="ground">
          <PrimaryButton onClick={() => go('roster')}>
            Next · who’s playing
            <ArrowRight />
          </PrimaryButton>
        </BottomBar>

        {sheet === 'scoring' ? (
          <Sheet
            title={scoreMode === 'points' ? 'Play to' : 'Play for'}
            description={
              scoreMode === 'points'
                ? 'Every point a pair wins goes on the table, so a close loss still counts.'
                : 'Each game runs on the clock, and the score when time is up is the result.'
            }
            onClose={() => setSheet(null)}
            showClose={false}
          >
            <Segmented
              value={scoreMode}
              onChange={setScoreMode}
              options={[
                { value: 'points', label: 'Points' },
                { value: 'time', label: 'Time' },
              ]}
            />
            <div className="mt-5">
              <ChoiceChips
                options={scoreMode === 'points' ? [16, 21, 24, 32] : [10, 15, 20]}
                value={scoreMode === 'points' ? target : minutes}
                onChange={scoreMode === 'points' ? setTarget : setMinutes}
                suffix={scoreMode === 'points' ? undefined : 'min'}
              />
            </div>
            <div className="mt-4 flex min-h-14 items-center justify-between gap-3 border-t border-line pt-2">
              <span className="text-[15px] text-ink-dim">
                {scoreMode === 'points' ? 'Or any target' : 'Or any length'}
              </span>
              {scoreMode === 'points' ? (
                <Stepper value={target} min={4} max={99} onChange={setTarget} label="points" />
              ) : (
                <Stepper
                  value={minutes}
                  min={3}
                  max={60}
                  onChange={setMinutes}
                  label="minutes"
                  suffix="min"
                />
              )}
            </div>
            <PrimaryButton className="mt-6" onClick={() => setSheet(null)}>
              Done
            </PrimaryButton>
          </Sheet>
        ) : null}

        {sheet === 'length' ? (
          <Sheet title="How long" description={hint} onClose={() => setSheet(null)} showClose={false}>
            <div className="divide-y divide-line">
              <SheetRow
                title={`${rounds} ${unit}${rounds === 1 ? '' : 's'} to begin`}
                info={
                  spec.cyclic ? (
                    <RoundsInfo
                      perRound={perRound}
                      unitLabel={unitNoun(effectiveMode, cycleSize)}
                    />
                  ) : null
                }
                sub={
                  spec.cyclic
                    ? `${perRound} game${perRound === 1 ? '' : 's'} makes a full cycle`
                    : unit === 'round'
                      ? 'Everyone is re-ranked after each one'
                      : 'Keep adding games for as long as you have the court'
                }
                control={
                  <Stepper
                    value={rounds}
                    min={1}
                    max={MAX_ROUNDS}
                    onChange={setRounds}
                    label={`${unit}s`}
                  />
                }
              />

              {/* After one round everybody has exactly one result, so the table
                  that then dictates every court is largely a record of who drew
                  the strong partner. Playing two or three drawn rounds first is
                  how organisers of mixed-ability groups get a table worth
                  ranking on — so it is a setting, not a fixed 1. */}
              {spec.supportsDrawRounds ? (
                <SheetRow
                  title={
                    openingDraws === 1
                      ? 'First round drawn at random'
                      : `First ${openingDraws} rounds drawn at random`
                  }
                  sub={`The table takes over from round ${openingDraws + 1}`}
                  control={
                    <Stepper
                      value={openingDraws}
                      min={1}
                      max={Math.min(MAX_DRAW_ROUNDS, rounds)}
                      onChange={setDrawRounds}
                      label="drawn rounds"
                    />
                  }
                />
              ) : null}

              {spec.cyclic ? (
                <SheetRow
                  title="Games in a round"
                  sub={
                    <>
                      {perRoundOverride === null || perRound === autoPerRound
                        ? `A full cycle for ${unitNoun(effectiveMode, cycleSize)}: ${
                            effectiveMode === 'teams'
                              ? 'every pair plays every other pair once'
                              : 'everyone partners everyone once'
                          }.`
                        : `A full cycle would be ${autoPerRound}. At ${perRound}, a round stops short of the whole group.`}
                      {perRoundOverride !== null ? (
                        <button
                          type="button"
                          onClick={() => setPerRoundOverride(null)}
                          className="-my-3 ml-1.5 inline-flex min-h-11 items-center font-semibold text-accent-text"
                        >
                          Reset
                        </button>
                      ) : null}
                    </>
                  }
                  control={
                    <Stepper
                      value={perRound}
                      min={1}
                      max={31}
                      onChange={(v) => setPerRoundOverride(v)}
                      label="games"
                    />
                  }
                />
              ) : null}
            </div>
            <PrimaryButton className="mt-6" onClick={() => setSheet(null)}>
              Done
            </PrimaryButton>
          </Sheet>
        ) : null}

        {sheet === 'until' ? (
          <Sheet
            title="Court booked until"
            description="When the booking ends. The app keeps count of how many more games fit before then."
            onClose={() => setSheet(null)}
            showClose={false}
          >
            <input
              type="time"
              value={courtUntil}
              onChange={(e) => setCourtUntil(e.target.value)}
              aria-label="Court booked until"
              className="nums h-14 w-full rounded-[14px] bg-surface-2 px-4 text-[22px] font-semibold text-ink focus:outline-2 focus:outline-accent"
            />
            <PrimaryButton className="mt-6" onClick={() => setSheet(null)}>
              Done
            </PrimaryButton>
            {courtUntil ? (
              <QuietButton
                className="mt-1"
                onClick={() => {
                  setCourtUntil('');
                  setSheet(null);
                }}
              >
                No end time
              </QuietButton>
            ) : null}
          </Sheet>
        ) : null}

        {sheet === 'name' ? (
          <Sheet
            title="Called"
            description="What the night is saved as — and what “Same as before” offers next week."
            onClose={() => setSheet(null)}
            showClose={false}
          >
            <TextInput
              value={name}
              onChange={setName}
              label="Session name"
              onEnter={() => setSheet(null)}
            />
            <PrimaryButton className="mt-6" onClick={() => setSheet(null)}>
              Done
            </PrimaryButton>
          </Sheet>
        ) : null}

        {sheet === 'sides' ? (
          <Sheet
            title="The two sides"
            description="Men and Women, Stronger and Learning, A and B — the app only cares that a pair never takes two from the same side."
            onClose={() => setSheet(null)}
            showClose={false}
          >
            <div className="flex flex-col gap-2">
              {([0, 1] as const).map((i) => (
                <TextInput
                  key={i}
                  value={groupNames[i]}
                  onChange={(v) =>
                    setGroupNames((n) => (i === 0 ? [v, n[1]] : [n[0], v]))
                  }
                  label={`Name for side ${i + 1}`}
                  placeholder={i === 0 ? 'Side A' : 'Side B'}
                />
              ))}
            </div>
            <PrimaryButton className="mt-6" onClick={() => setSheet(null)}>
              Done
            </PrimaryButton>
          </Sheet>
        ) : null}
      </>
    );
  }

  /* ------------------------ step two: the roster ------------------------ */

  const teamsMode = effectiveMode === 'teams';
  // Seats per game: a court takes four players, or two pairs — and in a mixed
  // draw two from EACH side, so the shorter side can leave a court empty.
  const courtsUsed = teamsMode
    ? Math.min(Math.floor(units / 2), courts)
    : mixed
      ? Math.min(Math.floor(split[0] / 2), Math.floor(split[1] / 2), courts)
      : courtsInPlay(units, courts);
  const resting = units - courtsUsed * (teamsMode ? 2 : 4);
  const count = teamsMode
    ? `${units} pair${units === 1 ? '' : 's'}`
    : `${units} player${units === 1 ? '' : 's'}`;
  const rest =
    resting === 0
      ? teamsMode
        ? 'every pair plays every game'
        : 'everyone plays every game'
      : teamsMode
        ? `${resting} pair${resting === 1 ? ' sits' : 's sit'} out each game`
        : `${resting} sit${resting === 1 ? 's' : ''} out each game`;
  const sub =
    units === 0
      ? teamsMode
        ? 'Add the pairs as they arrive'
        : 'Tap the regulars, or type anyone new'
      : courtsUsed === 0
        ? count
        : `${count} · ${rest}${
            courtsUsed < courts ? ` · ${courtsUsed} court${courtsUsed === 1 ? '' : 's'} in use` : ''
          }`;

  const summary = [
    spec.name,
    `${courts} court${courts === 1 ? '' : 's'}`,
    scoreMode === 'points' ? `${target} pts` : `${minutes} min`,
    `~${duration}`,
  ].join(' · ');
  const warning = problem ?? mixedProblem;

  return (
    <>
      <DevStoreBanner />
      <main
        className={`mx-auto flex w-full max-w-lg flex-col ${warning ? 'pb-56' : 'pb-48'}`}
      >
        <TopBar back={{ onClick: () => go('format'), label: 'Back to the format' }} middle="Step 2 of 2" />
        <PageTitle sub={<span className="nums">{sub}</span>}>
          {teamsMode ? 'Who’s pairing up?' : 'Who turned up?'}
        </PageTitle>

        <div className="px-6">
          {teamsMode ? (
            <TeamBuilder teams={teams} onChange={setTeams} sessions={sessions} />
          ) : (
            <RosterGrid
              selected={roster}
              onChange={setRoster}
              disabled={atMax}
              groups={mixed ? groupNames : undefined}
              sessions={sessions}
            />
          )}

          {error ? <p className="mt-4 px-1 text-[13px] text-danger">{error}</p> : null}
        </div>
      </main>

      <BottomBar>
        {/* Next to the button it explains: a dead "First serve" with the
            reason a page away reads as a broken app. */}
        {warning ? <p className="mb-2 text-[13px] leading-snug text-warn">{warning}</p> : null}
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <span className="nums min-w-0 truncate text-ink-dim">{summary}</span>
          <button
            type="button"
            onClick={() => go('format')}
            className="-my-3 inline-flex min-h-11 flex-none items-center font-semibold text-accent-text active:opacity-60"
          >
            Change
          </button>
        </div>
        <PrimaryButton onClick={() => void start()} disabled={!canStart}>
          {saving ? (
            'Starting…'
          ) : (
            <>
              First serve
              <ArrowRight />
            </>
          )}
        </PrimaryButton>
      </BottomBar>
    </>
  );
}

/** The grey value on the right of a settings row — "16 points", "21:30". */
function RowValue({ children, faint = false }: { children: ReactNode; faint?: boolean }) {
  return (
    <span
      className={`nums max-w-[50%] flex-none truncate text-[15px] ${
        faint ? 'text-ink-faint' : 'text-ink-dim'
      }`}
    >
      {children}
    </span>
  );
}

/** A row inside a sheet: what it is, a line of why, and a stepper. */
function SheetRow({
  title,
  sub,
  info,
  control,
}: {
  title: string;
  sub?: ReactNode;
  info?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 py-2">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[15px] font-medium">
          {title}
          {info}
        </span>
        {sub ? <span className="text-xs leading-snug text-ink-faint">{sub}</span> : null}
      </span>
      {control}
    </div>
  );
}

/** A plain text field on a sheet. 16px, so iOS does not zoom when it focuses. */
function TextInput({
  value,
  onChange,
  label,
  placeholder,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  onEnter?: () => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      aria-label={label}
      placeholder={placeholder}
      autoCapitalize="words"
      autoComplete="off"
      enterKeyHint="done"
      className="h-12 w-full rounded-[14px] bg-surface-2 px-4 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-accent"
    />
  );
}

function defaultName(): string {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  return `${day} padel`;
}
