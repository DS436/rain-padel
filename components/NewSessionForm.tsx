'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChoiceChips, Meta, Rail, SectionLabel, Segmented, Stepper } from '@/components/ui';
import { PlayerChips } from '@/components/PlayerChips';
import { RosterGrid } from '@/components/RosterGrid';
import { TeamBuilder, toTeamInputs, type DraftTeam } from '@/components/TeamBuilder';
import { FeasibilityLine } from '@/components/FeasibilityLine';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { DrawInfo, FormatInfo, ModeInfo, RoundsInfo } from '@/components/InfoDot';
import { AvatarStack } from '@/components/PlayerAvatar';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Clock, Users } from '@/components/icons';
import { estimateDuration, parsePlayerNames, parseTeamPairs, scoringLabel } from '@/lib/format';
import { defaultGamesPerRound, roundsToGames } from '@/lib/cycles';
import { limitProblem, unitLimits, unitNoun } from '@/lib/limits';
import { ALL_FORMATS, FORMAT_SPECS, formatSpec, parseFormat } from '@/lib/formats';
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
 * The redesign splits what used to be one long form. The first screen is the
 * only question most Tuesdays need — "the same as last week?" — and answering
 * it yes carries the whole configuration over. The second screen is the roster,
 * which is the one thing that genuinely changes week to week, with every other
 * setting folded behind "Change". The form state is shared; only the rendering
 * is stepped.
 */
type Step = 'start' | 'roster';

