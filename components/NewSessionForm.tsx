'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button, ChoiceChips, Field, Segmented, Stepper } from '@/components/ui';
import { PlayerChips } from '@/components/PlayerChips';
import { FeasibilityLine } from '@/components/FeasibilityLine';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { cycleLength, estimateDuration, parsePlayerNames } from '@/lib/format';
import { timeStringToEpoch } from '@/lib/court';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import { createReducer, initialState, type CreateInput } from '@/lib/tournamentReducer';
import type { Format, Scoring } from '@/lib/types';

const FORMATS: { value: Format; label: string; blurb: string }[] = [
  {
    value: 'americano',
    label: 'Americano',
    blurb: 'Everyone partners everyone. Fixed schedule, most social.',
  },
  {
    value: 'mexicano',
    label: 'Mexicano',
    blurb: 'Winners play winners. Re-paired after every round.',
  },
];

export function NewSessionForm() {
  const router = useRouter();
  // "New session, same players" from the finish screen arrives as query params.
  const params = useSearchParams();

  const [name, setName] = useState(defaultName);
  const [format, setFormat] = useState<Format>(
    params.get('format') === 'mexicano' ? 'mexicano' : 'americano',
  );
  const [names, setNames] = useState<string[]>(() => parsePlayerNames(params.get('players') ?? ''));
  const [courts, setCourts] = useState(() => {
    const c = Number(params.get('courts'));
    return Number.isFinite(c) && c >= 1 ? Math.floor(c) : 2;
  });
  const [mode, setMode] = useState<'points' | 'time'>('points');
  const [target, setTarget] = useState(24);
  const [minutes, setMinutes] = useState(15);
  const [rounds, setRounds] = useState(7);
  const [courtUntil, setCourtUntil] = useState('');
  const [roundsTouched, setRoundsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = names.length;
  const cycle = cycleLength(Math.max(count, 4));
  const suggested = Math.min(cycle, 15);
  const effectiveRounds = roundsTouched ? rounds : suggested;

  const scoring: Scoring = useMemo(
    () => (mode === 'points' ? { mode: 'points', target } : { mode: 'time', minutes }),
    [mode, target, minutes],
  );
  const canStart = count >= 4 && !saving;

  const hint = useMemo(() => {
    const duration = estimateDuration(effectiveRounds, scoring);
    if (count < 4) return `About ${duration}.`;
    if (effectiveRounds === cycle && format === 'americano') {
      return `${cycle} rounds = full Americano, everyone partners everyone once. About ${duration}.`;
    }
    if (effectiveRounds > cycle && format === 'americano') {
      return `Rounds ${cycle + 1}+ repeat earlier partnerships. About ${duration}.`;
    }
    return `About ${duration}.`;
  }, [effectiveRounds, cycle, count, format, scoring]);

  async function start() {
    setSaving(true);
    setError(null);
    const input: CreateInput = {
      name,
      format,
      scoring,
      courts,
      plannedRounds: effectiveRounds,
      playerNames: names,
      courtEndsAt: courtUntil ? timeStringToEpoch(courtUntil, Date.now()) : null,
    };
    const reducer = createReducer({ newId, now: Date.now });
    const created = reducer(initialState, { type: 'CREATE', input }).tournament;
    if (!created) {
      setError('Could not build a schedule from those players.');
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
      <header className="flex items-center gap-3 px-5 pt-5">
        <Link href="/sessions" className="text-sm text-ink-dim underline underline-offset-4">
          Sessions
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

        <Field label="Format">
          <div className="grid gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                aria-pressed={format === f.value}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  format === f.value
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`block text-lg font-semibold ${
                    format === f.value ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {f.label}
                </span>
                <span className="mt-1 block text-sm text-ink-dim">{f.blurb}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Players">
          <PlayerChips names={names} onChange={setNames} />
        </Field>

        <Field label="Courts">
          <Stepper value={courts} min={1} max={12} onChange={setCourts} />
          <FeasibilityLine players={count} courts={courts} />
        </Field>

        <Field label="Scoring">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'points', label: 'Points' },
              { value: 'time', label: 'Time' },
            ]}
          />
          {mode === 'points' ? (
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

        <Field label="Rounds" hint={hint}>
          <Stepper
            value={effectiveRounds}
            min={1}
            max={30}
            onChange={(v) => {
              setRoundsTouched(true);
              setRounds(v);
            }}
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-ground/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <Button onClick={() => void start()} disabled={!canStart} className="w-full">
            {saving ? 'Starting…' : 'Start session'}
          </Button>
          {count < 4 ? (
            <p className="text-center text-sm text-ink-dim">
              You need at least 4 players for one court.
            </p>
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
