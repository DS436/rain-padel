'use client';

import { useState } from 'react';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import {
  Group,
  GroupLabel,
  ListRow,
  QuietButton,
  SecondaryButton,
  Sparkline,
} from '@/components/ui';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Sheet } from '@/components/Sheet';

/*
 * One person's record, and the place to rename, hide or remove them. Opened
 * from a row on the squad page and from a row on the results board, so it
 * lives here rather than inside either.
 */

/** Points per game for the last few nights, oldest first — `form` is newest first. */
function nightForm(c: CareerStats): number[] {
  return c.form
    .slice(0, 6)
    .map((f) => (f.games > 0 ? f.points / f.games : 0))
    .reverse();
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

export function ProfileSheet({
  profile,
  color,
  stats,
  onClose,
  onUpdate,
  onRemove,
}: {
  profile: PlayerProfile;
  color: string | undefined;
  stats: CareerStats | undefined;
  onClose: () => void;
  onUpdate: (p: PlayerProfile) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const c = stats;
  const form = c ? nightForm(c) : [];

  return (
    <Sheet title={profile.name} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        {/* The three numbers the row line abbreviates. One well, three
            columns; per game is the one in the accent because it is the one
            the squad is ranked on. */}
        <section className="flex items-center gap-4">
          <PlayerAvatar name={profile.name} color={color} size="xl" />
          <dl className="grid flex-1 grid-cols-3 gap-2">
            <Stat label="Nights" value={String(c?.sessions ?? 0)} />
            <Stat label="Per game" value={(c?.average ?? 0).toFixed(1)} accent />
            <Stat label="Wins" value={String(c?.titles ?? 0)} />
          </dl>
        </section>

        {c && c.form.length > 0 ? (
          <section>
            {form.length > 1 ? (
              <div className="mb-3 flex items-end gap-3 px-1">
                <Sparkline values={form} max={Math.max(1, ...form)} hot className="w-24" />
                <span className="text-xs text-ink-faint">points per game, last {form.length}</span>
              </div>
            ) : null}
            <GroupLabel className="!mt-0">Recent nights</GroupLabel>
            <Group as="ul">
              {c.form.slice(0, 8).map((f) => (
                <li key={f.tournamentId}>
                  <ListRow
                    href={`/t/${f.tournamentId}`}
                    minH="min-h-12"
                    lead={
                      <span
                        className={`nums w-9 text-sm ${
                          f.position === 1 ? 'font-semibold text-accent-text' : 'text-ink-faint'
                        }`}
                      >
                        {ordinal(f.position)}
                      </span>
                    }
                    title={f.name}
                    trailing={
                      <span className="nums flex-none text-[15px] font-semibold">
                        {f.points}
                        <span className="text-xs font-normal text-ink-faint"> pts</span>
                      </span>
                    }
                  />
                </li>
              ))}
            </Group>
          </section>
        ) : (
          <p className="text-[15px] leading-normal text-ink-dim">
            No sessions recorded yet. Pick them from the squad when you set one up and their record
            starts here.
          </p>
        )}

        <NameField
          value={name}
          onChange={setName}
          canSave={!!name.trim() && name.trim() !== profile.name}
          onSave={() => onUpdate({ ...profile, name: name.trim() })}
        />

        <div className="flex flex-col gap-1">
          <SecondaryButton onClick={() => onUpdate({ ...profile, archived: !profile.archived })}>
            {profile.archived ? 'Bring back into the squad' : 'Hide from the picker'}
          </SecondaryButton>
          <QuietButton className="!text-danger" onClick={onRemove}>
            Remove from squad
          </QuietButton>
        </div>
      </div>
    </Sheet>
  );
}

/** A rename field with its own Save word — a sheet's one primary action is elsewhere. */
export function NameField({
  value,
  onChange,
  canSave,
  onSave,
}: {
  value: string;
  onChange: (v: string) => void;
  canSave: boolean;
  onSave: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
    >
      <GroupLabel className="!mt-0">Name</GroupLabel>
      <div className="flex h-[52px] items-center gap-2 rounded-[14px] bg-surface-2 pl-4 pr-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Name"
          autoCapitalize="words"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-base focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex min-h-11 items-center px-3 text-[15px] font-semibold text-accent-text disabled:text-ink-faint"
        >
          Save
        </button>
      </div>
    </form>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    // label first in the markup for screen readers, number first on screen
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd
        className={`nums text-[22px] font-semibold leading-tight ${
          accent ? 'text-accent-text' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
