'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Id, RosterEntry, Tournament } from '@/lib/types';
import { careerStats, type PlayerProfile } from '@/lib/players';
import {
  conflictMessage,
  entryKey,
  newTeamProfile,
  pairKey,
  takenPlayers,
  teamConflict,
  type TeamProfile,
} from '@/lib/teams';
import { getPlayerStore } from '@/lib/store/playerStore';
import { getTeamStore } from '@/lib/store/teamStore';
import { AvatarStack, colorAt, FALLBACK_COLOR, initial } from '@/components/PlayerAvatar';
import { AddPill, PickRow, SquadFace, squadSub } from '@/components/SquadPicker';
import { Group, GroupLabel } from '@/components/ui';
import { newId } from '@/lib/id';
import { defaultTeamName, type TeamInput } from '@/lib/tournamentReducer';
import { Plus, Star, X } from '@/components/icons';

export interface DraftTeam {
  name?: string;
  players: [RosterEntry, RosterEntry];
  /** the saved pair this came from, or that it has since been saved as */
  savedId?: Id;
}

/**
 * Build the fixed pairs.
 *
 * Two names go in together and stay together, so this is deliberately not the
 * flat chip list individuals mode uses — a half-entered pair is not a valid
 * roster entry and the form should never let one exist.
 *
 * Most weeks the pairs are last week's pairs, which is what the saved list is
 * for: one tap puts "Ana & Ben" back on the sheet, with both squad links
 * intact so the career record still joins up. Anything typed in fresh can be
 * starred once and is a tap away every week after that.
 *
 * Drawn in the same grouped-list language as the individual roster: tonight's
 * pairs on top, then what you can add — saved pairs, the two-slot builder,
 * and the squad that fills those slots.
 */
