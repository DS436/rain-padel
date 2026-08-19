'use client';

import { useState } from 'react';
import type { RosterEntry } from '@/lib/types';
import { defaultTeamName, type TeamInput } from '@/lib/tournamentReducer';

export interface DraftTeam {
  name?: string;
  players: [RosterEntry, RosterEntry];
}

/**
 * Build the fixed pairs.
 *
 * Two names go in together and stay together, so this is deliberately not the
 * flat chip list individuals mode uses — a half-entered pair is not a valid
 * roster entry and the form should never let one exist.
 */
export function TeamBuilder({
  teams,
  onChange,
}: {
  teams: DraftTeam[];
  onChange: (teams: DraftTeam[]) => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const canAdd = a.trim() !== '' && b.trim() !== '';

  const add = () => {
    if (!canAdd) return;
    onChange([...teams, { players: [{ name: a.trim() }, { name: b.trim() }] }]);
    setA('');
    setB('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="Player one"
            autoCapitalize="words"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <span className="shrink-0 text-sm text-ink-faint">&amp;</span>
          <input
            value={b}
            onChange={(e) => setB(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Player two"
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="min-h-11 rounded-lg bg-surface-2 text-sm font-medium text-ink disabled:text-ink-faint"
        >
          Add team
        </button>
      </div>

      {teams.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {teams.map((t, i) => (
            <li
              key={`${t.players[0].name}-${t.players[1].name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">
                  {t.name ?? defaultTeamName([t.players[0].name, t.players[1].name])}
                </span>
                <span className="text-xs text-ink-faint">Team {i + 1}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(teams.filter((_, j) => j !== i))}
                aria-label={`Remove team ${i + 1}`}
                className="min-h-11 min-w-11 rounded-lg text-lg text-ink-faint active:bg-surface-2"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">
          Add both names together — a pair plays every game side by side.
        </p>
      )}
    </div>
  );
}

export function toTeamInputs(teams: DraftTeam[]): TeamInput[] {
  return teams.map((t) => ({ name: t.name, players: t.players }));
}
