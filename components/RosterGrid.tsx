'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RosterEntry, Tournament } from '@/lib/types';
import { careerStats, type PlayerProfile } from '@/lib/players';
import { parsePlayerNames } from '@/lib/format';
import { getPlayerStore } from '@/lib/store/playerStore';
import { PlayerChips } from '@/components/PlayerChips';
import { availableSquad, SquadPicker } from '@/components/SquadPicker';
import { Search, X } from '@/components/icons';

/**
 * "Who turned up" — one field, tonight's chips, and the rest of the squad.
 *
 * The field does two jobs because organisers never know in advance which one
 * they need: typing filters the squad list below, and Enter (or the "Add"
 * row) puts the name in as typed. Pasting a multi-line block bulk-adds, which
 * is how the organiser's WhatsApp list actually arrives.
 *
 * An earlier version kept everyone in a grid of faces that ticked on and off.
 * It read clearly for eight people and badly for twenty, and the cobalt list
 * went back to "picking moves you": the chips are who is coming, the list is
 * who is still at home, and nobody can be in both.
 */
export function RosterGrid({
  selected,
  onChange,
  disabled = false,
  groups,
  sessions,
}: {
  selected: RosterEntry[];
  onChange: (entries: RosterEntry[]) => void;
  /** at the format's ceiling: nobody else can be added, only removed */
  disabled?: boolean;
  /** the two side names, when the draw is mixed */
  groups?: [string, string];
  /** past nights, for the "3 nights · 6.2 per game" line under each name */
  sessions: Tournament[] | null;
}) {
  const [squad, setSquad] = useState<PlayerProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayerStore()
      .list()
      .then((list) => {
        if (!cancelled) setSquad(list.filter((p) => !p.archived));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the squad.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => careerStats(squad ?? [], sessions ?? []), [squad, sessions]);

  /**
   * In a mixed draw a newcomer lands on whichever side is short, so adding
   * people in the order they walk in gives a split that is at least even.
   * The side switch on their row fixes the rest.
   */
  const add = (incoming: RosterEntry[]) => {
    if (disabled || incoming.length === 0) return;
    if (!groups) {
      onChange([...selected, ...incoming]);
      return;
    }
    const next = [...selected];
    for (const e of incoming) {
      const ones = next.filter((x) => x.group === 1).length;
      next.push({ ...e, group: ones < next.length - ones ? 1 : 0 });
    }
    onChange(next);
  };

  /**
   * A typed name that is exactly somebody in the squad IS that person — they
   * go in with their `profileId`, so their career record joins up, rather
   * than as a stranger who happens to share the name.
   */
  const addTyped = (raw: string) => {
    const free = availableSquad(squad ?? [], selected);
    const used = new Set<string>();
    const incoming = parsePlayerNames(raw).map((name): RosterEntry => {
      const match = free.find(
        (p) => !used.has(p.id) && p.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (!match) return { name };
      used.add(match.id);
      return { name: match.name, profileId: match.id };
    });
    add(incoming);
    setQuery('');
  };

  return (
    <div className="flex flex-col">
      {/* 16px text rather than the mock's 15: anything smaller and iOS zooms
          the whole page in when the field takes focus. */}
      {/* A div rather than a label, because the clear button lives inside it;
          tapping the icon still lands the cursor in the field. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="card mt-4 flex h-12 items-center gap-2 pl-3.5 text-ink-faint focus-within:outline-2 focus-within:outline-accent"
      >
        <Search />
        <input
          ref={inputRef}
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (query.trim()) addTyped(query);
            } else if (e.key === 'Backspace' && query === '' && selected.length) {
              onChange(selected.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[\n,;]/.test(text)) {
              e.preventDefault();
              addTyped(text);
            }
          }}
          placeholder={disabled ? 'That is the most this format takes' : 'Type a name or search the squad'}
          aria-label="Type a name or search the squad"
          enterKeyHint="done"
          autoCapitalize="words"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear the search"
            className="inline-flex h-11 w-11 flex-none items-center justify-center text-ink-faint active:opacity-60"
          >
            <X size="sm" />
          </button>
        ) : (
          <span className="w-2" />
        )}
      </div>

      <PlayerChips entries={selected} onChange={onChange} groups={groups} />

      <SquadPicker
        squad={squad}
        stats={stats}
        selected={selected}
        query={query}
        disabled={disabled}
        error={error}
        onPick={(entry) => {
          add([entry]);
          setQuery('');
        }}
        onAddTyped={addTyped}
      />
    </div>
  );
}
