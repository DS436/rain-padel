'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Id, RosterEntry } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import { initial } from '@/components/PlayerAvatar';
import { Group, GroupLabel } from '@/components/ui';
import { Plus } from '@/components/icons';

/**
 * Tap the regulars instead of typing them again.
 *
 * The squad is the same eight people most weeks, so retyping the roster every
 * Tuesday was the single most tedious part of setting up. Picking from here
 * also carries `profileId` through to the session, which is what lets the
 * player page show a career record rather than one night's points.
 *
 * Anyone already in tonight's roster is REMOVED from this list rather than
 * shown as selected. A picked-and-highlighted row reads like a filter, and
 * organisers were tapping the same person twice — once here, once in the text
 * field — and putting them on court against themselves. The list is what is
 * still available; the chips above are who is coming. Removing someone happens
 * there, next to everybody else who was added by hand.
 *
 * This component only draws the list. Loading the squad and owning the search
 * text is the roster's job, because the search field also adds brand-new
 * names and needs to know who is in the squad to do that honestly.
 */
export function SquadPicker({
  squad,
  stats,
  selected,
  query = '',
  onPick,
  onAddTyped,
  disabled = false,
  error,
}: {
  /** null while it loads */
  squad: PlayerProfile[] | null;
  stats: Map<Id, CareerStats>;
  selected: RosterEntry[];
  /** what is typed in the search field — filters the list, and can be added as-is */
  query?: string;
  onPick: (entry: RosterEntry) => void;
  onAddTyped?: (name: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  if (error) {
    return (
      <>
        <GroupLabel>From your squad</GroupLabel>
        <p className="px-1 text-[13px] text-ink-faint">{error}</p>
      </>
    );
  }

  if (squad === null) {
    return (
      <>
        <GroupLabel>From your squad</GroupLabel>
        <Group>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 px-4">
              <span className="h-8 w-8 flex-none animate-pulse rounded-full bg-surface-2" />
              <span className="h-3 w-24 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </Group>
      </>
    );
  }

  const q = query.trim().toLowerCase();
  const available = byActivity(availableSquad(squad, selected), stats);
  const shown = q ? available.filter((p) => p.name.toLowerCase().includes(q)) : available;
  // A name that is exactly a squad member is that person — the row below adds
  // them with their record attached, so offering "Add 'Ana'" as a stranger
  // as well would be the double-booking this list exists to prevent.
  const exact = q !== '' && available.some((p) => p.name.trim().toLowerCase() === q);
  const already = q !== '' && selected.some((e) => e.name.trim().toLowerCase() === q);
  const typed = query.trim();

  if (!q && squad.length === 0) {
    return (
      <p className="mt-6 px-1 text-[13px] leading-relaxed text-ink-faint">
        No saved players yet — type names above, or{' '}
        <Link href="/players" className="font-semibold text-accent-text">
          save your regulars
        </Link>{' '}
        and they will be one tap away every week.
      </p>
    );
  }

  if (!q && available.length === 0) {
    return (
      <p className="mt-6 px-1 text-[13px] text-ink-faint">
        Everyone in your squad is in tonight.{' '}
        <Link href="/players" className="font-semibold text-accent-text">
          Manage squad
        </Link>
      </p>
    );
  }

  return (
    <>
      <GroupLabel
        className="mt-6"
        aside={
          q ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : `${available.length} more`
        }
      >
        {squad.length === 0 ? 'Not in your squad' : 'From your squad'}
      </GroupLabel>
      <Group as="ul">
        {typed && !exact && onAddTyped ? (
          <li>
            <PickRow
              face={<Plus size="sm" />}
              name={`Add “${typed}”`}
              sub={
                already
                  ? `Someone called ${typed} is already in — they will get a number`
                  : 'Not in your squad — just for tonight'
              }
              disabled={disabled}
              onClick={() => onAddTyped(typed)}
            />
          </li>
        ) : null}
        {shown.map((p) => (
          <li key={p.id}>
            <PickRow
              face={initial(p.name)}
              name={p.name}
              sub={squadSub(stats.get(p.id))}
              disabled={disabled}
              onClick={() => onPick({ name: p.name, profileId: p.id })}
            />
          </li>
        ))}
      </Group>
      {squad.length > 0 ? (
        <Link
          href="/players"
          className="mx-auto mt-1 flex min-h-11 items-center px-3 text-[13px] text-ink-faint"
        >
          Manage squad
        </Link>
      ) : null}
    </>
  );
}

/**
 * Who in the squad is still free tonight.
 *
 * Matching on the name too: someone typed by hand before the squad loaded is
 * the same person, and offering them again is the mistake this list is for.
 */
export function availableSquad(squad: PlayerProfile[], selected: RosterEntry[]): PlayerProfile[] {
  const chosen = new Set(selected.map((e) => e.profileId).filter(Boolean));
  const typed = new Set(selected.map((e) => e.name.trim().toLowerCase()));
  return squad.filter((p) => !chosen.has(p.id) && !typed.has(p.name.trim().toLowerCase()));
}

/**
 * The regulars first. Ordered by nights attended rather than by average,
 * because the question here is "who usually comes", not "who is best".
 */
function byActivity(list: PlayerProfile[], stats: Map<Id, CareerStats>): PlayerProfile[] {
  return [...list].sort((a, b) => {
    const x = stats.get(a.id);
    const y = stats.get(b.id);
    return (
      (y?.sessions ?? 0) - (x?.sessions ?? 0) ||
      (y?.lastPlayed ?? 0) - (x?.lastPlayed ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

/** "3 nights · 6.2 per game" — the grey line under a squad name. */
export function squadSub(stats: CareerStats | undefined): string {
  if (!stats || stats.sessions === 0) return 'No nights yet';
  const nights = `${stats.sessions} night${stats.sessions === 1 ? '' : 's'}`;
  return stats.games > 0 ? `${nights} · ${stats.average.toFixed(1)} per game` : nights;
}

/**
 * A grey face: somebody who is not playing yet has no seat colour, and the
 * colour only arrives when they join the chips above.
 */
export function SquadFace({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-faint"
    >
      {children}
    </span>
  );
}

/** The "+ Add" pill closing a squad row — the row is the target, this is the sign. */
export function AddPill({ label = 'Add', muted = false }: { label?: string; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-8 flex-none items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${
        muted ? 'bg-surface-2 text-ink-faint' : 'bg-accent-soft text-accent-text'
      }`}
    >
      {muted ? null : <Plus size="sm" />}
      {label}
    </span>
  );
}

/** One squad row. The whole row adds, so the thumb never has to find the pill. */
export function PickRow({
  face,
  name,
  sub,
  onClick,
  disabled = false,
  pill,
  ariaLabel,
}: {
  face: ReactNode;
  name: string;
  sub?: string;
  onClick: () => void;
  disabled?: boolean;
  /** replaces the "+ Add" pill, e.g. "Picked" in the pair builder */
  pill?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? (name.startsWith('Add ') ? name : `Add ${name}`)}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <SquadFace>{face}</SquadFace>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium">{name}</span>
        {sub ? <span className="nums truncate text-xs text-ink-faint">{sub}</span> : null}
      </span>
      {pill ?? <AddPill />}
    </button>
  );
}
