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
}: {
  entries: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
  disabled?: boolean;
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
          {entries.map((entry, i) => (
            <li key={`${entry.name}-${i}`}>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, j) => j !== i))}
                className={`min-h-11 inline-flex items-center gap-2 rounded-full border px-4 text-sm ${
                  duplicates.has(entry.name)
                    ? 'border-warn/50 bg-warn/10 text-warn'
                    : entry.profileId
                      ? 'border-accent/40 bg-accent/10 text-ink'
                      : 'border-line bg-surface text-ink'
                }`}
              >
                {entry.name}
                <span aria-hidden className="text-ink-faint">
                  ×
                </span>
                <span className="sr-only">Remove {entry.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">
          Paste a whole list at once — one per line, or separated by commas.
        </p>
      )}

      <p className="nums text-sm text-ink-dim">
        {entries.length} player{entries.length === 1 ? '' : 's'}
        {duplicates.size > 0 ? ' · duplicate names get numbered' : ''}
      </p>
    </div>
  );
}