export function NewSessionForm() {
  const router = useRouter();
  // "New session, same players" from the finish screen arrives as query params.
  const params = useSearchParams();
  const rerun = params.get('players') !== null || params.get('teams') !== null;

  const [step, setStep] = useState<Step>(rerun ? 'roster' : 'start');
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

  /** Open on the roster screen: the advanced panel, and the type-a-name field. */
  const [advOpen, setAdvOpen] = useState(false);
  const [typing, setTyping] = useState(false);

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
  const hint = `${totalGames} ${hintNoun}${totalGames === 1 ? '' : 's'} to start · about ${estimateDuration(totalGames, scoring)}. Add more ${unit}s while you play — you never have to decide now.`;

  const toggleSquad = (entry: RosterEntry) => {
    setRoster((current) =>
      current.some((e) => e.profileId === entry.profileId)
        ? current.filter((e) => e.profileId !== entry.profileId)
        : [...current, entry],
    );
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
    setStep('roster');
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

  if (step === 'start') {
    return (
      <StartStep
        onFresh={() => {
          setRoster([]);
          setTeams([]);
          setStep('roster');
        }}
        onTemplate={applyTemplate}
      />
    );
  }

  /* ---------------------------- the roster ---------------------------- */

  const summaryChips = [
    spec.name,
    spec.singleCourt ? '1 court' : `${courts} court${courts === 1 ? '' : 's'}`,
    scoringLabel(scoring).replace('First to ', '') + (scoreMode === 'points' ? ' pts' : ''),
    `${totalGames} ${hintNoun}${totalGames === 1 ? '' : 's'}`,
  ];

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col pb-40 pt-1">
        <div className="px-5">
          <button
            type="button"
            onClick={() => setStep('start')}
            className="-ml-0.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-dim"
          >
            <ArrowLeft size="sm" />
            Back
          </button>

          <div className="mb-3.5 mt-1.5 flex items-end justify-between gap-3">
            <h1 className="disp text-[26px] font-bold tracking-[-0.025em]">
              {effectiveMode === 'teams' ? 'Who is pairing up' : 'Who turned up'}
            </h1>
            <span className="nums disp text-[26px] font-bold text-accent">{units}</span>
          </div>

          {effectiveMode === 'teams' ? (
            <TeamBuilder teams={teams} onChange={setTeams} />
          ) : (
            <>
              <RosterGrid
                selected={roster}
                onToggle={toggleSquad}
                onRemove={(i) => setRoster((r) => r.filter((_, j) => j !== i))}
                onAdd={() => setTyping((t) => !t)}
                disabled={atMax}
              />
              {typing ? (
                <div className="pt-3">
                  <PlayerChips
                    entries={roster}
                    onChange={setRoster}
                    disabled={atMax}
                    groups={mixed ? groupNames : undefined}
                    /* the grid above already lists everyone — a mixed draw is
                       the exception, where the chips carry the side toggles */
                    showList={mixed !== null}
                  />
                </div>
              ) : null}
            </>
          )}

          {problem || mixedProblem ? (
            <p className="mt-3.5 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn">
              {problem ?? mixedProblem}
            </p>
          ) : null}

          {/* ----------------------- Suggested ----------------------- */}
          <div className="mt-[18px] border-t border-line-soft pt-3.5">
            <button
              type="button"
              onClick={() => setAdvOpen((o) => !o)}
              aria-expanded={advOpen}
              className="flex min-h-11 w-full items-center gap-2.5 text-left"
            >
              <SectionLabel className="flex-none text-[10px] tracking-[0.16em]">
                Suggested
              </SectionLabel>
              <span className="flex flex-1 flex-wrap gap-1.5">
                {summaryChips.map((c) => (
                  <span
                    key={c}
                    className="nums rounded-[7px] bg-surface-2 px-2 py-[3px] font-mono text-[10px] font-medium text-ink-dim"
                  >
                    {c}
                  </span>
                ))}
              </span>
              <span className="flex flex-none items-center gap-1 text-[11.5px] font-semibold text-accent">
                {advOpen ? 'Hide' : 'Change'}
                <ChevronDown size="sm" className={advOpen ? 'rotate-180' : ''} />
              </span>
            </button>

            {advOpen ? (
              <Advanced
                {...{
                  name,
                  setName,
                  format,
                  setFormat,
                  spec,
                  mode,
                  setMode,
                  effectiveMode,
                  mixedOn,
                  setMixedOn,
                  groupNames,
                  setGroupNames,
                  courts,
                  setCourts,
                  units,
                  scoreMode,
                  setScoreMode,
                  target,
                  setTarget,
                  minutes,
                  setMinutes,
                  courtUntil,
                  setCourtUntil,
                  rounds,
                  setRounds,
                  unit,
                  perRound,
                  autoPerRound,
                  perRoundOverride,
                  setPerRoundOverride,
                  openingDraws,
                  setDrawRounds,
                  cycleSize,
                  hint,
                }}
              />
            ) : null}
          </div>

          {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ground/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-lg">
          <button
            type="button"
            onClick={() => void start()}
            disabled={!canStart}
            className="flex min-h-[52px] w-full items-center justify-between gap-2.5 rounded-[15px] bg-accent px-[18px] text-accent-ink transition-opacity active:opacity-80 disabled:bg-surface-2 disabled:text-ink-faint"
          >
            <span className="disp text-base font-bold">{saving ? 'Starting…' : 'First serve'}</span>
            <span className="inline-flex items-center gap-2">
              <span className="nums font-mono text-[11px] font-medium opacity-65">
                {units} {effectiveMode === 'teams' ? 'teams' : 'players'} · {courts} court
                {courts === 1 ? '' : 's'}
              </span>
              <ArrowRight size="sm" />
            </span>
          </button>
          {problem || mixedProblem ? (
            <p className="pt-1.5 text-center text-[12px] text-ink-dim">
              {problem ?? mixedProblem}
            </p>
          ) : null}
        </div>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Step one — "the same as last week?"
 * ------------------------------------------------------------------ */

function StartStep({
  onFresh,
  onTemplate,
}: {
  onFresh: () => void;
  onTemplate: (t: Tournament) => void;
}) {
  const [past, setPast] = useState<Tournament[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStore()
      .listAll()
      .then((all) => {
        if (cancelled) return;
        setPast(
          all
            .filter((t) => t.rounds.some((r) => r.matches.some((m) => m.scoreA !== null)))
            .sort((a, b) => b.createdAt - a.createdAt),
        );
      })
      .catch(() => {
        if (!cancelled) setPast([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const last = past?.[0] ?? null;
  // One entry per distinct night, so three Tuesday padels do not fill the list.
  const presets = useMemo(() => {
    const seen = new Set<string>();
    return (past ?? [])
      .slice(1)
      .filter((t) => {
        const key = t.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [past]);

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col px-5 pb-10 pt-1">
        <Link
          href="/sessions"
          className="-ml-0.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-dim"
        >
          <ArrowLeft size="sm" />
          Home
        </Link>
        <h1 className="disp mb-4 mt-1.5 text-[27px] font-bold tracking-[-0.025em]">
          Start a night
        </h1>

        {last ? (
          <button
            type="button"
            onClick={() => onTemplate(last)}
            className="mb-2.5 block w-full rounded-[20px] border border-accent bg-gradient-to-b from-accent/[0.13] to-accent/[0.03] p-4 text-left"
          >
            <span className="flex items-center gap-1.5">
              <Clock size="sm" className="text-accent" />
              <span className="disp text-[9.5px] font-bold uppercase tracking-[0.18em] text-accent">
                Last time
              </span>
            </span>
            <span className="disp mt-[7px] block text-[21px] font-bold tracking-[-0.02em]">
              Same again
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5">
              {[
                formatSpec(last.format).name,
                `${last.courts} court${last.courts === 1 ? '' : 's'}`,
                last.scoring.mode === 'points'
                  ? `${last.scoring.target} pts`
                  : `${last.scoring.minutes} min`,
              ].map((c) => (
                <span
                  key={c}
                  className="nums rounded-[7px] bg-ground/45 px-2.5 py-[3px] font-mono text-[10px] font-medium text-ink-dim"
                >
                  {c}
                </span>
              ))}
            </span>
            <span className="mt-3 flex items-center">
              <AvatarStack
                people={last.players.slice(0, 6).map((p) => ({ name: p.name, color: undefined }))}
                ring="var(--color-surface)"
                overflow={Math.max(0, last.players.length - 6)}
              />
              <span className="disp ml-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-accent">
                Confirm
                <ArrowRight size="sm" />
              </span>
            </span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onFresh}
          className="mb-4 flex min-h-[60px] w-full items-center gap-2.5 rounded-[20px] border border-line bg-surface p-4 text-left"
        >
          <Users className="text-ink-faint" />
          <span className="disp flex-1 text-[17px] font-bold tracking-[-0.02em]">Start fresh</span>
          <ChevronRight size="sm" className="text-ink-faint" />
        </button>

        {presets.length > 0 ? (
          <>
            <SectionLabel className="mb-1 text-[10px]">Run one back</SectionLabel>
            {presets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTemplate(t)}
                className="flex min-h-12 w-full items-center gap-2.5 border-t border-line-soft text-left"
              >
                <span className="flex-1 truncate text-[13px] font-medium">{t.name}</span>
                <span className="nums flex-none rounded-md bg-surface-2 px-2 py-[3px] font-mono text-[9.5px] font-medium text-ink-faint">
                  {formatSpec(t.format).name} · {t.players.length}
                </span>
                <ChevronRight size="sm" className="text-ink-faint" />
              </button>
            ))}
          </>
        ) : null}

        {past !== null && past.length === 0 ? (
          <p className="pt-1 text-[13px] leading-relaxed text-ink-faint">
            Nothing to run back yet — your first night starts from scratch.
          </p>
        ) : null}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Everything behind "Change".
 *
 * The mock shows four of these controls; the rest are the ones the app
 * already had and the redesign gives no home to. They keep the same shapes —
 * a rail of cards, two steppers, a row of chips, then the rows that need a
 * sentence of explanation.
 * ------------------------------------------------------------------ */

type AdvancedProps = {
  name: string;
  setName: (v: string) => void;
  format: Format;
  setFormat: (f: Format) => void;
  spec: ReturnType<typeof formatSpec>;
  mode: PlayMode;
  setMode: (m: PlayMode) => void;
  effectiveMode: PlayMode;
  mixedOn: boolean;
  setMixedOn: (v: boolean) => void;
  groupNames: [string, string];
  setGroupNames: (f: (n: [string, string]) => [string, string]) => void;
  courts: number;
  setCourts: (v: number) => void;
  units: number;
  scoreMode: 'points' | 'time';
  setScoreMode: (m: 'points' | 'time') => void;
  target: number;
  setTarget: (v: number) => void;
  minutes: number;
  setMinutes: (v: number) => void;
  courtUntil: string;
  setCourtUntil: (v: string) => void;
  rounds: number;
  setRounds: (v: number) => void;
  unit: string;
  perRound: number;
  autoPerRound: number;
  perRoundOverride: number | null;
  setPerRoundOverride: (v: number | null) => void;
  openingDraws: number;
  setDrawRounds: (v: number) => void;
  cycleSize: number;
  hint: string;
};

function Advanced(p: AdvancedProps) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Format */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2">
          <SectionLabel className="text-[9.5px] tracking-[0.16em]">Format</SectionLabel>
          <FormatInfo />
        </span>
        <Rail>
          {ALL_FORMATS.map((value) => {
            const f = FORMAT_SPECS[value];
            const on = p.format === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => p.setFormat(value)}
                aria-pressed={on}
                className={`min-h-[52px] min-w-[116px] flex-none rounded-xl border px-3 py-2.5 text-left ${
                  on ? 'border-accent bg-accent/[0.09]' : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`disp block text-[13px] font-bold ${on ? 'text-accent' : 'text-ink'}`}
                >
                  {f.name}
                </span>
                <Meta className="mt-0.5 block">{f.tagline}</Meta>
              </button>
            );
          })}
        </Rail>
      </div>

      {/* Courts and target */}
      <div className="flex gap-2">
        {!p.spec.singleCourt ? (
          <div className="flex-1">
            <SectionLabel className="mb-1.5 text-[9.5px] tracking-[0.16em]">Courts</SectionLabel>
            <Stepper value={p.courts} min={1} max={12} onChange={p.setCourts} label="courts" />
          </div>
        ) : null}
        <div className="flex-1">
          <SectionLabel className="mb-1.5 text-[9.5px] tracking-[0.16em]">
            {p.scoreMode === 'points' ? 'Play to' : 'Minutes'}
          </SectionLabel>
          {p.scoreMode === 'points' ? (
            <Stepper value={p.target} min={4} max={99} onChange={p.setTarget} label="target" />
          ) : (
            <Stepper value={p.minutes} min={3} max={60} onChange={p.setMinutes} label="minutes" />
          )}
        </div>
      </div>

      {!p.spec.singleCourt ? (
        <FeasibilityLine units={p.units} courts={p.courts} mode={p.effectiveMode} />
      ) : (
        <p className="text-[12px] text-ink-faint">
          {p.spec.name} is one court and one queue — that is the format.
        </p>
      )}

      <ChoiceChips
        options={p.scoreMode === 'points' ? [16, 21, 24, 32] : [10, 15, 20]}
        value={p.scoreMode === 'points' ? p.target : p.minutes}
        onChange={p.scoreMode === 'points' ? p.setTarget : p.setMinutes}
      />

      {/* The mock's chip row, as real switches */}
      <div className="flex flex-col gap-2.5">
        {p.spec.supportsTeams ? (
          <Row label="Playing as" info={<ModeInfo />}>
            <Segmented
              inline
              value={p.mode}
              onChange={p.setMode}
              options={[
                { value: 'individual', label: 'Individuals' },
                { value: 'teams', label: 'Teams' },
              ]}
            />
          </Row>
        ) : null}

        {p.spec.supportsMixed && p.effectiveMode === 'individual' ? (
          <Row label="Draw" info={<DrawInfo />}>
            <Segmented
              inline
              value={p.mixedOn ? 'mixed' : 'open'}
              onChange={(v) => p.setMixedOn(v === 'mixed')}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'mixed', label: 'Mixed' },
              ]}
            />
          </Row>
        ) : null}

        {p.mixedOn && p.spec.supportsMixed && p.effectiveMode === 'individual' ? (
          <div className="flex items-center gap-2">
            {([0, 1] as const).map((i) => (
              <input
                key={i}
                value={p.groupNames[i]}
                onChange={(e) =>
                  p.setGroupNames((n) =>
                    i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value],
                  )
                }
                aria-label={`Name for side ${i + 1}`}
                autoCapitalize="words"
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink focus:border-accent focus:outline-none"
              />
            ))}
          </div>
        ) : null}

        <Row label="Scoring">
          <Segmented
            inline
            value={p.scoreMode}
            onChange={p.setScoreMode}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'time', label: 'Time' },
            ]}
          />
        </Row>

        <Row label="Ends at">
          <span className="flex items-center gap-2">
            <input
              type="time"
              value={p.courtUntil}
              onChange={(e) => p.setCourtUntil(e.target.value)}
              aria-label="Court booked until"
              className="nums min-h-11 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink focus:border-accent focus:outline-none"
            />
            {p.courtUntil ? (
              <button
                type="button"
                onClick={() => p.setCourtUntil('')}
                className="min-h-11 px-1 text-[11.5px] font-medium text-ink-faint"
              >
                Clear
              </button>
            ) : null}
          </span>
        </Row>
      </div>

      {/* Name */}
      <div>
        <SectionLabel className="mb-1.5 text-[9.5px] tracking-[0.16em]">Called</SectionLabel>
        <input
          value={p.name}
          onChange={(e) => p.setName(e.target.value)}
          aria-label="Session name"
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] focus:border-accent focus:outline-none"
        />
      </div>

      {/* How long */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2">
          <SectionLabel className="text-[9.5px] tracking-[0.16em]">How long</SectionLabel>
          {p.spec.cyclic ? (
            <RoundsInfo
              perRound={p.perRound}
              unitLabel={unitNoun(p.effectiveMode, p.cycleSize)}
            />
          ) : null}
        </span>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px]">
              {p.rounds} {p.unit}
              {p.rounds === 1 ? '' : 's'} to begin
            </span>
            <Meta>
              {p.spec.cyclic
                ? `${p.perRound} game${p.perRound === 1 ? '' : 's'} makes a full cycle`
                : p.unit === 'round'
                  ? 'Everyone is re-ranked after each one'
                  : 'Keep adding games for as long as you have the court'}
            </Meta>
          </span>
          <Stepper
            value={p.rounds}
            min={1}
            max={MAX_ROUNDS}
            onChange={p.setRounds}
            label={`${p.unit}s`}
          />
        </div>

        {/* After one round everybody has exactly one result, so the table
            that then dictates every court is largely a record of who drew the
            strong partner. Playing two or three drawn rounds first is how
            organisers of mixed-ability groups get a table worth ranking on —
            so it is a setting, not a fixed 1. */}
        {p.spec.supportsDrawRounds ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px]">
                {p.openingDraws === 1
                  ? 'First round drawn at random'
                  : `First ${p.openingDraws} rounds drawn at random`}
              </span>
              <Meta>
                {p.openingDraws === 1
                  ? 'The table takes over from round 2'
                  : `The table takes over from round ${p.openingDraws + 1}`}
              </Meta>
            </span>
            <Stepper
              value={p.openingDraws}
              min={1}
              max={Math.min(MAX_DRAW_ROUNDS, p.rounds)}
              onChange={p.setDrawRounds}
              label="drawn rounds"
            />
          </div>
        ) : null}

        {p.spec.cyclic ? (
          <details className="rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] text-ink-dim">
              Change what counts as a round
            </summary>
            <div className="flex flex-col gap-2 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-dim">Games in a round</span>
                <Stepper
                  value={p.perRound}
                  min={1}
                  max={31}
                  onChange={(v) => p.setPerRoundOverride(v)}
                  label="games"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-ink-faint">
                {p.perRoundOverride === null || p.perRound === p.autoPerRound
                  ? `A full cycle for ${unitNoun(p.mode, p.cycleSize)}: ${
                      p.mode === 'teams'
                        ? 'every pair plays every other pair once'
                        : 'everyone partners everyone once'
                    }.`
                  : `A full cycle would be ${p.autoPerRound}. At ${p.perRound}, a round stops short of the whole group.`}
                {p.perRoundOverride !== null ? (
                  <button
                    type="button"
                    onClick={() => p.setPerRoundOverride(null)}
                    className="ml-2 text-accent underline underline-offset-4"
                  >
                    Reset
                  </button>
                ) : null}
              </p>
            </div>
          </details>
        ) : null}

        <p className="text-[11px] leading-relaxed text-ink-faint">{p.hint}</p>
      </div>
    </div>
  );
}

function Row({
  label,
  info,
  children,
}: {
  label: string;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">
        <SectionLabel className="text-[9.5px] tracking-[0.16em]">{label}</SectionLabel>
        {info}
      </span>
      {children}
    </div>
  );
}

function defaultName(): string {
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  return `${day} padel`;
}
