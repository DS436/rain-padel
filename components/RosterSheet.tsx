'use client';

import { useState } from 'react';
import type { Id, Tournament } from '@/lib/types';
import { Group, GroupLabel, Segmented } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { isPrecomputed } from '@/lib/formats';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { activeCount, dropOutProblem } from '@/lib/tournamentReducer';

/**
 * Mid-session roster changes (spec 9.5). Somebody always leaves early and
 * somebody always turns up late, and without this the organiser has to restart.
 *
 * One grouped list of everybody, with "Mark as left" / "Bring back" as words on the
 * right of each row, and the arrival form as the last group — a late arrival
 * is typed in where the list ends, which is where you look for them.
 */
export function RosterSheet({
  tournament,
  names,
  colors,
  onClose,
  onToggle,
  onToggleTeam,
  onAdd,
  onAddTeam,
  onSetGroup,
}: {
  tournament: Tournament;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onClose: () => void;
  onToggle: (playerId: Id, active: boolean) => void;
  onToggleTeam: (teamId: Id, active: boolean) => void;
  onAdd: (name: string, group?: 0 | 1) => void;
  onAddTeam: (names: [string, string]) => void;
  onSetGroup: (playerId: Id, group: 0 | 1) => void;
}) {
  const [draft, setDraft] = useState('');
  const [pairA, setPairA] = useState('');
  const [pairB, setPairB] = useState('');
  // Which half a late arrival joins. Defaulting silently to the first half is
  // what made a mixed night impossible to top up: every arrival landed on the
  // same side and the draw could only get more lopsided.
  const [draftGroup, setDraftGroup] = useState<0 | 1>(0);
  const teams = tournament.mode === 'teams';
  const mixed = tournament.mixed;
  const active = activeCount(tournament);
  const activeTeams = tournament.teams.filter((t) => t.active).length;
  const atFloor = teams ? activeTeams <= 2 : active <= 4;
  const rebuilds = isPrecomputed(tournament.format)
    ? 'Changing this rebuilds the games not yet played.'
    : 'The next game uses whoever is playing.';

  const toggleCls =
    'inline-flex min-h-11 flex-none items-center px-1 text-sm font-medium text-ink-dim active:opacity-60 disabled:opacity-40';
  const inputCls =
    'h-14 min-w-0 flex-1 bg-transparent px-4 text-base placeholder:text-ink-faint focus:outline-none';
  const addCls =
    'inline-flex min-h-11 flex-none items-center px-4 text-[15px] font-semibold text-accent-text disabled:text-ink-faint';

  if (teams) {
    return (
      <Sheet
        title="Teams"
        description={`${activeTeams} team${activeTeams === 1 ? '' : 's'} playing. ${rebuilds}`}
        onClose={onClose}
      >
        <Group as="ul">
          {tournament.teams.map((team) => (
            <li key={team.id} className="flex min-h-14 items-center gap-3 py-1 pl-4 pr-3">
              <span className={team.active ? '' : 'opacity-40'}>
                <AvatarStack
                  people={team.players.map((id) => ({
                    name: names.get(id) ?? '?',
                    color: colors.get(id),
                  }))}
                />
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[15px] font-medium ${
                  team.active ? '' : 'text-ink-faint line-through'
                }`}
              >
                {team.name}
              </span>
              <button
                type="button"
                onClick={() => onToggleTeam(team.id, !team.active)}
                disabled={team.active && atFloor}
                className={toggleCls}
              >
                {team.active ? 'Mark as left' : 'Bring back'}
              </button>
            </li>
          ))}
        </Group>

        {atFloor ? (
          <p className="mt-2 px-1 text-[13px] text-ink-faint">
            Two teams is the minimum for one court, so nobody else can drop out.
          </p>
        ) : null}

        <GroupLabel>A team just arrived</GroupLabel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pairA.trim() || !pairB.trim()) return;
            onAddTeam([pairA.trim(), pairB.trim()]);
            setPairA('');
            setPairB('');
          }}
        >
          <Group>
            <input
              value={pairA}
              onChange={(e) => setPairA(e.target.value)}
              placeholder="Player one"
              aria-label="Player one"
              autoCapitalize="words"
              className={`${inputCls} w-full`}
            />
            <div className="flex items-center">
              <input
                value={pairB}
                onChange={(e) => setPairB(e.target.value)}
                placeholder="Player two"
                aria-label="Player two"
                autoCapitalize="words"
                className={inputCls}
              />
              <button type="submit" disabled={!pairA.trim() || !pairB.trim()} className={addCls}>
                Add
              </button>
            </div>
          </Group>
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet title="Players" description={`${active} playing. ${rebuilds}`} onClose={onClose}>
      <Group as="ul">
        {tournament.players.map((p) => {
          // Ask the reducer, rather than re-deriving the floors here: a mixed
          // draw has a second one (two a side) and the two answers have to
          // agree, or the button offers something the tap will not do.
          const blocked = p.active ? dropOutProblem(tournament, p.id) : null;
          const half = p.group === 1 ? 1 : 0;
          return (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-1 pl-4 pr-3">
              <PlayerAvatar
                name={names.get(p.id) ?? p.name}
                color={colors.get(p.id)}
                size="md"
                dimmed={!p.active}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`truncate text-[15px] font-medium ${
                    p.active ? '' : 'text-ink-faint line-through'
                  }`}
                >
                  {names.get(p.id) ?? p.name}
                </span>
                {/* Tap the half to move them across — somebody put on the
                    wrong side at setup is the usual reason. */}
                {mixed ? (
                  <button
                    type="button"
                    onClick={() => onSetGroup(p.id, half === 1 ? 0 : 1)}
                    className="-my-2 self-start py-2 text-xs text-ink-faint underline underline-offset-2 active:text-ink"
                  >
                    {mixed.names[half]}
                  </button>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onToggle(p.id, !p.active)}
                disabled={blocked !== null}
                title={blocked ?? undefined}
                className={toggleCls}
              >
                {p.active ? 'Mark as left' : 'Bring back'}
              </button>
            </li>
          );
        })}
      </Group>

      {atFloor ? (
        <p className="mt-2 px-1 text-[13px] text-ink-faint">
          Four players is the minimum for one court, so nobody else can drop out.
        </p>
      ) : null}

      {/* The mixed floor bites before the four-player one does, and it bites
          one side at a time, so it needs saying separately. */}
      {!atFloor && mixed
        ? ([0, 1] as const)
            .filter(
              (g) =>
                tournament.players.filter((p) => p.active && (p.group === 1 ? 1 : 0) === g)
                  .length <= 2,
            )
            .map((g) => (
              <p key={g} className="mt-2 px-1 text-[13px] text-ink-faint">
                Two {mixed.names[g]} left — a mixed court needs two from each side, so neither of
                them can drop out.
              </p>
            ))
        : null}

      <GroupLabel>Someone just arrived</GroupLabel>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAdd(draft, mixed ? draftGroup : undefined);
          setDraft('');
        }}
      >
        {mixed ? (
          <Segmented
            value={String(draftGroup)}
            onChange={(v) => setDraftGroup(v === '1' ? 1 : 0)}
            options={([0, 1] as const).map((g) => ({ value: String(g), label: mixed.names[g] }))}
          />
        ) : null}
        <Group>
          <div className="flex items-center">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Their name"
              aria-label="Name"
              autoCapitalize="words"
              className={inputCls}
            />
            <button type="submit" disabled={!draft.trim()} className={addCls}>
              Add
            </button>
          </div>
        </Group>
      </form>
    </Sheet>
  );
}
