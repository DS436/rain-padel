'use client';

import { useRef, useState } from 'react';
import { parsePlayerNames } from '@/lib/format';

/**
 * Enter adds a name; pasting a multi-line block bulk-adds, which is how the
 * organiser's WhatsApp list actually arrives.
 */
export function PlayerChips({
  names,
  onChange,
}: {
  names: string[];
  onChange: (names: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const incoming = parsePlayerNames(raw);
    if (incoming.length) onChange([...names, ...incoming]);
    setDraft('');
  };

  const duplicates = new Set(
    names.filter((n, i) => names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && draft === '' && names.length) {
              onChange(names.slice(0, -1));
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
          className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            inputRef.current?.focus();
          }}
          disabled={!draft.trim()}
          className="min-h-11 min-w-11 rounded-xl border border-line bg-surface-2 px-4 text-xl text-ink disabled:text-ink-faint"
          aria-label="Add player"
        >
          +
        </button>
      </div>

      {names.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {names.map((name, i) => (
            <li key={`${name}-${i}`}>
              <button
                type="button"
                onClick={() => onChange(names.filter((_, j) => j !== i))}
                className={`min-h-11 inline-flex items-center gap-2 rounded-full border px-4 text-sm ${
                  duplicates.has(name)
                    ? 'border-warn/50 bg-warn/10 text-warn'
                    : 'border-line bg-surface text-ink'
                }`}
              >
                {name}
                <span aria-hidden className="text-ink-faint">
                  ×
                </span>
                <span className="sr-only">Remove {name}</span>
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
        {names.length} player{names.length === 1 ? '' : 's'}
        {duplicates.size > 0 ? ' · duplicate names get numbered' : ''}
      </p>
    </div>
  );
}
