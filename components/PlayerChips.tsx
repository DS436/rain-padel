'use client';

import type { RosterEntry } from '@/lib/types';
import { colorAt, PlayerAvatar } from '@/components/PlayerAvatar';
import { Group, GroupLabel } from '@/components/ui';
import { X } from '@/components/icons';

/**
 * Tonight's roster, as removable chips.
 *
 * Each chip wears the colour that roster position will get once the night
 * starts (`colorAt`), so the faces on court are already familiar from here.
 * The whole chip removes — there is nothing else a chip can do in an open
 * draw, so there is no second target to miss.
 *
 * Entries carry an optional `profileId` when they came from the squad, so
 * removal works on the position rather than the string — two people called
 * Ahmed are a normal Tuesday and only one of them may be a saved player.
 *
 * Adding lives in the search field above (`RosterGrid`), which is also where
 * Enter, paste-a-WhatsApp-list and backspace-to-remove are handled.
 */
export function PlayerChips({
  entries,
  onChange,
  groups,
}: {
  entries: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
  /**
   * Set for a mixed draw: the two side names. The chips then become rows with
   * a side switch each, and removing moves to its own button — a chip that
   * both toggles and deletes depending on where your thumb lands is the kind
   * of control people stop trusting.
   */
  groups?: [string, string];
}) {
  if (entries.length === 0) return null;

  const duplicates = new Set(
    entries
      .map((e) => e.name.trim().toLowerCase())
      .filter((n, i, all) => all.indexOf(n) !== i),
  );
  const isDuplicate = (e: RosterEntry) => duplicates.has(e.name.trim().toLowerCase());
  const remove = (i: number) => onChange(entries.filter((_, j) => j !== i));
  const note =
    duplicates.size > 0 ? (
      <p className="mt-2 px-1 text-xs text-warn">
        Same name twice — they will be told apart with a number.
      </p>
    ) : null;

  if (!groups) {
    return (
      <>
        {/* gap-2 plus a 4px invisible overhang on each chip: 36px to look at,
            44px to hit, and neighbouring rows touch without overlapping */}
        <ul className="mt-4 flex flex-wrap gap-2">
          {entries.map((entry, i) => (
            <li key={`${entry.profileId ?? entry.name}-${i}`}>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${entry.name}`}
                className="relative inline-flex h-9 items-center gap-1.5 rounded-full bg-surface pl-1 pr-2 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-line)] transition-opacity after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] active:opacity-60"
              >
                <PlayerAvatar name={entry.name} color={colorAt(i)} size="md" />
                <span className={isDuplicate(entry) ? 'text-warn' : ''}>{entry.name}</span>
                <X size="sm" className="text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
        {note}
      </>
    );
  }

  const split = [
    entries.filter((e) => e.group !== 1).length,
    entries.filter((e) => e.group === 1).length,
  ];
  const setSide = (i: number, side: 0 | 1) =>
    onChange(entries.map((e, j) => (j === i ? { ...e, group: side } : e)));

  return (
    <>
      <GroupLabel
        className="mt-4"
        aside={
          entries.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(entries.map((e, i) => ({ ...e, group: (i % 2) as 0 | 1 })))}
              className="-my-3 -mr-1 inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-ink-dim active:opacity-60"
            >
              Split alternately
            </button>
          ) : null
        }
      >
        <span className="nums">
          {groups[0]} {split[0]} · {groups[1]} {split[1]}
        </span>
      </GroupLabel>
      <Group as="ul">
        {entries.map((entry, i) => {
          const side = entry.group === 1 ? 1 : 0;
          return (
            <li
              key={`${entry.profileId ?? entry.name}-${i}`}
              className="flex min-h-[52px] items-center gap-3 pl-4 pr-1"
            >
              <PlayerAvatar name={entry.name} color={colorAt(i)} size="md" />
              <span
                className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
                  isDuplicate(entry) ? 'text-warn' : ''
                }`}
              >
                {entry.name}
              </span>
              <SidePick
                names={groups}
                value={side}
                who={entry.name}
                onChange={(s) => setSide(i, s)}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${entry.name}`}
                className="inline-flex h-11 w-11 flex-none items-center justify-center text-ink-faint active:opacity-60"
              >
                <X size="sm" />
              </button>
            </li>
          );
        })}
      </Group>
      {note}
    </>
  );
}

/**
 * Which side somebody is on — a two-option well, named with the organiser's
 * own words. Each option is 30px to look at with a 7px overhang above and
 * below, so it is a 44px target inside a 52px row.
 */
function SidePick({
  names,
  value,
  who,
  onChange,
}: {
  names: [string, string];
  value: 0 | 1;
  who: string;
  onChange: (side: 0 | 1) => void;
}) {
  return (
    <span
      role="radiogroup"
      aria-label={`${who}'s side`}
      className="flex flex-none rounded-[10px] bg-surface-2 p-[3px]"
    >
      {([0, 1] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          // the truncation lives on the inner span: overflow on the button
          // itself would clip the overhang and shrink the target back to 30px
          className={`relative min-h-[30px] rounded-[7px] px-2.5 text-[13px] after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] ${
            value === s
              ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]'
              : 'font-medium text-ink-faint'
          }`}
        >
          <span className="block max-w-[5.5rem] truncate">
            {names[s] || (s === 0 ? 'Side A' : 'Side B')}
          </span>
        </button>
      ))}
    </span>
  );
}
