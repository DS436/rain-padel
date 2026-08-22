'use client';

import { useRef, useState } from 'react';
import type { RosterEntry } from '@/lib/types';
import { parsePlayerNames } from '@/lib/format';

/**
 * Enter adds a name; pasting a multi-line block bulk-adds, which is how the
 * organiser's WhatsApp list actually arrives.
 *
 * Entries carry an optional `profileId` when they came from the squad, so
 * removal has to work on the entry rather than the string — two people called
 * Ahmed are a normal Tuesday and only one of them may be a saved player.
 */
export function PlayerChips({
  entries,
  onChange,
  disabled = false,
  groups,
}: {
  entries: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
  disabled?: boolean;
  /**
   * Set for a mixed draw: the two half-names. Each chip then carries a tappable
   * pill for which half the player is in, and removing moves to its own button
   * — a chip that both toggles and deletes depending on where your thumb lands
   * is the kind of control people stop trusting.
   */
  groups?: [string, string];
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const incoming = parsePlayerNames(raw).map((name) => ({ name }));
    if (incoming.length) onChange([...entries, ...incoming]);
    setDraft('');
  };

  const duplicates = new Set(
    entries
      .map((e) => e.name)
      .filter((n, i, all) => all.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && draft === '' && entries.length) {
              onChange(entries.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[\n,;]/.test(text)) {
              e.preventDefault();
              add(text);
            }
          }}
          placeholder="Add a player…"
          enterKeyHint="done"
          autoCapitalize="words"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            inputRef.current?.focus();
          }}
          disabled={disabled || !draft.trim()}
          className="min-h-11 min-w-11 rounded-xl border border-line bg-surface-2 px-4 text-xl text-ink disabled:text-ink-faint"
          aria-label="Add player"
        >
          +
        </button>
      </div>

      {entries.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {entries.map((entry, i) => {
            const tone = duplicates.has(entry.name)
              ? 'border-warn/50 bg-warn/10 text-warn'
              : entry.profileId
                ? 'border-accent/40 bg-accent/10 text-ink'
                : 'border-line bg-surface text-ink';
            const remove = () => onChange(entries.filter((_, j) => j !== i));

            if (!groups) {
              return (
                <li key={`${entry.name}-${i}`}>
                  <button
                    type="button"
                    onClick={remove}
                    className={`min-h-11 inline-flex items-center gap-2 rounded-full border px-4 text-sm ${tone}`}
                  >
                    {entry.name}
                    <span aria-hidden className="text-ink-faint">
                      ×
                    </span>
                    <span className="sr-only">Remove {entry.name}</span>
                  </button>
                </li>
              );
            }

            const group = entry.group === 1 ? 1 : 0;
            return (
              <li key={`${entry.name}-${i}`}>
                <span className={`inline-flex min-h-11 items-center rounded-full border ${tone}`}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        entries.map((e, j) =>
                          j === i ? { ...e, group: (group === 1 ? 0 : 1) as 0 | 1 } : e,
                        ),
                      )
                    }
                    aria-label={`${entry.name} is in ${groups[group]} — tap to move to ${groups[1 - group]}`}
                    className={`my-1 ml-1 min-h-9 rounded-full px-2.5 text-xs font-semibold ${
                      group === 0 ? 'bg-accent/25 text-accent' : 'bg-ink-dim/25 text-ink'
                    }`}
                  >
                    {initial(groups[group])}
                  </button>
                  <span className="px-2.5 text-sm">{entry.name}</span>
                  <button
                    type="button"
                    onClick={remove}
                    aria-label={`Remove ${entry.name}`}
                    className="min-h-11 rounded-r-full pr-3.5 text-ink-faint"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">
          Paste a whole list at once — one per line, or separated by commas.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="nums text-sm text-ink-dim">
          {groups
            ? `${entries.filter((e) => e.group !== 1).length} ${groups[0]} · ${entries.filter((e) => e.group === 1).length} ${groups[1]}`
            : `${entries.length} player${entries.length === 1 ? '' : 's'}`}
          {duplicates.size > 0 ? ' · duplicate names get numbered' : ''}
        </p>
        {groups && entries.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              onChange(entries.map((e, i) => ({ ...e, group: (i % 2) as 0 | 1 })))
            }
            className="min-h-9 text-xs text-ink-faint underline underline-offset-4"
          >
            Split them alternately
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** One letter for the group pill — a whole word does not fit on a chip. */
function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}
