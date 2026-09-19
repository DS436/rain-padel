'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import { careerStats, rankSquad } from '@/lib/players';
import { getPlayerStore } from '@/lib/store/playerStore';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import { Button, Meta, Sparkline } from '@/components/ui';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ArrowLeft, CrownIcon, Plus } from '@/components/icons';
import { Sheet } from '@/components/Sheet';

/**
 * What the squad is ranked on.
 *
 * The mock offers four; these are the four the app can actually answer from
 * stored sessions. There is no pairs record behind a "Pairs" tab, and a tab
 * that sorts by nothing is worse than one fewer tab.
 */
const SORTS = [
  { key: 'average', label: 'Per game' },
  { key: 'sessions', label: 'Nights' },
  { key: 'titles', label: 'Wins' },
  { key: 'points', label: 'Points' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

/** The number on the right of a row — whichever column is sorting the list. */
function headline(c: CareerStats, sort: SortKey): string {
  switch (sort) {
    case 'sessions':
      return String(c.sessions);
    case 'titles':
      return String(c.titles);
    case 'points':
      return String(c.points);
    default:
      return c.average.toFixed(1);
  }
}

/** Points per game for the last few nights, oldest first — `form` is newest first. */
function nightForm(c: CareerStats): number[] {
  return c.form
    .slice(0, 6)
    .map((f) => (f.games > 0 ? f.points / f.games : 0))
    .reverse();
}

/**
 * The squad — one saved list of people, shared by every session.
 *
 * This is the part that makes a season out of a set of nights. A name typed
 * into one session dies with it; a saved player accumulates, so "who is
 * actually the best of us" stops being an argument and becomes a column.
 *
 * Career numbers are folded out of the sessions themselves rather than kept in
 * a counter, for the same reason standings are: a score corrected three weeks
 * later has to move the record, and derived-every-time is the only version of
 * that which cannot go stale.
 */
export function PlayersView() {
  const [squad, setSquad] = useState<PlayerProfile[] | null>(null);
  const [sessions, setSessions] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('average');
  const [adding, setAdding] = useState(false);
  /** bumping this re-runs the load effect; avoids setState during render */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPlayerStore().list(), getStore().listAll()])
      .then(([list, all]) => {
        if (cancelled) return;
        setSquad(list);
        setSessions(all);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSquad((s) => s ?? []);
        setError(e instanceof Error ? e.message : 'Could not load the squad.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const load = () => setReloadToken((n) => n + 1);

  const stats = useMemo(() => careerStats(squad ?? [], sessions), [squad, sessions]);
  const ranked = useMemo(() => {
    const base = rankSquad(squad ?? [], stats);
    if (sort === 'average') return base;
    // Archived players stay at the bottom whichever column is driving.
    return [...base].sort(
      (a, b) =>
        Number(a.profile.archived) - Number(b.profile.archived) ||
        b.stats[sort] - a.stats[sort] ||
        b.stats.average - a.stats.average ||
        a.profile.name.localeCompare(b.profile.name),
    );
  }, [squad, stats, sort]);

  // One scale for every sparkline, so two rows are comparable to each other
  // rather than each being normalised to its own best night.
  const formScale = useMemo(
    () => Math.max(1, ...ranked.flatMap(({ stats: c }) => nightForm(c))),
    [ranked],
  );

  async function add() {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await getPlayerStore().save({ id: newId(), name, createdAt: Date.now(), archived: false });
      setDraft('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that player.');
    } finally {
      setBusy(false);
    }
  }

  async function update(profile: PlayerProfile) {
    try {
      await getPlayerStore().save(profile);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that player.');
    }
  }

  async function remove(profile: PlayerProfile) {
    if (
      !window.confirm(
        `Remove ${profile.name} from the squad? Sessions they played in keep their scores.`,
      )
    ) {
      return;
    }
    try {
      await getPlayerStore().remove(profile.id);
      setOpen(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that player.');
    }
  }

  const openProfile = open ? (squad ?? []).find((p) => p.id === open) : null;

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col pb-24 pt-1">
        <div className="px-5">
          <Link
            href="/sessions"
            className="-ml-0.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-dim"
          >
            <ArrowLeft size="sm" />
            Home
          </Link>

          <div className="mb-3 mt-1.5 flex items-center justify-between gap-3">
            <h1 className="disp text-[26px] font-bold tracking-[-0.025em]">Squad</h1>
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-accent"
            >
              <Plus size="sm" />
              Add
            </button>
          </div>

          {adding ? (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add someone to the squad…"
                autoCapitalize="words"
                autoComplete="off"
                autoFocus
                className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-3.5 text-[15px] placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <Button type="submit" disabled={!draft.trim() || busy}>
                Add
              </Button>
            </form>
          ) : null}

          <div className="scr flex gap-[5px] overflow-x-auto pb-2.5">
            {SORTS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSort(o.key)}
                aria-pressed={sort === o.key}
                className={`inline-flex min-h-8 flex-none items-center rounded-[9px] px-3.5 text-xs font-semibold ${
                  sort === o.key ? 'bg-line text-ink' : 'border border-line text-ink-faint'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {error ? <p className="pb-2 text-[13px] text-danger">{error}</p> : null}
        </div>

        {squad === null ? (
          <p className="px-5 text-[13px] text-ink-faint">Loading…</p>
        ) : ranked.length === 0 ? (
          <p className="mx-5 rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] leading-relaxed text-ink-dim">
            Nobody saved yet. Add the people you play with most and you will never type their
            names again.
          </p>
        ) : (
          <ul>
            {ranked.map(({ profile, stats: c }, i) => {
              return (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(profile.id)}
                    className={`flex min-h-[52px] w-full items-center gap-2.5 border-t border-line-soft px-5 py-2.5 text-left active:bg-surface ${
                      profile.archived ? 'opacity-60' : ''
                    }`}
                  >
                    <PlayerAvatar
                      name={profile.name}
                      color={undefined}
                      size="md"
                      dimmed={profile.archived}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="flex items-center gap-1.5">
                        <span className="disp truncate text-sm font-bold">{profile.name}</span>
                        {i === 0 && !profile.archived && c.games > 0 ? (
                          <CrownIcon className="h-3 w-3 flex-none" />
                        ) : null}
                      </span>
                      <Meta>
                        {c.sessions === 0
                          ? 'no sessions yet'
                          : `${c.sessions}n · ${c.games}g · ${c.wins}w`}
                      </Meta>
                    </span>
                    <Sparkline
                      values={nightForm(c)}
                      max={formScale}
                      hot={i < 2 && !profile.archived}
                      className="w-[46px] flex-none"
                    />
                    <span className="flex w-[38px] flex-none flex-col items-end">
                      <span className="nums disp text-[17px] font-bold leading-none text-accent">
                        {headline(c, sort)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-5 pt-3 text-[11px] leading-relaxed text-ink-faint">
          Sorted by {SORTS.find((o) => o.key === sort)!.label.toLowerCase()}. Save the regulars
          once — they are one tap away when you set up a night, and every session they play folds
          into the record.
        </p>
      </main>

      {openProfile ? (
        <ProfileSheet
          profile={openProfile}
          stats={stats.get(openProfile.id)}
          onClose={() => setOpen(null)}
          onUpdate={(p) => void update(p)}
          onRemove={() => void remove(openProfile)}
        />
      ) : null}
    </>
  );
}

function ProfileSheet({
  profile,
  stats,
  onClose,
  onUpdate,
  onRemove,
}: {
  profile: PlayerProfile;
  stats: CareerStats | undefined;
  onClose: () => void;
  onUpdate: (p: PlayerProfile) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const c = stats;

  return (
    <Sheet title={profile.name} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        <section className="grid grid-cols-3 gap-2">
          <Stat label="Sessions" value={String(c?.sessions ?? 0)} />
          <Stat label="Pts/game" value={(c?.average ?? 0).toFixed(1)} accent />
          <Stat label="Wins" value={String(c?.titles ?? 0)} />
        </section>

        {c && c.form.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Recent nights
            </h3>
            <ul className="flex flex-col gap-1.5">
              {c.form.slice(0, 8).map((f) => (
                <li
                  key={f.tournamentId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <span
                    className={`nums flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      f.position === 1
                        ? 'bg-accent text-accent-ink'
                        : f.position <= 3
                          ? 'bg-surface-2 text-ink'
                          : 'bg-surface-2 text-ink-faint'
                    }`}
                  >
                    {f.position}
                  </span>
                  <Link
                    href={`/t/${f.tournamentId}`}
                    className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
                  >
                    {f.name}
                  </Link>
                  <span className="nums shrink-0 text-sm text-ink-dim">
                    {f.points}
                    <span className="text-ink-faint"> pts</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-sm text-ink-faint">
            No sessions recorded yet. Pick them from the squad when you set one up and their record
            starts here.
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Name</h3>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base focus:border-accent focus:outline-none"
            />
            <Button
              disabled={!name.trim() || name.trim() === profile.name}
              onClick={() => onUpdate({ ...profile, name: name.trim() })}
            >
              Save
            </Button>
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onUpdate({ ...profile, archived: !profile.archived })}
          >
            {profile.archived ? 'Bring back into the squad' : 'Hide from the picker'}
          </Button>
          <Button variant="danger" className="w-full" onClick={onRemove}>
            Remove from squad
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 ${
        accent ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface'
      }`}
    >
      <span className={`nums text-2xl font-semibold ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  );
}