export function TeamBuilder({
  teams,
  onChange,
  sessions = null,
}: {
  teams: DraftTeam[];
  onChange: (teams: DraftTeam[]) => void;
  /** past nights, for the record line under each squad name */
  sessions?: Tournament[] | null;
}) {
  const [a, setA] = useState<RosterEntry | null>(null);
  const [b, setB] = useState<RosterEntry | null>(null);
  const [saved, setSaved] = useState<TeamProfile[] | null>(null);
  const [squad, setSquad] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeamStore().list(), getPlayerStore().list()])
      .then(([teamList, playerList]) => {
        if (cancelled) return;
        setSaved(teamList.filter((t) => !t.archived));
        setSquad(playerList.filter((p) => !p.archived));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSaved([]);
        setError(e instanceof Error ? e.message : 'Could not load the saved teams.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => careerStats(squad, sessions ?? []), [squad, sessions]);
  const inPlay = new Set(teams.map((t) => pairKey(t.players)));

  // One person, one team — see `teamConflict`. Checked here so the button can
  // say why it is dead, and again in `add` so the rule does not live in a
  // disabled attribute.
  const taken = takenPlayers(teams);
  const isTaken = (e: RosterEntry): boolean => taken.has(entryKey(e));

  const filled = (a?.name.trim() ?? '') !== '' && (b?.name.trim() ?? '') !== '';
  const conflict = filled && a && b ? teamConflict([a, b], teams) : null;
  const duplicate = conflict ? conflictMessage(conflict) : null;
  const canAdd = filled && conflict === null;

  /**
   * Tapping a squad member drops them into whichever slot is still empty;
   * tapping somebody already in a slot takes them back out.
   */
  const fillSlot = (entry: RosterEntry) => {
    if (isTaken(entry)) return; // the row is gone, but a stale tap can still arrive
    if (a?.profileId && a.profileId === entry.profileId) return setA(null);
    if (b?.profileId && b.profileId === entry.profileId) return setB(null);
    if (!a) setA(entry);
    else if (!b) setB(entry);
    else setA(entry); // both full — start the next pair with this person
  };

  const add = () => {
    if (!a || !b || !canAdd) return;
    const pair: [RosterEntry, RosterEntry] = [
      { ...a, name: a.name.trim() },
      { ...b, name: b.name.trim() },
    ];
    if (inPlay.has(pairKey(pair))) return;
    if (teamConflict(pair, teams)) return;
    onChange([...teams, { players: pair, savedId: matchSaved(saved, pair)?.id }]);
    setA(null);
    setB(null);
  };

  const addSaved = (t: TeamProfile) => {
    if (inPlay.has(pairKey(t.players))) return;
    // A saved pair can share a member with a pair already on the sheet — Ahmed
    // plays with Ana some weeks and with Ben others, and both are starred.
    const clash = teamConflict(t.players, teams);
    if (clash) {
      setError(conflictMessage(clash));
      return;
    }
    setError(null);
    onChange([...teams, { name: t.name, players: t.players, savedId: t.id }]);
  };

  /** Star a pair that was typed in, so next week it is one tap. */
  async function saveForNextTime(draft: DraftTeam, index: number) {
    const profile = newTeamProfile(draft.players, { newId, now: Date.now }, draft.name);
    try {
      await getTeamStore().save(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that team.');
      return;
    }
    setSaved((list) => [...(list ?? []), profile].sort((x, y) => x.name.localeCompare(y.name)));
    onChange(teams.map((t, i) => (i === index ? { ...t, savedId: profile.id } : t)));
  }

  async function forget(id: Id) {
    try {
      await getTeamStore().remove(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that team.');
      return;
    }
    setSaved((list) => (list ?? []).filter((t) => t.id !== id));
    onChange(teams.map((t) => (t.savedId === id ? { ...t, savedId: undefined } : t)));
  }

  // Like the individual roster, picking moves: a saved pair on the sheet
  // leaves the saved list, and a squad member on a pair leaves the squad
  // list. Somebody sitting in a slot stays put, marked "Picked", so the row
  // under your thumb does not jump while you are choosing their partner.
  const savedFree = (saved ?? []).filter((t) => !inPlay.has(pairKey(t.players)));
  const squadFree = squad.filter((p) => !isTaken({ name: p.name, profileId: p.id }));

  return (
    <div className="flex flex-col">
      {teams.length > 0 ? (
        <>
          <GroupLabel aside={`${teams.length} pair${teams.length === 1 ? '' : 's'}`}>
            Tonight
          </GroupLabel>
          <Group as="ul">
            {teams.map((t, i) => (
              <li
                key={`${t.players[0].name}-${t.players[1].name}-${i}`}
                className="flex min-h-14 items-center gap-3 pl-4 pr-1"
              >
                <AvatarStack
                  people={[
                    { name: t.players[0].name, color: colorAt(i * 2) },
                    { name: t.players[1].name, color: colorAt(i * 2 + 1) },
                  ]}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-medium">
                    {t.name ?? defaultTeamName([t.players[0].name, t.players[1].name])}
                  </span>
                  <span className="text-xs text-ink-faint">
                    Pair {i + 1}
                    {t.savedId ? ' · saved for next time' : ''}
                  </span>
                </span>
                {t.savedId ? null : (
                  <button
                    type="button"
                    onClick={() => void saveForNextTime(t, i)}
                    className="inline-flex min-h-11 flex-none items-center gap-1 px-2 text-[13px] font-medium text-ink-dim active:opacity-60"
                  >
                    <Star size="sm" />
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(teams.filter((_, j) => j !== i))}
                  aria-label={`Remove pair ${i + 1}`}
                  className="inline-flex h-11 w-11 flex-none items-center justify-center text-ink-faint active:opacity-60"
                >
                  <X size="sm" />
                </button>
              </li>
            ))}
          </Group>
        </>
      ) : null}

      {saved === null ? (
        <p className="mt-6 px-1 text-[13px] text-ink-faint">Loading your saved pairs…</p>
      ) : savedFree.length > 0 ? (
        <>
          <GroupLabel className="mt-6" aside={`${savedFree.length} saved`}>
            Same pairs as before
          </GroupLabel>
          <Group as="ul">
            {savedFree.map((t) => (
              <li key={t.id} className="flex items-center pr-1">
                <button
                  type="button"
                  onClick={() => addSaved(t)}
                  aria-label={`Add ${t.name}`}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 pl-4 text-left active:bg-surface-2"
                >
                  {/* grey faces: no seat colour until the pair is on the sheet */}
                  <AvatarStack
                    people={t.players.map((p) => ({ name: p.name, color: FALLBACK_COLOR }))}
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{t.name}</span>
                  <AddPill />
                </button>
                <button
                  type="button"
                  onClick={() => void forget(t.id)}
                  aria-label={`Forget ${t.name}`}
                  className="inline-flex h-11 w-11 flex-none items-center justify-center text-ink-faint active:opacity-60"
                >
                  <X size="sm" />
                </button>
              </li>
            ))}
          </Group>
        </>
      ) : null}

      <GroupLabel className="mt-6">Add a pair</GroupLabel>
      <Group>
        <Slot value={a} placeholder="Player one" onChange={setA} onEnter={() => undefined} />
        <Slot value={b} placeholder="Player two" onChange={setB} onEnter={add} />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 text-[15px] font-semibold text-accent-text active:bg-surface-2 disabled:text-ink-faint"
        >
          <Plus size="sm" />
          Add pair
        </button>
      </Group>
      {/* Say why the button is dead. A disabled control with no reason next
          to it reads as a broken app rather than as a rule. */}
      {duplicate ? <p className="mt-2 px-1 text-[13px] text-warn">{duplicate}</p> : null}

      {squadFree.length > 0 ? (
        <>
          <GroupLabel className="mt-6" aside="Tap two to make a pair">
            From your squad
          </GroupLabel>
          <Group as="ul">
            {squadFree.map((p) => {
              const chosen = a?.profileId === p.id || b?.profileId === p.id;
              return (
                <li key={p.id}>
                  <PickRow
                    face={initial(p.name)}
                    name={p.name}
                    sub={chosen ? 'In the pair above' : squadSub(stats.get(p.id))}
                    onClick={() => fillSlot({ name: p.name, profileId: p.id })}
                    ariaLabel={chosen ? `Take ${p.name} out of the pair` : `Put ${p.name} in the pair`}
                    pill={chosen ? <AddPill label="Picked" muted /> : undefined}
                  />
                </li>
              );
            })}
          </Group>
        </>
      ) : null}

      {teams.length === 0 ? (
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-ink-faint">
          A pair plays every game side by side, so both names go in together. Star one to have it
          waiting next week{squad.length === 0 ? (
            <>
              , or{' '}
              <Link href="/players" className="font-semibold text-accent-text">
                save the regulars
              </Link>{' '}
              first and tap them in
            </>
          ) : null}
          .
        </p>
      ) : null}

      {error ? <p className="mt-3 px-1 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * One side of a pair.
 *
 * A slot filled from the squad keeps its `profileId`, which is the whole point
 * — that link is what makes a teams night count towards a career record. Typing
 * over it drops the link, because the name no longer refers to that person.
 */
function Slot({
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  value: RosterEntry | null;
  placeholder: string;
  onChange: (e: RosterEntry | null) => void;
  onEnter: () => void;
}) {
  const name = value?.name ?? '';
  return (
    <label className="flex min-h-12 items-center gap-3 px-4">
      {name.trim() ? (
        <SquadFace>{initial(name)}</SquadFace>
      ) : (
        <span
          aria-hidden
          className="h-8 w-8 flex-none rounded-full shadow-[inset_0_0_0_1.5px_var(--color-line)]"
        />
      )}
      <input
        value={name}
        onChange={(e) => onChange(e.target.value ? { name: e.target.value } : null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint="done"
        // 16px so iOS does not zoom the page when the slot takes focus
        className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {value?.profileId ? <span className="flex-none text-xs text-ink-faint">From squad</span> : null}
    </label>
  );
}

function matchSaved(
  saved: TeamProfile[] | null,
  players: [RosterEntry, RosterEntry],
): TeamProfile | undefined {
  const key = pairKey(players);
  return (saved ?? []).find((t) => pairKey(t.players) === key);
}

export function toTeamInputs(teams: DraftTeam[]): TeamInput[] {
  return teams.map((t) => ({ name: t.name, players: t.players }));
}
