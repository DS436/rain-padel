'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Tournament } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import { careerStats, rankSquad } from '@/lib/players';
import { getPlayerStore } from '@/lib/store/playerStore';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import { Button } from '@/components/ui';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown } from '@/components/Crown';
import { Sheet } from '@/components/Sheet';

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
  const ranked = useMemo(() => rankSquad(squad ?? [], stats), [squad, stats]);

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
      <header className="mx-auto flex w-full max-w-lg items-center gap-4 px-5 pt-5">
        <Link href="/sessions" className="text-sm text-ink-dim underline underline-offset-4">
          Dashboard
        </Link>
        <Link href="/new" className="text-sm text-ink-dim underline underline-offset-4">
          New session
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 pb-24 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Players</h1>
          <p className="text-sm text-ink-dim">
            Save the regulars once. They are one tap away when you set up a session, and every
            session they play folds into the record below.
          </p>
        </div>

        <form
          className="flex gap-2"
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
            className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={!draft.trim() || busy}>
            Add
          </Button>
        </form>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {squad === null ? (
          <p className="text-ink-faint">Loading…</p>
        ) : ranked.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-ink-dim">
            Nobody saved yet. Add the people you play with most and you will never type their names
            again.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ranked.map(({ profile, stats: c }) => (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => setOpen(profile.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3 text-left active:opacity-70 ${
                    profile.archived ? 'bg-surface/40 opacity-60' : 'bg-surface'
                  }`}
                >
                  <PlayerAvatar name={profile.name} color={undefined} dimmed={profile.archived} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-[15px]">
                      {profile.name}
                      {c.titles > 0 ? <Crown tier={1} className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="nums text-xs text-ink-faint">
                      {c.sessions === 0
                        ? 'No sessions yet'
                        : `${c.sessions} session${c.sessions === 1 ? '' : 's'} · ${c.games} games · ${c.wins}W ${c.draws}D ${c.losses}L`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="nums text-xl font-semibold text-accent">
                      {c.average.toFixed(1)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                      pts/game
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
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
